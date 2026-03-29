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
      let currentQuestion = await generateQuizQuestion(selectedCode);

			// Open a webview panel beside the editor.
			const panel = vscode.window.createWebviewPanel(
				'intellegodeQuizPanel',
				'Intellegode Quiz',
				vscode.ViewColumn.Beside,
				{ enableScripts: true }
			);

			// Render the initial question UI.
      panel.webview.html = getQuizWebviewHtml(currentQuestion);

      // Handle answer submissions and quiz control actions from the webview.
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
            panel.webview.postMessage({ command: 'showResult', result: `[MISS] You could not get a new question because ${errorMessage}.` });
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
    'Give exactly one sentence conceptual nudge.',
    'Speak directly to the learner in second person.',
    'Do not mention specific variable names, function names, API names, or implementation details from the code.',
    'Point only toward the underlying concept without giving away the answer.',
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
    'Evaluate whether the learner demonstrates understanding of the core concept behind the question.',
		'Accept answers that are correct in meaning even if wording is different from ideal phrasing.',
		'Use exactly one of these outcomes:',
    '1) "[PASS]" — learner clearly understood the core concept.',
    '2) "[PARTIAL]" — learner got part of it but missed something important.',
    '3) "[MISS]" — learner clearly misunderstood the concept.',
    'Be generous: if the learner shows any real understanding, prefer "[PARTIAL]" over "[MISS]".',
		'Feedback rules (must follow):',
    '1) Output must be on one line: [LABEL] followed immediately by feedback text in second person ("You ...").',
    '2) The label must ALWAYS be followed by feedback text on the same line.',
    '3) Returning only [PASS], [PARTIAL], or [MISS] with no explanation is not allowed.',
    '4) Every response must include a clear reason clause (use "because" or "by") so the learner sees why.',
    '5) For "[PASS]", provide exactly one sentence that states what they got right and why that shows the key concept.',
    '6) For "[PARTIAL]", provide exactly two sentences: one sentence on what they got right, plus one sentence hint on what they missed.',
    '7) For "[MISS]", provide exactly one sentence nudge in the right direction.',
    '8) Keep feedback concise, maximum 2 sentences total.',
    '9) Never reveal the full answer or implementation details.',
    '10) Do not mention specific variable names, function names, or code identifiers unless already present in the learner answer.',
    'Example formats:',
    '"[PASS] You identified the core idea because this check enforces access control for sensitive actions."',
    '"[PARTIAL] You recognized this is a permission check because it limits who can act. You may want to think more about which security risk it prevents."',
    '"[MISS] You may be focusing on the wrong detail, so think about why restricting who can execute this step protects the system."',
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
  <title>Intellegode</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      background: var(--vscode-editor-background, #0d1117);
      color: var(--vscode-editor-foreground, #e6edf3);
      min-height: 100vh;
      padding: 20px 16px;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }

    .logo {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #58a6ff, #bc8cff);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 13px;
      color: #0d1117;
      flex-shrink: 0;
    }

    .brand {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.05em;
      color: var(--vscode-editor-foreground, #e6edf3);
      opacity: 0.7;
    }

    .question-card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-left: 3px solid #58a6ff;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      animation: slideIn 0.3s ease;
    }

    .question-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #58a6ff;
      margin-bottom: 10px;
    }

    .question-text {
      font-size: 14px;
      line-height: 1.6;
      color: var(--vscode-editor-foreground, #e6edf3);
    }

    .hint-box {
      background: rgba(188, 140, 255, 0.08);
      border: 1px solid rgba(188, 140, 255, 0.2);
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;
      font-size: 13px;
      line-height: 1.5;
      color: #bc8cff;
      display: none;
      animation: slideIn 0.2s ease;
    }

    .hint-box.visible { display: block; }

    .hint-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 6px;
      opacity: 0.7;
    }

    label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--vscode-editor-foreground, #e6edf3);
      opacity: 0.5;
      margin-bottom: 8px;
    }

    textarea {
      width: 100%;
      min-height: 100px;
      resize: vertical;
      background: rgba(255,255,255,0.04);
      color: var(--vscode-editor-foreground, #e6edf3);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 12px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      line-height: 1.5;
      outline: none;
      transition: border-color 0.2s;
    }

    textarea:focus {
      border-color: #58a6ff;
    }

    textarea::placeholder {
      color: var(--vscode-editor-foreground, #e6edf3);
      opacity: 0.3;
    }

    textarea:disabled {
      opacity: 0.5;
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    button {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    #submit {
      background: #58a6ff;
      color: #0d1117;
    }

    #submit:hover { background: #79b8ff; }

    #hintBtn {
      background: rgba(188,140,255,0.15);
      color: #bc8cff;
      border: 1px solid rgba(188,140,255,0.3);
    }

    #hintBtn:hover {
      background: rgba(188,140,255,0.25);
    }

    #newQuestionBtn,
    #resetBtn {
      background: rgba(255,255,255,0.08);
      color: var(--vscode-editor-foreground, #e6edf3);
      border: 1px solid rgba(255,255,255,0.15);
    }

    #newQuestionBtn:hover,
    #resetBtn:hover {
      background: rgba(255,255,255,0.14);
    }

    button:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .loading {
      display: none;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #58a6ff;
      margin-top: 12px;
      letter-spacing: 0.05em;
    }

    .loading.visible { display: flex; align-items: center; gap: 8px; }

    .loading::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #58a6ff;
      animation: pulse 1s ease-in-out infinite;
    }

    .result-box {
      margin-top: 16px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 14px;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      display: none;
      animation: slideIn 0.25s ease;
    }

    .result-box.visible { display: block; }
    .result-box.pass { border-left: 3px solid #3fb950; }
    .result-box.partial { border-left: 3px solid #d29922; }
    .result-box.fail { border-left: 3px solid #f85149; }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="logo">ig</div>
    <span class="brand">INTELLEGODE</span>
  </div>

  <div class="question-card">
    <div class="question-label">▸ Comprehension Check</div>
    <div class="question-text" id="questionText">${escapeHtml(question)}</div>
  </div>

  <div class="hint-box" id="hint">
    <div class="hint-label">Hint</div>
    <div id="hintText"></div>
  </div>

  <label for="answer">Your Answer</label>
  <textarea id="answer" placeholder="Explain it in your own words..."></textarea>

  <div class="actions">
    <button id="submit">Submit</button>
    <button id="hintBtn">Give me a hint</button>
    <button id="newQuestionBtn">New question</button>
    <button id="resetBtn">Reset</button>
  </div>

  <div class="loading" id="loading">Thinking...</div>
  <div class="result-box" id="result"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const submitBtn = document.getElementById('submit');
    const hintBtn = document.getElementById('hintBtn');
    const newQuestionBtn = document.getElementById('newQuestionBtn');
    const resetBtn = document.getElementById('resetBtn');
    const answerInput = document.getElementById('answer');
    const questionText = document.getElementById('questionText');
    const hintBox = document.getElementById('hint');
    const hintText = document.getElementById('hintText');
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');

    submitBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'submitAnswer', answer: answerInput.value.trim() });
    });

    hintBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'requestHint' });
    });

    newQuestionBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'newQuestion' });
    });

    resetBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'resetQuiz' });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;

      if (msg.command === 'setLoading') {
        const on = Boolean(msg.loading);
        loading.classList.toggle('visible', on);
        submitBtn.disabled = on;
        hintBtn.disabled = on;
        newQuestionBtn.disabled = on;
        resetBtn.disabled = on;
        answerInput.disabled = on;
      }

      if (msg.command === 'updateQuestion') {
        questionText.textContent = String(msg.question ?? '');
        answerInput.value = '';
        hintText.textContent = '';
        hintBox.classList.remove('visible');
        result.textContent = '';
        result.className = 'result-box';
      }

      if (msg.command === 'resetQuiz') {
        answerInput.value = '';
        hintText.textContent = '';
        hintBox.classList.remove('visible');
        result.textContent = '';
        result.className = 'result-box';
      }

      if (msg.command === 'showHint') {
        hintText.textContent = msg.hint ?? '';
        hintBox.classList.add('visible');
      }

      if (msg.command === 'showResult') {
        const text = String(msg.result ?? '');
        result.textContent = text;
        result.classList.add('visible');
        result.className = 'result-box visible';
        if (text.startsWith('[PASS]')) result.classList.add('pass');
        else if (text.startsWith('[PARTIAL]')) result.classList.add('partial');
        else if (text.startsWith('[MISS]')) result.classList.add('fail');
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
