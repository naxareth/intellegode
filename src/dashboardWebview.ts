import * as vscode from 'vscode';
import { ConceptStats, StreakData, QuizRecord } from './types';

export function getDashboardWebviewHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	conceptStats: ConceptStats[],
	streakData: StreakData,
	recentHistory: QuizRecord[],
	version: string
): string {
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'styles.css'));
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'dashboard.js'));
	const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'images', 'logo.png'));
	const logoTitleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'images', 'logo_title.png'));

	const nonce = getNonce();

	const hasHistory = recentHistory.length > 0;

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<!--
		Use a content security policy to only allow loading styles from our extension directory,
		and only allow scripts that have a specific nonce.
	-->
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="${styleUri}" rel="stylesheet">
	<title>Intellegode Progress</title>
</head>
<body>
	<div class="dashboard-container" id="dashboardContent">
		<div class="header dashboard-header">
			<div class="logo">
				<img src="${logoUri}" alt="Intellegode Logo" width="28" height="28" />
			</div>
			<div class="brand">
				<img src="${logoTitleUri}" alt="Intellegode" height="14" style="margin-top: 2px;" />
				<span class="version">v${version}</span>
			</div>
			<div style="margin-left: auto; font-size: 11px; opacity: 0.7;">Concept Debt Tracker</div>
		</div>

		${!hasHistory ? `
			<div class="empty-state">No quiz data yet. Start a quiz with Ctrl+Alt+Q to begin tracking your progress.</div>
		` : `
			<div class="streak-card">
				<div class="streak-card-header">Activity</div>
				<div class="streak-card-body">
					<div class="streak-stat">
						<div class="streak-number">${streakData.currentStreak}</div>
						<div class="streak-label">day streak</div>
					</div>
					<div class="streak-stat-secondary">
						<div>Longest streak: <strong>${streakData.longestStreak}</strong></div>
						<div>Total questions: <strong>${streakData.totalQuestions}</strong></div>
						<div>Total sessions: <strong>${streakData.totalSessions}</strong></div>
					</div>
				</div>
			</div>

			<div class="dashboard-section">
				<h3>Concept Weakness</h3>
				<div class="concept-table">
					${conceptStats.length === 0 ? '<div class="concept-empty">No concept data available yet.</div>' : 
						conceptStats.map(stat => {
							const percent = Math.round(stat.missRate * 100);
							const colorClass = percent < 30 ? 'low' : percent < 60 ? 'medium' : 'high';
							const formatConcept = stat.concept.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
							const lastReviewDate = new Date(stat.lastReviewedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
							
							return `
								<div class="concept-row">
									<div class="concept-info">
										<div class="concept-name">${formatConcept}</div>
										<div class="concept-meta">${stat.missedIt} / ${stat.total} missed • Last seen ${lastReviewDate}</div>
									</div>
									<div class="concept-bar">
										<div class="concept-bar-fill ${colorClass}" style="width: ${Math.max(5, percent)}%"></div>
									</div>
									<div class="concept-percent">${percent}%</div>
								</div>
							`;
						}).join('')
					}
				</div>
			</div>

			<div class="dashboard-section">
				<h3>Recent History</h3>
				<div class="history-list">
					${recentHistory.map(record => {
						const gradeClass = record.selfGrade === 'got-it' ? 'got-it' : 'missed-it';
						const gradeText = record.selfGrade === 'got-it' ? 'GOT IT' : 'MISSED';
						const questionTrunc = record.question.length > 80 ? record.question.substring(0, 80) + '...' : record.question;
						const date = new Date(record.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
						
						return `
							<div class="history-item">
								<div class="history-header">
									<span class="history-badge ${gradeClass}">${gradeText}</span>
									<span class="history-date">${date}</span>
								</div>
								<div class="history-question">${escapeHtml(questionTrunc)}</div>
								<div class="history-tags">
									${record.conceptTags.map(tag => `<span class="concept-pill">${tag.replace(/-/g, ' ')}</span>`).join('')}
								</div>
							</div>
						`;
					}).join('')}
				</div>
			</div>

			<div class="dashboard-footer">
				<button id="clearHistoryBtn" class="clear-btn">Clear History</button>
			</div>
		`}
	</div>

	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function escapeHtml(unsafe: string) {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
