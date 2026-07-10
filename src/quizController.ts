import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { evaluateAnswer, generateHint, generateQuizQuestion } from './quizService';
import { QuizWebviewMessage, ConceptTag } from './types';
import { saveQuizRecord, getWeakConceptNudge, getStreakData } from './quizHistory';
import { getQuizWebviewHtml } from './quizWebview';
import { getUserFriendlyErrorMessage, getHintForError } from './errorMessages';
import { LLMProvider } from './providers/types';

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
	evaluatorModel: string | undefined,
	context: vscode.ExtensionContext,
	languageId: string = 'unknown',
	provider?: LLMProvider
): Promise<void> {
	const ollamaCaller = provider ? async (prompt: string, model?: string, maxTokens?: number, timeoutMs?: number, numCtx?: number) => {
		return provider.sendPrompt(prompt, { model, maxTokens, timeoutMs, numCtx });
	} : undefined;
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
	let gotItCount = 0;
	let missedItCount = 0;
	let currentUserAnswer = '';
	let currentExplanation = '';
	const showSnippetLengthWarning = selectedCode.trim().length > 800;

	// Load extension metadata
    const extensionId = 'naxareth.intellegode';
    const extension = vscode.extensions.getExtension(extensionId);
    const version = extension?.packageJSON?.version ?? '0.0.1';
    
    let changelogContent = 'Changelog not found.';
    try {
        const changelogPathUpper = path.join(context.extensionPath, 'CHANGELOG.md');
        const changelogPathLower = path.join(context.extensionPath, 'changelog.md');
        if (fs.existsSync(changelogPathUpper)) {
            changelogContent = fs.readFileSync(changelogPathUpper, 'utf8');
        } else if (fs.existsSync(changelogPathLower)) {
            changelogContent = fs.readFileSync(changelogPathLower, 'utf8');
        }
    } catch(e) {
        // ignore
    }
	const streakData = getStreakData(context);

	// Show loading state immediately so user knows something is happening
	const loadingHtml = getQuizWebviewHtml(
		panel.webview,
		context.extensionUri,
		'Loading...',
		showSnippetLengthWarning,
		historyLoadedCount,
        version,
        changelogContent,
        true, // isInitialLoading
		streakData.currentStreak
	);
	panel.webview.html = loadingHtml;

	// Generate question in background
	let currentQuestion = await generateQuizQuestion(selectedCode, fileCodeContext, ollamaCaller, askedQuestions);
	askedQuestions.push(currentQuestion);
	await recordQuestion(selectionKey, currentQuestion, context, globalRecentQuestions, recentQuestionsBySelection);

	// Update webview with actual question
	const questionHtml = getQuizWebviewHtml(
		panel.webview,
		context.extensionUri,
		currentQuestion,
		showSnippetLengthWarning,
		historyLoadedCount,
        version,
        changelogContent,
        false, // isInitialLoading
		streakData.currentStreak
	);
	panel.webview.html = questionHtml;

	const nudge = getWeakConceptNudge(context);
	if (nudge) {
		panel.webview.postMessage({ command: 'showNudge', text: nudge });
	}

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

			panel.webview.postMessage({ command: 'setLoading', loading: true, loadingType: 'grade' });
			try {
				const explanation = await evaluateAnswer(selectedCode, currentQuestion, userAnswer, evaluatorModel, ollamaCaller);
				currentUserAnswer = userAnswer;
				currentExplanation = explanation;
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
			panel.webview.postMessage({ command: 'setLoading', loading: true, loadingType: 'hint' });
			try {
				const hint = await generateHint(selectedCode, currentQuestion, ollamaCaller);
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
			panel.webview.postMessage({ command: 'setLoading', loading: true, loadingType: 'next' });
			try {
				currentQuestion = await generateQuizQuestion(selectedCode, fileCodeContext, ollamaCaller, askedQuestions);
				askedQuestions.push(currentQuestion);
				if (askedQuestions.length > 12) {
					askedQuestions.splice(0, askedQuestions.length - 12);
				}
				await recordQuestion(selectionKey, currentQuestion, context, globalRecentQuestions, recentQuestionsBySelection);
				panel.webview.postMessage({ command: 'updateQuestion', question: currentQuestion });
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

			if (message.result === 'got-it' || message.result === 'missed-it') {
				const conceptTags = detectConceptTags(selectedCode);
				saveQuizRecord(context, {
					question: currentQuestion,
					userAnswer: currentUserAnswer,
					explanation: currentExplanation,
					selfGrade: message.result,
					conceptTags,
					languageId,
					codeSnippetPreview: selectedCode.slice(0, 200)
				}).catch(console.error); // Fire and forget with error logging
			}
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

function detectConceptTags(code: string): ConceptTag[] {
	const tags: ConceptTag[] = [];

	if (/\bif\s*\(|\belse\b|\bswitch\s*\(/i.test(code)) {
		tags.push('conditionals');
	}
	if (/\bfor\s*\(|\bwhile\s*\(|\bfor\s+const\b|\bfor\s+let\b/i.test(code)) {
		tags.push('loops');
	}
	if (/\.(map|filter|reduce|flatMap|some|every)\s*\(/i.test(code)) {
		tags.push('transformations');
	}
	if (/\basync\b|\bawait\b|\.then\s*\(/i.test(code)) {
		tags.push('async-await');
	}
	if (/\btry\s*\{|\bcatch\s*\(/i.test(code)) {
		tags.push('error-handling');
	}
	if (/\breturn\b/i.test(code)) {
		tags.push('return-contracts');
	}
	if (/\|\||\?\?|catch\s*\([^)]*\)[\s\S]{0,260}?return\b/i.test(code)) {
		tags.push('fallback-defaults');
	}

	return tags.length > 0 ? tags : ['general'];
}
