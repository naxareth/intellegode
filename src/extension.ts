import * as vscode from 'vscode';

type OllamaGenerateResponse = {
	response?: string;
	error?: string;
};

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
			// Generate one comprehension question from the selected code.
			const question = await generateQuizQuestion(selectedCode);

			// Open a webview panel beside the editor.
			const panel = vscode.window.createWebviewPanel(
				'intellegodeQuizPanel',
				'Intellegode Quiz',
				vscode.ViewColumn.Beside,
				{ enableScripts: true }
			);

			// Render the initial question UI.
			panel.webview.html = getQuizWebviewHtml(question);

			// Handle answer submissions from the webview.
			panel.webview.onDidReceiveMessage(async (message) => {
				if (message.command !== 'submitAnswer') {
					return;
				}

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
					const evaluation = await evaluateAnswer(selectedCode, question, userAnswer);
					panel.webview.postMessage({ command: 'showResult', result: evaluation });
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					panel.webview.postMessage({ command: 'showResult', result: `Error: ${errorMessage}` });
				} finally {
					panel.webview.postMessage({ command: 'setLoading', loading: false });
				}
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			vscode.window.showErrorMessage(`Intellegode failed: ${errorMessage}`);
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

	const result = await callOllama(prompt);
	return result || 'No question was generated.';
}

async function evaluateAnswer(code: string, question: string, answer: string): Promise<string> {
	const prompt = [
		'You are a code comprehension coach.',
		'Evaluate whether the user understood the code based on the question and answer.',
		'Respond in 1-2 short sentences and clearly say if they understood it or not.',
		'',
		'Code:',
		code,
		'',
		'Question:',
		question,
		'',
		'User answer:',
		answer
	].join('\n');

	const result = await callOllama(prompt);
	return result || 'No evaluation was generated.';
}

// Calls local Ollama once and returns the plain text response.
async function callOllama(prompt: string): Promise<string> {
	const response = await fetch('http://localhost:11434/api/generate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
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

	return data.response?.trim() ?? '';
}

// Builds a simple, readable webview UI for asking and grading one answer.
function getQuizWebviewHtml(question: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Intellegode Quiz</title>
  <style>
    body { font-family: sans-serif; margin: 16px; line-height: 1.4; }
    h2 { margin-top: 0; font-size: 1.1rem; }
    .question { margin: 8px 0 14px; }
    textarea { width: 100%; min-height: 90px; resize: vertical; }
    button { margin-top: 10px; padding: 6px 12px; }
    .muted { color: #888; margin-top: 8px; }
    .result { margin-top: 14px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <!-- Shows the generated comprehension question. -->
  <h2>Comprehension Question</h2>
  <div class="question">${escapeHtml(question)}</div>

  <!-- User types their answer here. -->
  <label for="answer"><strong>Your answer</strong></label>
  <textarea id="answer" placeholder="Type your answer..."></textarea>

  <!-- Submits the answer to the extension host. -->
  <button id="submit">Submit</button>
  <div id="loading" class="muted" style="display:none;">Evaluating...</div>

  <!-- Displays Ollama's evaluation result. -->
  <div id="result" class="result"></div>

  <script>
    // Access the VS Code messaging bridge inside the webview.
    const vscode = acquireVsCodeApi();
    const submitButton = document.getElementById('submit');
    const answerInput = document.getElementById('answer');
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');

    submitButton.addEventListener('click', () => {
      const answer = answerInput.value.trim();
      vscode.postMessage({ command: 'submitAnswer', answer });
    });

    // Receives result/loading updates from extension.ts.
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.command === 'setLoading') {
        const isLoading = Boolean(message.loading);
        loading.style.display = isLoading ? 'block' : 'none';
        submitButton.disabled = isLoading;
        answerInput.disabled = isLoading;
      }
      if (message.command === 'showResult') {
        result.textContent = String(message.result ?? '');
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function deactivate() {}
