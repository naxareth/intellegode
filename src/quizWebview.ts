import * as vscode from 'vscode';

export function getQuizWebviewHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	question: string,
	showSnippetLengthWarning: boolean = false
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

  ${showSnippetLengthWarning ? '<div class="selection-tip">Tip: For best results, highlight a single function or small block — not the entire file.</div>' : ''}

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

  <div class="progress-section" id="progressSection">
    <div class="progress-header">
      <span class="progress-label">Session Progress</span>
      <span class="progress-count" id="progressCount">0 reviewed</span>
    </div>
    <div class="progress-bar">
      <div class="progress-got-it" id="progressGotIt"></div>
      <div class="progress-missed-it" id="progressMissedIt"></div>
    </div>
    <div class="progress-stats">
      <span class="stat-got-it" id="statGotIt">✓ 0 got it</span>
      <span class="stat-missed-it" id="statMissedIt">✗ 0 missed it</span>
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
