import * as vscode from 'vscode';
import { evaluateAnswer, generateHint, generateQuizQuestion } from './quizService';
import { QuizWebviewMessage } from './types';
import { getQuizWebviewHtml } from './quizWebview';

export async function startQuizSession(
	panel: vscode.WebviewPanel,
	selectedCode: string,
	evaluatorModel: string
): Promise<void> {
	let currentQuestion = await generateQuizQuestion(selectedCode);
	let gotItCount = 0;
	let missedItCount = 0;
	panel.webview.html = getQuizWebviewHtml(currentQuestion);

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
				currentQuestion = await generateQuizQuestion(selectedCode);
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
