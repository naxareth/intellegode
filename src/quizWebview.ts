export function getQuizWebviewHtml(question: string): string {
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
