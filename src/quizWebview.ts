import * as vscode from 'vscode';

export function getQuizWebviewHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	question: string,
    showSnippetLengthWarning: boolean = false,
    _historyLoadedCount: number = 0,
    version: string = '0.0.1',
    changelogContent: string = '',
    isInitialLoading: boolean = false
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <title>Intellegode</title>
  <link rel="stylesheet" href="${stylesUri}?n=${nonce}" />
</head>
<body>

  <div class="header">
    <div class="logo">ig</div>
    <span class="brand">INTELLEGODE <span class="version">v${version}</span></span>
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
    </div>
  </div>

  <div class="loading-overlay${isInitialLoading ? ' visible' : ''}" id="loadingOverlay">
    <div class="loading-card">
      <svg class="spinner" viewBox="0 0 50 50">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
      </svg>
      <span id="loadingText">Thinking...</span>
    </div>
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

  <div class="modal-wrapper" id="sessionModal">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title">Session Details</div>
        <button class="modal-close" data-target="sessionModal">&times;</button>
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

  <div class="modal-wrapper" id="resetModal">
    <div class="modal-content modal-sm">
      <div class="modal-header">
        <div class="modal-title">Reset Session</div>
        <button class="modal-close" data-target="resetModal">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 13px; line-height: 1.5; margin: 0; color: var(--vscode-editor-foreground);">Are you sure you want to reset your quiz session? This will clear your session review history and start fresh with a clean slate.</p>
      </div>
      <div class="modal-footer" style="justify-content: flex-end; gap: 8px;">
        <button class="modal-btn modal-close" data-target="resetModal">Cancel</button>
        <button id="confirmResetBtn" class="modal-btn danger">Confirm Reset</button>
      </div>
    </div>
  </div>

  <div class="modal-wrapper" id="aboutModal">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title">About Intellegode</div>
        <button class="modal-close" data-target="aboutModal">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 13px; line-height: 1.5;"><strong>Intellegode</strong> is an AI-powered educational pair-programmer designed to teach developers code concepts via interactive comprehension checks.</p>
        <p style="font-size: 13px; line-height: 1.5;">Highlight a snippet of code, hit Ctrl+Shift+Enter, and test your understanding dynamically.</p>
      </div>
    </div>
  </div>

  <div class="modal-wrapper" id="changelogModal">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title">Changelog</div>
        <button class="modal-close" data-target="changelogModal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="modal-text markdown-content">${renderSimpleMarkdown(changelogContent)}</div>
      </div>
    </div>
  </div>

  <div class="modal-wrapper" id="whyModal">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title">Why Intellegode?</div>
        <button class="modal-close" data-target="whyModal">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 13px; line-height: 1.5;">Passive reading of code is inefficient. According to pedagogical research, active recall and generative learning form the strongest memory pathways.</p>
        <p style="font-size: 13px; line-height: 1.5;"><strong>Intellegode</strong> deliberately pauses your copy-pasting momentum and asks the critical "Why?" and "How?" questions behind the code you are interacting with, enforcing deep comprehension instead of superficial task completion.</p>
      </div>
    </div>
  </div>

  <div class="modal-wrapper" id="helpModal">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title">Help & Usage</div>
        <button class="modal-close" data-target="helpModal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="markdown-content">
          <h3>How to use</h3>
          <ul>
            <li>Select a small code snippet (e.g. a single function, an if-block).</li>
            <li>Press <strong>Ctrl+Alt+Q</strong> (or Cmd+Option+Q on Mac) to generate a quiz.</li>
            <li>Type out your explanation of what the code does or why it's built that way.</li>
            <li>Submit to get AI feedback and learn from the correct explanation.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <div class="modal-wrapper" id="troubleshootingModal">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title">Troubleshooting</div>
        <button class="modal-close" data-target="troubleshootingModal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="markdown-content">
          <h3>Common Issues</h3>
          <ul>
            <li><strong>Ollama Error / Timeout</strong>: Ensure Ollama is running in your terminal (\\\`ollama serve\\\`) or via Docker. Check if you have the model pulled (\\\`ollama pull qwen3.5:4b\\\`).</li>
            <li><strong>Repetitive Questions</strong>: Maximize the selection! If you keep selecting just \\\`const x = 5;\\\`, there isn't much to ask.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; max-width: 400px;">
      <button class="footer-link" id="showAboutBtn">About</button>
      <span class="footer-sep">&bull;</span>
      <button class="footer-link" id="showWhyBtn">Why</button>
      <span class="footer-sep">&bull;</span>
      <button class="footer-link" id="showHelpBtn">Help</button>
      <span class="footer-sep">&bull;</span>
      <button class="footer-link" id="showTroubleshootingBtn">Troubleshooting</button>
      <span class="footer-sep">&bull;</span>
      <button class="footer-link" id="showChangelogBtn">Changelog</button>
      <span class="footer-sep">&bull;</span>
      <a href="https://github.com/naxareth/intellegode" class="footer-link">GitHub</a>
    </div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}?n=${nonce}"></script>
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

function renderSimpleMarkdown(md: string): string {
  let html = escapeHtml(md);
  
  // Headers
  html = html.replace(/^###\s+(.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.*$)/gm, '<h1>$1</h1>');
  
  // Bold and Inline Code
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Lists
  html = html.replace(/^\-\s+(.*$)/gm, '<li>$1</li>');
  
  // Line breaks for spacing between paragraphs
  html = html.replace(/\n\n/g, '<br><br>');
  
  return html;
}

function getNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }

  return nonce;
}
