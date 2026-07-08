import * as vscode from 'vscode';
import { startQuizSession } from './quizController';
import { checkOllamaAvailability } from './ollamaClient';
import { getProvider } from './providers';
import { getUserFriendlyErrorMessage, getHintForError } from './errorMessages';
import { getConceptStats, getQuizHistory, getStreakData, clearQuizHistory } from './quizHistory';
import { getDashboardWebviewHtml } from './dashboardWebview';

const EVALUATOR_MODEL = 'qwen3.5:4b';
const NON_CODE_LANGUAGE_IDS = new Set([
	'markdown',
	'plaintext',
	'scminput',
	'git-commit',
	'git-rebase',
	'log',
	'csv',
	'tsv'
]);

// This method is called when your extension is activated.
export function activate(context: vscode.ExtensionContext) {
	console.log('Intellegode is now active.');

	// Check provider availability on startup
	const provider = getProvider(context);
	provider.checkAvailability().then((result) => {
		if (!result.available) {
			const message = result.message || `${provider.name} is not available.`;
			const learnMoreAction = provider.name === 'ollama' ? 'Learn More' : undefined;
			
			const promise = learnMoreAction 
				? vscode.window.showWarningMessage(`Intellegode: ${message}`, learnMoreAction)
				: vscode.window.showWarningMessage(`Intellegode: ${message}`);
				
			promise.then((action) => {
				if (action === 'Learn More') {
					vscode.env.openExternal(vscode.Uri.parse('https://ollama.com/'));
				}
			});
		}
	});

	const setApiKeyDisposable = vscode.commands.registerCommand('intellegode.setApiKey', async () => {
		const key = await vscode.window.showInputBox({
			prompt: 'Enter your API Key (for OpenAI-compatible providers)',
			password: true,
			placeHolder: 'sk-...'
		});
		if (key) {
			await context.secrets.store('intellegode.apiKey', key);
			vscode.window.showInformationMessage('Intellegode: API Key saved securely.');
		}
	});

	const disposable = vscode.commands.registerCommand('intellegode.quizMe', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('Open a file and select some code first.');
			return;
		}

		const languageId = editor.document.languageId;
		if (NON_CODE_LANGUAGE_IDS.has(languageId)) {
			vscode.window.showWarningMessage('Intellegode works best with source code files.');
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
				'intellegodePanel',
				'Intellegode',
				vscode.ViewColumn.Beside,
				{ enableScripts: true }
			);

			await startQuizSession(panel, selectedCode, fileCode, EVALUATOR_MODEL, context, languageId, provider);
		} catch (error) {
			const friendlyMessage = getUserFriendlyErrorMessage(error);
			const hint = getHintForError(error);
			const fullMessage = hint ? `${friendlyMessage}\n\n${hint}` : friendlyMessage;
			vscode.window.showErrorMessage(`Intellegode: ${fullMessage}`);
		}
	});

	const dashboardDisposable = vscode.commands.registerCommand('intellegode.viewProgress', async () => {
		const conceptStats = getConceptStats(context);
		const streakData = getStreakData(context);
		const history = getQuizHistory(context);
		const recentHistory = history.slice(-10).reverse();

		const extensionId = 'naxareth.intellegode';
		const ext = vscode.extensions.getExtension(extensionId);
		const version = ext?.packageJSON?.version ?? '0.0.1';

		const panel = vscode.window.createWebviewPanel(
			'intellegodeDashboard',
			'Intellegode: Progress',
			vscode.ViewColumn.Beside,
			{ enableScripts: true }
		);

		panel.webview.html = getDashboardWebviewHtml(
			panel.webview, context.extensionUri, conceptStats, streakData, recentHistory, version
		);

		panel.webview.onDidReceiveMessage(async (message: { command: string }) => {
			if (message.command === 'clearHistory') {
				await clearQuizHistory(context);
				panel.webview.postMessage({ command: 'historyCleared' });
			}
		});
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(dashboardDisposable);
	context.subscriptions.push(setApiKeyDisposable);
}

export function deactivate() {}
