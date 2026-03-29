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

			// Handle answer submissions and hint requests from the webview.
			panel.webview.onDidReceiveMessage(async (message) => {
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
						const evaluation = await evaluateAnswer(selectedCode, question, userAnswer);
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
						const hint = await generateHint(selectedCode, question);
						panel.webview.postMessage({ command: 'showHint', hint });
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : 'Unknown error';
						panel.webview.postMessage({ command: 'showHint', hint: `Hint error: ${errorMessage}` });
					} finally {
						panel.webview.postMessage({ command: 'setLoading', loading: false });
					}
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
		'Create exactly one beginner-friendly comprehension question about this code.',
		'The question must be short and focus on a single concept only.',
		'No multi-part questions.',
		'Maximum length: 1-2 sentences.',
		'Do not provide the answer.',
		'',
		'Code:',
		selectedCode
	].join('\n');

	const result = await callOllama(prompt);
	return result || 'No question was generated.';
}

async function generateHint(code: string, question: string): Promise<string> {
	const prompt = [
		'You are a code comprehension coach.',
		'Give exactly one sentence hint for the user.',
		'The hint should point them in the right direction without giving away the answer.',
		'Do not provide the full explanation or final answer.',
		'',
		'Code:',
		code,
		'',
		'Question:',
		question
	].join('\n');

	const result = await callOllama(prompt);
	return result || 'No hint was generated.';
}

async function evaluateAnswer(code: string, question: string, answer: string): Promise<string> {
	const prompt = [
		'You are a concept-focused code comprehension evaluator.',
		'Evaluate whether the user demonstrates understanding of the core concept behind the question.',
		'Accept answers that are correct in meaning even if wording is different from ideal phrasing.',
		'Give "✅ You got it!" if the user got the main idea right, even partially.',
		'Give "❌ Not quite." only if the user clearly misunderstood or got the concept wrong.',
		'Feedback rules (must follow):',
		'1) Start with either "✅ You got it!" or "❌ Not quite."',
		'2) Keep feedback to 1-2 sentences maximum.',
		'3) No long explanations and do not reveal the full answer.',
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
		body {
			font-family: sans-serif;
			margin: 16px;
			line-height: 1.4;
			background: var(--vscode-editor-background, #1e1e1e);
			color: var(--vscode-editor-foreground, #d4d4d4);
		}
		textarea, button {
			font: inherit;
		}
		h2 { margin-top: 0; font-size: 1.1rem; }
		.question { margin: 8px 0 10px; }
		.hint {
			margin: 0 0 14px;
			color: var(--vscode-editor-foreground, #d4d4d4);
			opacity: 0.9;
			font-style: italic;
		}
		textarea {
			width: 100%;
			min-height: 90px;
			resize: vertical;
			background-color: var(--vscode-input-background, var(--vscode-editor-background, #1e1e1e));
			color: var(--vscode-input-foreground, var(--vscode-editor-foreground, #d4d4d4));
			border: 1px solid var(--vscode-editor-foreground, #d4d4d4);
		}
		textarea::placeholder {
			color: var(--vscode-input-foreground, var(--vscode-editor-foreground, #d4d4d4));
			opacity: 0.7;
		}
		button {
			margin-top: 10px;
			padding: 6px 12px;
			appearance: none;
			background-color: var(--vscode-button-background, #0e639c);
			color: var(--vscode-button-foreground, #ffffff);
			border: none;
			cursor: pointer;
		}
		button:hover {
			background-color: var(--vscode-button-hoverBackground, #1177bb);
		}
		button:disabled {
			opacity: 0.6;
			cursor: default;
		}
		.actions {
			display: flex;
			gap: 8px;
			margin-top: 10px;
		}
		.muted { color: var(--vscode-editor-foreground); opacity: 0.75; margin-top: 8px; }
		.result { margin-top: 14px; white-space: pre-wrap; }
	</style>
</head>
<body>
  <!-- Shows the generated comprehension question. -->
  <h2>Comprehension Question</h2>
  <div class="question">${escapeHtml(question)}</div>
	<div id="hint" class="hint"></div>

  <!-- User types their answer here. -->
  <label for="answer"><strong>Your answer</strong></label>
  <textarea id="answer" placeholder="Type your answer..."></textarea>

	<!-- Submit and hint actions. -->
	<div class="actions">
		<button id="submit">Submit</button>
		<button id="hintBtn" type="button">Give me a hint</button>
	</div>
  <div id="loading" class="muted" style="display:none;">Evaluating...</div>

  <!-- Displays Ollama's evaluation result. -->
  <div id="result" class="result"></div>

  <script>
    // Access the VS Code messaging bridge inside the webview.
    const vscode = acquireVsCodeApi();
    const submitButton = document.getElementById('submit');
	const hintButton = document.getElementById('hintBtn');
    const answerInput = document.getElementById('answer');
	const hint = document.getElementById('hint');
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');

    submitButton.addEventListener('click', () => {
      const answer = answerInput.value.trim();
      vscode.postMessage({ command: 'submitAnswer', answer });
    });

		hintButton.addEventListener('click', () => {
			vscode.postMessage({ command: 'requestHint' });
		});

    // Receives result/loading updates from extension.ts.
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.command === 'setLoading') {
        const isLoading = Boolean(message.loading);
        loading.style.display = isLoading ? 'block' : 'none';
        submitButton.disabled = isLoading;
				hintButton.disabled = isLoading;
        answerInput.disabled = isLoading;
      }
			if (message.command === 'showHint') {
				hint.textContent = String(message.hint ?? '');
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
