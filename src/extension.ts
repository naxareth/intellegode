import * as vscode from 'vscode';
import { evaluateAnswer, generateHint, generateQuizQuestion } from './quizService';
import { QuizWebviewMessage } from './types';
import { getQuizWebviewHtml } from './quizWebview';

// This method is called when your extension is activated.
export function activate(context: vscode.ExtensionContext) {
	console.log('Intellegode is now active.');

	const disposable = vscode.commands.registerCommand('intellegode.quizMe', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('Open a file and select some code first.');
			return;
		}

		const selectedCode = editor.document.getText(editor.selection).trim();
		if (!selectedCode) {
			vscode.window.showWarningMessage('Please highlight a block of code first.');
			return;
		}

		try {
			let currentQuestion = await generateQuizQuestion(selectedCode);

			const panel = vscode.window.createWebviewPanel(
				'intellegodeQuizPanel',
				'Intellegode Quiz',
				vscode.ViewColumn.Beside,
				{ enableScripts: true }
			);

			panel.webview.html = getQuizWebviewHtml(currentQuestion);

			// The extension host orchestrates quiz actions and delegates business logic.
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
						const evaluation = await evaluateAnswer(selectedCode, currentQuestion, userAnswer);
						panel.webview.postMessage({ command: 'showResult', result: evaluation });
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
					panel.webview.postMessage({ command: 'resetQuiz' });
				}
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			vscode.window.showErrorMessage(`Intellegode failed: ${errorMessage}`);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
