import * as vscode from 'vscode';
import { startQuizSession } from './quizController';

const EVALUATOR_MODEL = 'qwen3.5:4b';

// This method is called when your extension is activated.
export function activate(context: vscode.ExtensionContext) {
	console.log('Intellegode is now active.');

	const disposable = vscode.commands.registerCommand('intellegode.quizMe', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('Open a file and select some code first.');
			return;
		}

		const fileCode = editor.document.getText();
		let selectedCode = editor.document.getText(editor.selection).trim();
		if (!selectedCode) {
			selectedCode = fileCode.trim();
			vscode.window.showInformationMessage('No selection detected. Intellegode will quiz you on the current file.');
		}

		try {
			const panel = vscode.window.createWebviewPanel(
				'intellegodeQuizPanel',
				'Intellegode Quiz',
				vscode.ViewColumn.Beside,
				{ enableScripts: true }
			);

			await startQuizSession(panel, selectedCode, fileCode, EVALUATOR_MODEL, context);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			vscode.window.showErrorMessage(`Intellegode failed: ${errorMessage}`);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
