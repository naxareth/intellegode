import * as vscode from 'vscode';
import { evaluateAnswer, generateHint, generateQuizQuestion } from './quizService';
import { QuizWebviewMessage } from './types';
import { getQuizWebviewHtml } from './quizWebview';
import { getUserFriendlyErrorMessage, getHintForError } from './errorMessages';

const MAX_GLOBAL_QUESTION_MEMORY = 8;  // Lighter cross-session history to prevent stale context
const MAX_SELECTION_QUESTION_MEMORY = 8;  // Stronger per-snippet history for better dedup
const QUESTION_STATE_KEY = 'intellegode.recentQuestions';

type RecentQuestionState = {
	globalRecentQuestions: string[];
	recentQuestionsBySelection: Record<string, string[]>;
};

export async function startQuizSession(
	panel: vscode.WebviewPanel,
	selectedCode: string,
	fileCodeContext: string,
	evaluatorModel: string,
	context: vscode.ExtensionContext
): Promise<void> {
	const questionState = loadRecentQuestionState(context);
	const globalRecentQuestions = questionState.globalRecentQuestions;
	const recentQuestionsBySelection = questionState.recentQuestionsBySelection;
	const selectionKey = normalizeSelectionKey(selectedCode);
	const selectionHistory = recentQuestionsBySelection[selectionKey] ?? [];
	
	// Prioritize selection-specific history, then add recent global questions for pattern diversity
	// Take up to 8 selection-specific + 4 recent global = max 12 combined
	const askedQuestions: string[] = [
		...selectionHistory.slice(-MAX_SELECTION_QUESTION_MEMORY),
		...globalRecentQuestions.slice(-4)
	];
	const historyLoadedCount = askedQuestions.length;
	
	// Log what's being loaded for debugging
	console.warn(
		`[INTELLEGODE][HISTORY] selectionSpecific=${selectionHistory.length} (using ${Math.min(selectionHistory.length, MAX_SELECTION_QUESTION_MEMORY)}) + globalRecent=${Math.min(globalRecentQuestions.length, 4)} = total=${historyLoadedCount}`
	);
	let gotItCount = 0;
	let missedItCount = 0;
	const showSnippetLengthWarning = selectedCode.trim().length > 800;

	// Show loading state immediately so user knows something is happening
	const loadingHtml = getQuizWebviewHtml(
		panel.webview,
		context.extensionUri,
		'Loading...',
		showSnippetLengthWarning,
		historyLoadedCount
	);
	panel.webview.html = loadingHtml;

	// Generate question in background
	let currentQuestion = await generateQuizQuestion(selectedCode, fileCodeContext, undefined, askedQuestions);
	console.warn(`[INTELLEGODE][UI QUESTION][initial] ${currentQuestion}`);
	askedQuestions.push(currentQuestion);
	await recordQuestion(selectionKey, currentQuestion, context, globalRecentQuestions, recentQuestionsBySelection);

	// Update webview with actual question
	const questionHtml = getQuizWebviewHtml(
		panel.webview,
		context.extensionUri,
		currentQuestion,
		showSnippetLengthWarning,
		historyLoadedCount
	);
	panel.webview.html = questionHtml;

	// Route webview events to the quiz service and return UI updates to the panel.
	panel.webview.onDidReceiveMessage(async (message: QuizWebviewMessage) => {
		if (message.command === 'submitAnswer') {
			const userAnswer = String(message.answer ?? '').trim();
			if (!userAnswer) {
				panel.webview.postMessage({
					command: 'showResult',
					result: 'Please enter an answer before submitting.'
				});
				return;
			}

			panel.webview.postMessage({ command: 'setLoading', loading: true });
			try {
				const explanation = await evaluateAnswer(selectedCode, currentQuestion, userAnswer, evaluatorModel);
				panel.webview.postMessage({
					command: 'showReview',
					userAnswer,
					explanation
				});
			} catch (error) {
				const friendlyMessage = getUserFriendlyErrorMessage(error);
				const hint = getHintForError(error);
				const fullMessage = hint ? `${friendlyMessage}\n\n${hint}` : friendlyMessage;
				panel.webview.postMessage({ command: 'showResult', result: `Error: ${fullMessage}` });
			} finally {
				panel.webview.postMessage({ command: 'setLoading', loading: false });
			}
			return;
		}

		if (message.command === 'requestHint') {
			panel.webview.postMessage({ command: 'setLoading', loading: true });
			try {
				const hint = await generateHint(selectedCode, currentQuestion);
				panel.webview.postMessage({ command: 'showHint', hint });
			} catch (error) {
				const friendlyMessage = getUserFriendlyErrorMessage(error);
				const errorHint = getHintForError(error);
				const fullMessage = errorHint ? `${friendlyMessage}\n\n${errorHint}` : friendlyMessage;
				panel.webview.postMessage({ command: 'showHint', hint: `Hint error: ${fullMessage}` });
			} finally {
				panel.webview.postMessage({ command: 'setLoading', loading: false });
			}
			return;
		}

		if (message.command === 'newQuestion') {
			panel.webview.postMessage({ command: 'setLoading', loading: true });
			try {
				currentQuestion = await generateQuizQuestion(selectedCode, fileCodeContext, undefined, askedQuestions);
				console.warn(`[INTELLEGODE][UI QUESTION][newQuestion] ${currentQuestion}`);
				askedQuestions.push(currentQuestion);
				if (askedQuestions.length > 12) {
					askedQuestions.splice(0, askedQuestions.length - 12);
				}
				await recordQuestion(selectionKey, currentQuestion, context, globalRecentQuestions, recentQuestionsBySelection);
				panel.webview.postMessage({ command: 'updateQuestion', question: currentQuestion });
				panel.webview.postMessage({ command: 'updateHistoryCount', count: askedQuestions.length });
			} catch (error) {
				const friendlyMessage = getUserFriendlyErrorMessage(error);
				panel.webview.postMessage({
					command: 'showResult',
					result: `Could not generate a new question: ${friendlyMessage}`
				});
			} finally {
				panel.webview.postMessage({ command: 'setLoading', loading: false });
			}
			return;
		}

		if (message.command === 'resetQuiz') {
			gotItCount = 0;
			missedItCount = 0;
			askedQuestions.length = 0;
			askedQuestions.push(currentQuestion);
			await recordQuestion(selectionKey, currentQuestion, context, globalRecentQuestions, recentQuestionsBySelection);
			panel.webview.postMessage({ command: 'resetQuiz' });
			panel.webview.postMessage({ command: 'updateHistoryCount', count: askedQuestions.length });
			panel.webview.postMessage({
				command: 'showSelfGrade',
				result: 'reset',
				gotItCount,
				missedItCount,
				total: 0
			});
			return;
		}

		if (message.command === 'selfGrade') {
			if (message.result === 'got-it') {
				gotItCount += 1;
			}
			if (message.result === 'missed-it') {
				missedItCount += 1;
			}

			panel.webview.postMessage({
				command: 'showSelfGrade',
				result: message.result,
				gotItCount,
				missedItCount,
				total: gotItCount + missedItCount
			});
		}
	});
}

