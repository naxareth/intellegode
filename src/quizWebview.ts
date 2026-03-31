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

    /* Input section that collapses after submit */
    .input-section {
      transition: opacity 0.25s ease, max-height 0.3s ease;
      overflow: hidden;
    }

    .input-section.collapsed {
      opacity: 0;
      max-height: 0;
      margin: 0;
      padding: 0;
      pointer-events: none;
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

    .shortcut-hint {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      opacity: 0.4;
      margin-left: 4px;
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
    #resetBtn,
    #editAnswerBtn {
      background: rgba(255,255,255,0.08);
      color: var(--vscode-editor-foreground, #e6edf3);
      border: 1px solid rgba(255,255,255,0.15);
    }

    #newQuestionBtn:hover,
    #resetBtn:hover,
    #editAnswerBtn:hover {
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

    .review-actions {
      display: none;
      gap: 8px;
      margin-top: 12px;
    }

    .review-actions.visible {
      display: flex;
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

    #gotItBtn:hover:not(:disabled) {
      background: rgba(63,185,80,0.35);
    }

    #missedItBtn {
      background: rgba(248,81,73,0.2);
      color: #ffa198;
      border: 1px solid rgba(248,81,73,0.35);
    }

    #missedItBtn:hover:not(:disabled) {
      background: rgba(248,81,73,0.35);
    }

    /* Self-grade status with color coding */
    .self-grade-status {
      display: none;
      margin-top: 12px;
      padding: 12px;
      border-radius: 8px;
      font-size: 12px;
      line-height: 1.5;
      animation: slideIn 0.2s ease;
    }

    .self-grade-status.visible {
      display: block;
    }

    .self-grade-status.got-it {
      background: rgba(63,185,80,0.1);
      border: 1px solid rgba(63,185,80,0.25);
      color: #9be9a8;
    }

    .self-grade-status.missed-it {
      background: rgba(248,81,73,0.1);
      border: 1px solid rgba(248,81,73,0.25);
      color: #ffa198;
    }

    .self-grade-status.reset {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.12);
      color: var(--vscode-editor-foreground, #e6edf3);
    }

    .grade-badge {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 4px;
      margin-bottom: 8px;
    }

    .grade-badge.got-it {
      background: rgba(63,185,80,0.25);
      color: #9be9a8;
    }

    .grade-badge.missed-it {
      background: rgba(248,81,73,0.25);
      color: #ffa198;
    }

    /* Progress bar */
    .progress-section {
      display: none;
      margin-top: 16px;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
      animation: slideIn 0.2s ease;
    }

    .progress-section.visible {
      display: block;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .progress-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.6;
    }

    .progress-count {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      opacity: 0.7;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: rgba(255,255,255,0.06);
      border-radius: 4px;
      overflow: hidden;
      display: flex;
    }

    .progress-got-it {
      height: 100%;
      background: linear-gradient(90deg, #3fb950, #56d364);
      transition: width 0.4s ease;
    }

    .progress-missed-it {
      height: 100%;
      background: linear-gradient(90deg, #f85149, #ff7b72);
      transition: width 0.4s ease;
    }

    .progress-stats {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      font-size: 11px;
    }

    .stat-got-it {
      color: #9be9a8;
      font-family: 'JetBrains Mono', monospace;
    }

    .stat-missed-it {
      color: #ffa198;
      font-family: 'JetBrains Mono', monospace;
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
    <div class="hint-label">💡 Hint</div>
    <div id="hintText"></div>
  </div>

  <div class="input-section" id="inputSection">
    <label for="answer">Your Answer <span class="shortcut-hint">Ctrl+Enter to submit</span></label>
    <textarea id="answer" placeholder="Explain it in your own words..."></textarea>

    <div class="actions">
      <button id="submit">Submit</button>
      <button id="hintBtn">Give me a hint</button>
      <button id="newQuestionBtn">New question</button>
      <button id="resetBtn">Reset</button>
    </div>
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
      <button id="gotItBtn">✓ I got it</button>
      <button id="missedItBtn">✗ I missed it</button>
    </div>
    <div class="self-grade-status" id="selfGradeStatus"></div>
    <div class="review-actions" id="reviewActions">
      <button id="editAnswerBtn">Edit answer</button>
      <button id="nextQuestionBtn">Next question</button>
      <button id="reviewResetBtn">Reset</button>
    </div>
  </div>

  <div class="result-box" id="result"></div>

  <!-- Progress bar section -->
  <div class="progress-section" id="progressSection">
    <div class="progress-header">
      <span class="progress-label">Session Progress</span>
      <span class="progress-count" id="progressCount">0 reviewed</span>
    </div>
    <div class="progress-bar">
      <div class="progress-got-it" id="progressGotIt" style="width: 0%"></div>
      <div class="progress-missed-it" id="progressMissedIt" style="width: 0%"></div>
    </div>
    <div class="progress-stats">
      <span class="stat-got-it" id="statGotIt">✓ 0 got it</span>
      <span class="stat-missed-it" id="statMissedIt">✗ 0 missed it</span>
    </div>
  </div>

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
    var inputSection = document.getElementById('inputSection');
    var editAnswerBtn = document.getElementById('editAnswerBtn');
    var nextQuestionBtn = document.getElementById('nextQuestionBtn');
    var reviewResetBtn = document.getElementById('reviewResetBtn');
    var reviewActions = document.getElementById('reviewActions');
    var progressSection = document.getElementById('progressSection');
    var progressCount = document.getElementById('progressCount');
    var progressGotIt = document.getElementById('progressGotIt');
    var progressMissedIt = document.getElementById('progressMissedIt');
    var statGotIt = document.getElementById('statGotIt');
    var statMissedIt = document.getElementById('statMissedIt');

    function collapseInput() {
      if (inputSection) inputSection.classList.add('collapsed');
    }

    function expandInput() {
      if (inputSection) inputSection.classList.remove('collapsed');
    }

    function hideReview() {
      if (reviewBox) reviewBox.classList.remove('visible');
      if (selfGradeActions) selfGradeActions.classList.remove('visible');
      if (selfGradeStatus) {
        selfGradeStatus.classList.remove('visible', 'got-it', 'missed-it', 'reset');
        selfGradeStatus.innerHTML = '';
      }
      if (reviewActions) reviewActions.classList.remove('visible');
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        hideReview();
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

    // Review-phase action buttons
    if (editAnswerBtn) {
      editAnswerBtn.addEventListener('click', function () {
        hideReview();
        expandInput();
        if (answerInput) answerInput.focus();
      });
    }

    if (nextQuestionBtn) {
      nextQuestionBtn.addEventListener('click', function () {
        postToExtension({ command: 'newQuestion' });
      });
    }

    if (reviewResetBtn) {
      reviewResetBtn.addEventListener('click', function () {
        postToExtension({ command: 'resetQuiz' });
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      // Ctrl+Enter or Cmd+Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (submitBtn && !submitBtn.disabled && inputSection && !inputSection.classList.contains('collapsed')) {
          submitBtn.click();
        }
      }

      // Ctrl+H or Cmd+H for hint
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        if (hintBtn && !hintBtn.disabled && inputSection && !inputSection.classList.contains('collapsed')) {
          hintBtn.click();
        }
      }
    });

    function updateProgressBar(got, missed) {
      var total = got + missed;
      if (total === 0) {
        if (progressSection) progressSection.classList.remove('visible');
        return;
      }

      if (progressSection) progressSection.classList.add('visible');
      if (progressCount) progressCount.textContent = total + ' reviewed';

      var gotPct = Math.round((got / total) * 100);
      var missedPct = 100 - gotPct;

      if (progressGotIt) progressGotIt.style.width = gotPct + '%';
      if (progressMissedIt) progressMissedIt.style.width = missedPct + '%';
      if (statGotIt) statGotIt.textContent = '\\u2713 ' + got + ' got it';
      if (statMissedIt) statMissedIt.textContent = '\\u2717 ' + missed + ' missed it';
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
        hideReview();
        expandInput();
        if (result) {
          result.textContent = '';
          result.className = 'result-box';
        }
      }

      if (msg.command === 'resetQuiz') {
        if (answerInput) answerInput.value = '';
        if (hintText) hintText.textContent = '';
        if (hintBox) hintBox.classList.remove('visible');
        hideReview();
        expandInput();
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
        // Collapse input section to focus on review
        collapseInput();
        safeScrollIntoView(reviewBox);
      }

      if (msg.command === 'showSelfGrade') {
        var got = Number(msg.gotItCount || 0);
        var missed = Number(msg.missedItCount || 0);
        var total = Number(msg.total || 0);

        if (msg.result === 'got-it' && selfGradeStatus) {
          selfGradeStatus.className = 'self-grade-status visible got-it';
          selfGradeStatus.innerHTML =
            '<span class="grade-badge got-it">\\u2713 Got it</span><br>' +
            'Nice! You understood this concept correctly.';
        } else if (msg.result === 'missed-it' && selfGradeStatus) {
          selfGradeStatus.className = 'self-grade-status visible missed-it';
          selfGradeStatus.innerHTML =
            '<span class="grade-badge missed-it">\\u2717 Missed it</span><br>' +
            'No worries \\u2014 review the explanation and try a new question.';
        } else if (msg.result === 'reset' && selfGradeStatus) {
          selfGradeStatus.className = 'self-grade-status visible reset';
          selfGradeStatus.innerHTML = 'Progress reset. Start fresh!';
        }

        if (gotItBtn) gotItBtn.disabled = true;
        if (missedItBtn) missedItBtn.disabled = true;

        // Show review-phase action buttons after grading
        if (reviewActions && msg.result !== 'reset') {
          reviewActions.classList.add('visible');
        }

        // Update progress bar
        updateProgressBar(got, missed);
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
