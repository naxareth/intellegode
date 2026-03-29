// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

type OllamaGenerateResponse = {
	response?: string;
	error?: string;
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "intellegode" is now active!');

	// Registers the first Intellegode command.
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
			// Keep the prompt simple: ask Ollama for one comprehension question.
			const question = await generateQuizQuestion(selectedCode);
			vscode.window.showInformationMessage(`Intellegode question: ${question}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			vscode.window.showErrorMessage(`Intellegode failed: ${message}`);
		}
	});

	context.subscriptions.push(disposable);
}

async function generateQuizQuestion(selectedCode: string): Promise<string> {
	const prompt = [
		'You are a code comprehension coach.',
		'Create exactly one concise comprehension question about this code.',
		'Do not provide the answer.',
		'',
		'Code:',
		selectedCode
	].join('\n');

	const response = await fetch('http://localhost:11434/api/generate', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: 'qwen2.5:3b',
			prompt,
			stream: false
		})
	});

	if (!response.ok) {
		throw new Error(`Ollama returned ${response.status} ${response.statusText}`);
	}

	const data = (await response.json()) as OllamaGenerateResponse;
	if (data.error) {
		throw new Error(data.error);
	}

	return data.response?.trim() || 'No question was generated.';
}

// This method is called when your extension is deactivated
export function deactivate() {}