function normalizeSelectionKey(selectedCode: string): string {
	return selectedCode
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 600);
}

function loadRecentQuestionState(context: vscode.ExtensionContext): RecentQuestionState {
	const saved = context.workspaceState.get<RecentQuestionState | null>(QUESTION_STATE_KEY, null);
	const globalRecentQuestions = Array.isArray(saved?.globalRecentQuestions)
		? saved!.globalRecentQuestions.filter((item) => typeof item === 'string').slice(-MAX_GLOBAL_QUESTION_MEMORY)
		: [];

	const recentQuestionsBySelection: Record<string, string[]> = {};
	const savedSelections = saved?.recentQuestionsBySelection ?? {};
	for (const [key, value] of Object.entries(savedSelections)) {
		if (!Array.isArray(value)) {
			continue;
		}

		recentQuestionsBySelection[key] = value
			.filter((item) => typeof item === 'string')
			.slice(-MAX_SELECTION_QUESTION_MEMORY);
	}

	return {
		globalRecentQuestions,
		recentQuestionsBySelection
	};
}

async function recordQuestion(
	selectionKey: string,
	question: string,
	context: vscode.ExtensionContext,
	globalRecentQuestions: string[],
	recentQuestionsBySelection: Record<string, string[]>
): Promise<void> {
	globalRecentQuestions.push(question);
	if (globalRecentQuestions.length > MAX_GLOBAL_QUESTION_MEMORY) {
		globalRecentQuestions.splice(0, globalRecentQuestions.length - MAX_GLOBAL_QUESTION_MEMORY);
	}

	const selectionList = recentQuestionsBySelection[selectionKey] ?? [];
	selectionList.push(question);
	if (selectionList.length > MAX_SELECTION_QUESTION_MEMORY) {
		selectionList.splice(0, selectionList.length - MAX_SELECTION_QUESTION_MEMORY);
	}
	recentQuestionsBySelection[selectionKey] = selectionList;

	await context.workspaceState.update(QUESTION_STATE_KEY, {
		globalRecentQuestions,
		recentQuestionsBySelection
	} satisfies RecentQuestionState);
}
