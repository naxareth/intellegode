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

var clearBtn = document.getElementById('clearHistoryBtn');
if (clearBtn) {
  clearBtn.addEventListener('click', function() {
    if (confirm('Clear all quiz history? This cannot be undone.')) {
      postToExtension({ command: 'clearHistory' });
    }
  });
}

window.addEventListener('message', function(event) {
  var msg = event.data || {};
  if (msg.command === 'historyCleared') {
    var dashboardContent = document.getElementById('dashboardContent');
    if (dashboardContent) {
      dashboardContent.innerHTML = '<div class="empty-state">History cleared. Start a new quiz to begin tracking again.</div>';
    }
  }
});
