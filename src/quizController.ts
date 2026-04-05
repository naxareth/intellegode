import * as vscode from 'vscode';
import { evaluateAnswer, generateHint, generateQuizQuestion } from './quizService';
import { QuizWebviewMessage } from './types';
import { getQuizWebviewHtml } from './quizWebview';

const MAX_GLOBAL_QUESTION_MEMORY = 20;
const MAX_SELECTION_QUESTION_MEMORY = 8;
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
	const askedQuestions: string[] = [...selectionHistory, ...globalRecentQuestions].slice(-12);
	let currentQuestion = await generateQuizQuestion(selectedCode, fileCodeContext, undefined, askedQuestions);
	askedQuestions.push(currentQuestion);
	await recordQuestion(selectionKey, currentQuestion, context, globalRecentQuestions, recentQuestionsBySelection);
	let gotItCount = 0;
	let missedItCount = 0;
	const showSnippetLengthWarning = selectedCode.trim().length > 800;
	panel.webview.html = getQuizWebviewHtml(panel.webview, context.extensionUri, currentQuestion, showSnippetLengthWarning);

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
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				panel.webview.postMessage({ command: 'showResult', result: `Error: ${errorMessage}` });
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
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				panel.webview.postMessage({ command: 'showHint', hint: `Hint error: ${errorMessage}` });
			} finally {
				panel.webview.postMessage({ command: 'setLoading', loading: false });
			}
			return;
		}

		if (message.command === 'newQuestion') {
			panel.webview.postMessage({ command: 'setLoading', loading: true });
			try {
				currentQuestion = await generateQuizQuestion(selectedCode, fileCodeContext, undefined, askedQuestions);
				askedQuestions.push(currentQuestion);
				if (askedQuestions.length > 12) {
					askedQuestions.splice(0, askedQuestions.length - 12);
				}
				await recordQuestion(selectionKey, currentQuestion, context, globalRecentQuestions, recentQuestionsBySelection);
				panel.webview.postMessage({ command: 'updateQuestion', question: currentQuestion });
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				panel.webview.postMessage({
					command: 'showResult',
					result: `[MISS] You could not get a new question because ${errorMessage}.`
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
