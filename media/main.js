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
var hintClose = document.getElementById('hintClose');
var closeTip = document.getElementById('closeTip');
var selectionTip = document.getElementById('selectionTip');
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
var validationMsg = document.getElementById('validationMsg');
var sessionLog = document.getElementById('sessionLog');
var sessionLogList = document.getElementById('sessionLogList');
var sessionLogCount = document.getElementById('sessionLogCount');

var sessionEntries = [];
var currentQuestionText = questionText ? questionText.textContent : '';

var MIN_ANSWER_WORDS = 3;

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

function hideValidation() {
  if (validationMsg) validationMsg.classList.remove('visible');
}

function showValidation() {
  if (validationMsg) validationMsg.classList.add('visible');
}

function isAnswerValid(text) {
  var trimmed = (text || '').trim();
  if (!trimmed) return false;
  var words = trimmed.split(/\s+/).filter(function(w) { return w.length > 0; });
  return words.length >= MIN_ANSWER_WORDS;
}

function addSessionEntry(question, grade) {
  sessionEntries.push({ question: question, grade: grade });
  renderSessionLog();
}

function renderSessionLog() {
  if (!sessionLogList || !sessionLog || !sessionLogCount) return;
  if (sessionEntries.length === 0) {
    sessionLog.classList.remove('visible');
    return;
  }

  sessionLog.classList.add('visible');
  sessionLogCount.textContent = sessionEntries.length + ' reviewed';

  var html = '';
  for (var i = sessionEntries.length - 1; i >= 0; i--) {
    var entry = sessionEntries[i];
    var badgeClass = entry.grade === 'got-it' ? 'got-it' : 'missed-it';
    var badgeText = entry.grade === 'got-it' ? 'GOT IT' : 'MISSED';
    html += '<div class="session-log-item">';
    html += '<span class="session-log-badge ' + badgeClass + '">' + badgeText + '</span>';
    html += '<span class="session-log-question">' + escapeForHtml(entry.question) + '</span>';
    html += '</div>';
  }
  sessionLogList.innerHTML = html;
}

function escapeForHtml(text) {
  var el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

// --- Event Listeners ---

if (submitBtn) {
  submitBtn.addEventListener('click', function () {
    var answer = answerInput ? answerInput.value.trim() : '';
    if (!isAnswerValid(answer)) {
      showValidation();
      return;
    }
    hideValidation();
    hideReview();
    if (result) {
      result.className = 'result-box';
      result.textContent = '';
    }
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
    hideValidation();
    postToExtension({ command: 'newQuestion' });
  });
}

if (resetBtn) {
  resetBtn.addEventListener('click', function () {
    hideValidation();
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

if (editAnswerBtn) {
  editAnswerBtn.addEventListener('click', function () {
    hideReview();
    expandInput();
    if (answerInput) answerInput.focus();
  });
}

if (nextQuestionBtn) {
  nextQuestionBtn.addEventListener('click', function () {
    hideValidation();
    postToExtension({ command: 'newQuestion' });
  });
}

if (reviewResetBtn) {
  reviewResetBtn.addEventListener('click', function () {
    hideValidation();
    postToExtension({ command: 'resetQuiz' });
  });
}

if (hintClose) {
  hintClose.addEventListener('click', function () {
    if (hintBox) hintBox.classList.remove('visible');
  });
}

if (closeTip) {
  closeTip.addEventListener('click', function () {
    if (selectionTip) selectionTip.classList.add('hidden');
  });
}

if (answerInput) {
  answerInput.addEventListener('input', function () {
    if (isAnswerValid(answerInput.value)) {
      hideValidation();
    }
  });
}

document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (submitBtn && !submitBtn.disabled && inputSection && !inputSection.classList.contains('collapsed')) {
      submitBtn.click();
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
    e.preventDefault();
    if (hintBtn && !hintBtn.disabled && inputSection && !inputSection.classList.contains('collapsed')) {
      hintBtn.click();
    }
  }
});

// --- Loading Messages ---

var loadingMessages = ['Thinking...', 'Reading code...', 'Analyzing logic...', 'Generating...'];
var loadingInterval = null;
var loadingIndex = 0;

// --- Message Handler ---

window.addEventListener('message', function (event) {
  var msg = event.data || {};

  if (msg.command === 'setLoading') {
    var on = Boolean(msg.loading);

    if (loading) {
      loading.classList.toggle('visible', on);
      if (on) {
        loadingIndex = 0;
        loading.textContent = loadingMessages[loadingIndex];

        if (loadingInterval) clearInterval(loadingInterval);

        loadingInterval = setInterval(function () {
          loadingIndex = (loadingIndex + 1) % loadingMessages.length;
          loading.textContent = loadingMessages[loadingIndex];
        }, 2500);
      } else {
        if (loadingInterval) {
          clearInterval(loadingInterval);
          loadingInterval = null;
        }
      }
    }

    if (submitBtn) submitBtn.disabled = on;
    if (hintBtn) hintBtn.disabled = on;
    if (newQuestionBtn) newQuestionBtn.disabled = on;
    if (resetBtn) resetBtn.disabled = on;
    if (answerInput) answerInput.disabled = on;
  }

  if (msg.command === 'updateQuestion') {
    currentQuestionText = String(msg.question || '');
    if (questionText) questionText.textContent = currentQuestionText;
    if (answerInput) answerInput.value = '';
    if (hintText) hintText.textContent = '';
    if (hintBox) hintBox.classList.remove('visible');
    hideReview();
    hideValidation();
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
    hideValidation();
    expandInput();
    sessionEntries = [];
    renderSessionLog();
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
    collapseInput();
    safeScrollIntoView(reviewBox);
  }

  if (msg.command === 'showSelfGrade') {
    if (msg.result === 'got-it' && selfGradeStatus) {
      selfGradeStatus.className = 'self-grade-status visible got-it';
      selfGradeStatus.innerHTML =
        '<span class="grade-badge got-it">GOT IT</span><br>' +
        'Nice \u2014 you understood this concept correctly.';
      addSessionEntry(currentQuestionText, 'got-it');
    } else if (msg.result === 'missed-it' && selfGradeStatus) {
      selfGradeStatus.className = 'self-grade-status visible missed-it';
      selfGradeStatus.innerHTML =
        '<span class="grade-badge missed-it">MISSED</span><br>' +
        'No worries \u2014 review the explanation and try a new question.';
      addSessionEntry(currentQuestionText, 'missed-it');
    } else if (msg.result === 'reset' && selfGradeStatus) {
      selfGradeStatus.className = 'self-grade-status visible reset';
      selfGradeStatus.innerHTML = 'Session reset. Start fresh.';
    }

    if (gotItBtn) gotItBtn.disabled = true;
    if (missedItBtn) missedItBtn.disabled = true;

    if (reviewActions && msg.result !== 'reset') {
      reviewActions.classList.add('visible');
    }
  }
});
