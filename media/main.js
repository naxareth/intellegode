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
      result.className = 'result-box';
      result.textContent = '';
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
  if (statGotIt) statGotIt.textContent = '\u2713 ' + got + ' got it';
  if (statMissedIt) statMissedIt.textContent = '\u2717 ' + missed + ' missed it';
}

var loadingMessages = ['Thinking...', 'Reading code...', 'Analyzing logic...', 'Generating...'];
var loadingInterval = null;
var loadingIndex = 0;

window.addEventListener('message', function (event) {
  var msg = event.data || {};

  if (msg.command === 'setLoading') {
    var on = Boolean(msg.loading);

    if (loading) {
      loading.classList.toggle('visible', on);
      if (on) {
        loadingIndex = 0;
        loading.textContent = loadingMessages[loadingIndex];
        safeScrollIntoView(loading);

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
    collapseInput();
    safeScrollIntoView(reviewBox);
  }

  if (msg.command === 'showSelfGrade') {
    var got = Number(msg.gotItCount || 0);
    var missed = Number(msg.missedItCount || 0);

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

    if (reviewActions && msg.result !== 'reset') {
      reviewActions.classList.add('visible');
    }

    updateProgressBar(got, missed);
  }
});
