import * as vscode from 'vscode';

export function getQuizWebviewHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	question: string,
  showSnippetLengthWarning: boolean = false,
  _historyLoadedCount: number = 0
): string {
	const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'styles.css'));
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));
	const nonce = getNonce();
	const csp = [
		"default-src 'none'",
		`img-src ${webview.cspSource} https: data:`,
		`style-src ${webview.cspSource} https://fonts.googleapis.com`,
		`font-src ${webview.cspSource} https://fonts.gstatic.com`,
		`script-src ${webview.cspSource} 'nonce-${nonce}'`
	].join('; ');

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <title>Intellegode</title>
  <link rel="stylesheet" href="${stylesUri}" />
</head>
<body>

  <div class="header">
    <div class="logo">ig</div>
    <span class="brand">INTELLEGODE</span>
  </div>

  ${showSnippetLengthWarning ? '<div class="selection-tip" id="selectionTip">Tip: For best results, highlight a single function or small block — not the entire file.<button class="close-tip" id="closeTip" aria-label="Dismiss tip">&times;</button></div>' : ''}

  <div class="question-card">
    <div class="question-label">Comprehension Check</div>
    <div class="question-text" id="questionText">${escapeHtml(question)}</div>
  </div>

  <div class="hint-box" id="hint">
    <div class="hint-label">Hint</div>
    <div id="hintText"></div>
    <button class="hint-close" id="hintClose" aria-label="Dismiss hint">&times;</button>
  </div>

  <div class="input-section" id="inputSection">
    <label for="answer">Your Answer <span class="shortcut-hint">Ctrl+Enter to submit</span></label>
    <textarea id="answer" placeholder="Explain it in your own words..."></textarea>
    <div class="validation-msg" id="validationMsg">Write at least a short sentence explaining your understanding.</div>

    <div class="actions">
      <button id="submit">Submit</button>
      <button id="hintBtn">Hint</button>
      <button id="newQuestionBtn">New question</button>
      <button id="resetBtn">Reset</button>
    </div>
  </div>

  <div class="loading" id="loading" style="display: none;">
    <svg class="spinner" viewBox="0 0 50 50">
      <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
    </svg>
    <span id="loadingText">Thinking...</span>
  </div>

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
      <button id="gotItBtn">Got it</button>
      <button id="missedItBtn">Missed it</button>
    </div>
    <div class="self-grade-status" id="selfGradeStatus"></div>
    <div class="review-actions" id="reviewActions">
      <button id="editAnswerBtn">Edit answer</button>
      <button id="nextQuestionBtn">Next question</button>
      <button id="reviewResetBtn">Reset</button>
    </div>
  </div>

  <div class="result-box" id="result"></div>

  <div class="session-log" id="sessionLog" style="display: none;">
    <div class="session-log-header">
      <span class="session-log-title">Session Review</span>
      <span class="session-log-count" id="sessionLogCount">0 reviewed</span>
    </div>
    <div class="session-log-list" id="sessionLogList"></div>
  </div>

  <div class="modal-overlay" id="sessionModal" style="display: none;">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title">Session Details</div>
        <button class="modal-close" id="modalClose">&times;</button>
      </div>
      <div class="modal-body">
        <div class="modal-label">Question</div>
        <div class="modal-text" id="modalQuestion"></div>
        <div class="modal-label">Your Answer</div>
        <div class="modal-text" id="modalAnswer"></div>
        <div class="modal-label">Correct Explanation</div>
        <div class="modal-text" id="modalExplanation"></div>
      </div>
      <div class="modal-footer">
        <button id="modalPrevBtn" class="modal-btn">Previous</button>
        <span id="modalPageCounter">1 / 1</span>
        <button id="modalNextBtn" class="modal-btn">Next</button>
      </div>
    </div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
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

function getNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }

  return nonce;
}
