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

    .review-box {
      display: none;
      margin-top: 16px;
      padding: 14px;
      border-radius: 8px;
      border: 1px solid rgba(88,166,255,0.22);
      background: rgba(88,166,255,0.08);
      animation: slideIn 0.25s ease;
    }

    .review-box.visible { display: block; }

    .review-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: 1fr;
    }

    @media (min-width: 760px) {
      .review-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    .review-col {
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
      padding: 10px;
    }

    .review-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 8px;
      opacity: 0.7;
    }

    .review-text {
      font-size: 13px;
      line-height: 1.55;
      white-space: pre-wrap;
    }

    .self-grade-actions {
      display: none;
      gap: 8px;
      margin-top: 12px;
    }

    .self-grade-actions.visible {
      display: flex;
    }

    .self-grade-actions button {
      flex: 1;
      padding: 9px 12px;
    }

    #gotItBtn {
      background: rgba(63,185,80,0.2);
      color: #9be9a8;
      border: 1px solid rgba(63,185,80,0.35);
    }

    #missedItBtn {
      background: rgba(248,81,73,0.2);
      color: #ffa198;
      border: 1px solid rgba(248,81,73,0.35);
    }

    .self-grade-status {
      display: none;
      margin-top: 12px;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.03);
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .self-grade-status.visible {
      display: block;
    }

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
  <div class="review-box" id="reviewBox">
    <div class="review-grid">
      <div class="review-col">
        <div class="review-label">Your answer</div>
        <div class="review-text" id="userAnswerReview"></div>
      </div>
      <div class="review-col">
        <div class="review-label">Correct explanation</div>
        <div class="review-text" id="explanationReview"></div>
      </div>
    </div>
    <div class="self-grade-actions" id="selfGradeActions">
      <button id="gotItBtn">I got it</button>
      <button id="missedItBtn">I missed it</button>
    </div>
    <div class="self-grade-status" id="selfGradeStatus"></div>
  </div>
  <div class="result-box" id="result"></div>

  <script>
    function safeScrollIntoView(el) {
      if (!el || typeof el.scrollIntoView !== 'function') {
        return;
      }
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (error) {
        el.scrollIntoView();
      }
    }

    var vscode = null;
    if (typeof acquireVsCodeApi === 'function') {
      vscode = acquireVsCodeApi();
    }

    function postToExtension(message) {
      if (!vscode || typeof vscode.postMessage !== 'function') {
        return;
      }
      vscode.postMessage(message);
    }

    var submitBtn = document.getElementById('submit');
    var hintBtn = document.getElementById('hintBtn');
    var newQuestionBtn = document.getElementById('newQuestionBtn');
    var resetBtn = document.getElementById('resetBtn');
    var answerInput = document.getElementById('answer');
    var questionText = document.getElementById('questionText');
    var hintBox = document.getElementById('hint');
    var hintText = document.getElementById('hintText');
    var loading = document.getElementById('loading');
    var result = document.getElementById('result');
    var reviewBox = document.getElementById('reviewBox');
    var userAnswerReview = document.getElementById('userAnswerReview');
    var explanationReview = document.getElementById('explanationReview');
    var selfGradeActions = document.getElementById('selfGradeActions');
    var selfGradeStatus = document.getElementById('selfGradeStatus');
    var gotItBtn = document.getElementById('gotItBtn');
    var missedItBtn = document.getElementById('missedItBtn');

    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        if (reviewBox) reviewBox.classList.remove('visible');
        if (selfGradeActions) selfGradeActions.classList.remove('visible');
        if (result) {
          result.className = 'result-box visible';
          result.textContent = 'Generating explanation...';
          safeScrollIntoView(result);
        }
        var answer = answerInput ? answerInput.value.trim() : '';
        postToExtension({ command: 'submitAnswer', answer: answer });
      });
    }

    if (hintBtn) {
      hintBtn.addEventListener('click', function () {
        postToExtension({ command: 'requestHint' });
      });
    }

    if (newQuestionBtn) {
      newQuestionBtn.addEventListener('click', function () {
        postToExtension({ command: 'newQuestion' });
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        postToExtension({ command: 'resetQuiz' });
      });
    }

    if (gotItBtn) {
      gotItBtn.addEventListener('click', function () {
        postToExtension({ command: 'selfGrade', result: 'got-it' });
      });
    }

    if (missedItBtn) {
      missedItBtn.addEventListener('click', function () {
        postToExtension({ command: 'selfGrade', result: 'missed-it' });
      });
    }

    window.addEventListener('message', function (event) {
      var msg = event.data || {};

      if (msg.command === 'setLoading') {
        var on = Boolean(msg.loading);
        if (loading) loading.classList.toggle('visible', on);
        if (on) {
          safeScrollIntoView(loading);
        }
        if (submitBtn) submitBtn.disabled = on;
        if (hintBtn) hintBtn.disabled = on;
        if (newQuestionBtn) newQuestionBtn.disabled = on;
        if (resetBtn) resetBtn.disabled = on;
        if (answerInput) answerInput.disabled = on;
      }

      if (msg.command === 'updateQuestion') {
        if (questionText) questionText.textContent = String(msg.question || '');
        if (answerInput) answerInput.value = '';
        if (hintText) hintText.textContent = '';
        if (hintBox) hintBox.classList.remove('visible');
        if (reviewBox) reviewBox.classList.remove('visible');
        if (selfGradeActions) selfGradeActions.classList.remove('visible');
        if (selfGradeStatus) selfGradeStatus.classList.remove('visible');
        if (selfGradeStatus) selfGradeStatus.textContent = '';
        if (result) {
          result.textContent = '';
          result.className = 'result-box';
        }
      }

      if (msg.command === 'resetQuiz') {
        if (answerInput) answerInput.value = '';
        if (hintText) hintText.textContent = '';
        if (hintBox) hintBox.classList.remove('visible');
        if (reviewBox) reviewBox.classList.remove('visible');
        if (selfGradeActions) selfGradeActions.classList.remove('visible');
        if (selfGradeStatus) selfGradeStatus.classList.remove('visible');
        if (selfGradeStatus) selfGradeStatus.textContent = '';
        if (result) {
          result.textContent = '';
          result.className = 'result-box';
        }
      }

      if (msg.command === 'showHint') {
        if (hintText) hintText.textContent = msg.hint || '';
        if (hintBox) hintBox.classList.add('visible');
      }

      if (msg.command === 'showResult') {
        var text = String(msg.result || '');
        if (result) {
          result.textContent = text;
          result.classList.add('visible');
          result.className = 'result-box visible';
          safeScrollIntoView(result);
        }
      }

      if (msg.command === 'showReview') {
        if (userAnswerReview) userAnswerReview.textContent = String(msg.userAnswer || '');
        if (explanationReview) explanationReview.textContent = String(msg.explanation || '');
        if (reviewBox) reviewBox.classList.add('visible');
        if (selfGradeActions) selfGradeActions.classList.add('visible');
        if (gotItBtn) gotItBtn.disabled = false;
        if (missedItBtn) missedItBtn.disabled = false;
        if (result) {
          result.className = 'result-box';
          result.textContent = '';
        }
        safeScrollIntoView(reviewBox);
      }

      if (msg.command === 'showSelfGrade') {
        var got = Number(msg.gotItCount || 0);
        var missed = Number(msg.missedItCount || 0);
        var total = Number(msg.total || 0);
        var latest = 'Progress reset.';
        if (msg.result === 'got-it') {
          latest = 'Last result: You marked this as got it.';
        } else if (msg.result === 'missed-it') {
          latest = 'Last result: You marked this as missed it.';
        }

        if (selfGradeStatus) {
          selfGradeStatus.textContent = latest + '\\n' +
            'Got it: ' + got + ' | Missed it: ' + missed + ' | Total reviewed: ' + total;
          selfGradeStatus.classList.add('visible');
        }
        if (gotItBtn) gotItBtn.disabled = true;
        if (missedItBtn) missedItBtn.disabled = true;
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
