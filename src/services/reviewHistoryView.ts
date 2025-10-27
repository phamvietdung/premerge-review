import * as vscode from 'vscode';
import { ReviewResultService, ReviewResultData } from './reviewResultService';
import { DiffViewerService } from './diffViewerService';
import { ReviewDataService } from './reviewDataService';

export class ReviewHistoryView {
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static extensionContext: vscode.ExtensionContext;

    public static createOrShow(context: vscode.ExtensionContext) {
        // Store context for later use
        ReviewHistoryView.extensionContext = context;
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (ReviewHistoryView.currentPanel) {
            ReviewHistoryView.currentPanel.reveal(columnToShowIn);
            ReviewHistoryView.refreshContent();
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            'reviewHistory',
            'Review History',
            columnToShowIn || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        ReviewHistoryView.currentPanel = panel;

        // Set the webview's initial html content
        ReviewHistoryView.refreshContent();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        panel.onDidDispose(() => {
            ReviewHistoryView.currentPanel = undefined;
        }, null, context.subscriptions);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'showReviewResult':
                        ReviewHistoryView.showReviewResult(message.reviewId);
                        return;
                    case 'viewDiff':
                        ReviewHistoryView.viewDiff(message.reviewId);
                        return;
                    case 'deleteReviewResult':
                        ReviewHistoryView.deleteReviewResult(message.reviewId);
                        return;
                    case 'clearAllResults':
                        ReviewHistoryView.clearAllResults();
                        return;
                    case 'refreshHistory':
                        ReviewHistoryView.refreshContent();
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    }

    private static refreshContent() {
        if (!ReviewHistoryView.currentPanel) {
            return;
        }

        const reviewResultService = ReviewResultService.getInstance();
        const allResults = reviewResultService.getAllReviewResults();
        const hasResults = allResults.length > 0;

        ReviewHistoryView.currentPanel.webview.html = ReviewHistoryView.getWebviewContent(allResults, hasResults);
    }

    private static showReviewResult(reviewId: string) {
        const reviewResultService = ReviewResultService.getInstance();
        const reviewResult = reviewResultService.getReviewResult(reviewId);
        
        if (!reviewResult) {
            vscode.window.showErrorMessage(`Review result with ID ${reviewId} not found`);
            return;
        }

        // Create a new panel to show the specific review result
        const panel = vscode.window.createWebviewPanel(
            'reviewResult',
            `Review Result - ${reviewId}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true
            }
        );

        const formattedContent = reviewResultService.formatReviewResultForDisplay(reviewResult);
        panel.webview.html = ReviewHistoryView.getReviewResultContent(formattedContent);
    }

    private static async viewDiff(reviewId: string) {
        try {
            const reviewResultService = ReviewResultService.getInstance();
            const reviewResult = reviewResultService.getReviewResult(reviewId);
            
            if (!reviewResult) {
                vscode.window.showErrorMessage(`Review result with ID ${reviewId} not found`);
                return;
            }

            // Check if we have diff content
            if (!reviewResult.reviewData.diff) {
                vscode.window.showWarningMessage(
                    `No diff content available for review ${reviewId.substring(0, 8)}...`,
                    'View Review Result'
                ).then(selection => {
                    if (selection === 'View Review Result') {
                        ReviewHistoryView.showReviewResult(reviewId);
                    }
                });
                return;
            }

            // Create ReviewData object for DiffViewerService
            const reviewData = {
                currentBranch: reviewResult.reviewData.currentBranch,
                baseBranch: reviewResult.reviewData.baseBranch,
                selectedCommit: reviewResult.reviewData.selectedCommit,
                diff: reviewResult.reviewData.diff,
                diffSummary: {
                    files: [], // DiffViewerService will parse this from diff
                    insertions: reviewResult.reviewData.diffSummary.insertions,
                    deletions: reviewResult.reviewData.diffSummary.deletions
                },
                createdAt: reviewResult.timestamp
            };

            // Use DiffViewerService to show the diff
            const diffViewerService = DiffViewerService.getInstance();
            await diffViewerService.showDiffViewer(reviewData, ReviewHistoryView.extensionContext);

        } catch (error) {
            console.error('Error viewing diff:', error);
            vscode.window.showErrorMessage(`Failed to view diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private static deleteReviewResult(reviewId: string) {
        const reviewResultService = ReviewResultService.getInstance();
        const success = reviewResultService.clearReviewResult(reviewId);
        
        if (success) {
            vscode.window.showInformationMessage(`Review result ${reviewId} deleted successfully`);
            ReviewHistoryView.refreshContent();
        } else {
            vscode.window.showErrorMessage(`Failed to delete review result ${reviewId}`);
        }
    }

    private static clearAllResults() {
        vscode.window.showWarningMessage(
            'Are you sure you want to clear all review results? This action cannot be undone.',
            'Yes, Clear All',
            'Cancel'
        ).then(selection => {
            if (selection === 'Yes, Clear All') {
                const reviewResultService = ReviewResultService.getInstance();
                reviewResultService.clearAllResults();
                vscode.window.showInformationMessage('All review results cleared successfully');
                ReviewHistoryView.refreshContent();
            }
        });
    }

    private static getWebviewContent(reviewResults: ReviewResultData[], hasResults: boolean): string {
        if (!hasResults) {
            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Review History</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .empty-state {
            text-align: center;
            padding: 40px 20px;
        }
        .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        .empty-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .empty-message {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 24px;
        }
    </style>
</head>
<body>
    <div class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-title">No Review Results Found</div>
        <div class="empty-message">Process some reviews to see their history here</div>
    </div>
</body>
</html>`;
        }

        const resultItems = reviewResults.map(result => {
            // Create better branch comparison display: source → target
            // Always show current branch → target branch (not commit ID)
            const branchDisplay = `${result.reviewData.currentBranch} → ${result.reviewData.baseBranch}`;
            
            const isMultiPart = result.reviewResults.isMultiPart;
            const partsInfo = isMultiPart && result.reviewResults.parts 
                ? ` (${result.reviewResults.parts.length} parts)`
                : '';

            // Get file count - handle both array and number format
            const fileCount = Array.isArray(result.reviewData.diffSummary.files) 
                ? result.reviewData.diffSummary.files.length 
                : result.reviewData.diffSummary.files || 0;

            // Add commit info as subtitle if comparing from specific commit
            const commitInfo = result.reviewData.selectedCommit 
                ? `<div class="commit-info">📌 From commit: ${result.reviewData.selectedCommit.substring(0, 8)}</div>`
                : '';

            return `
                <div class="result-item">
                    <div class="result-header">
                        <div class="result-title">
                            <strong>${branchDisplay}</strong>
                            ${isMultiPart ? '<span class="multi-part-badge">Multi-Part</span>' : ''}
                        </div>
                        <div class="result-meta">
                            <span class="result-time">${result.timestamp.toLocaleString()}</span>
                            <span class="result-id">${result.id}</span>
                        </div>
                    </div>
                    ${commitInfo}
                    <div class="result-summary">
                        ${result.reviewResults.summary}${partsInfo}
                    </div>
                    <div class="result-stats">
                        <span class="stat">📁 ${fileCount} files</span>
                        <span class="stat">➕ ${result.reviewData.diffSummary.insertions}</span>
                        <span class="stat">➖ ${result.reviewData.diffSummary.deletions}</span>
                    </div>
                    <div class="result-actions">
                        <button onclick="showReviewResult('${result.id}')" class="btn btn-primary">View Details</button>
                        <button onclick="viewDiff('${result.id}')" class="btn btn-secondary">View Diff</button>
                        <button onclick="deleteReviewResult('${result.id}')" class="btn btn-danger">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Review History</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .header h1 {
            margin: 0;
            color: var(--vscode-titleBar-activeForeground);
            font-size: 24px;
        }
        .header-actions {
            display: flex;
            gap: 10px;
        }
        .result-item {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 16px;
        }
        .result-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
        }
        .result-title {
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .multi-part-badge {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 10px;
            font-weight: normal;
        }
        .result-meta {
            text-align: right;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .result-time {
            display: block;
        }
        .result-id {
            display: block;
            font-family: monospace;
            margin-top: 2px;
        }
        .commit-info {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin: 4px 0;
            font-style: italic;
        }
        .result-summary {
            margin: 8px 0;
            color: var(--vscode-foreground);
            font-size: 14px;
        }
        .result-stats {
            display: flex;
            gap: 16px;
            margin: 8px 0;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .stat {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .result-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }
        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
        }
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .btn-danger {
            background-color: #dc3545;
            color: white;
        }
        .btn-danger:hover {
            background-color: #c82333;
        }
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .count-info {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📋 Review History</h1>
        <div class="header-actions">
            <span class="count-info">${reviewResults.length} result${reviewResults.length !== 1 ? 's' : ''}</span>
            <button onclick="refreshHistory()" class="btn btn-secondary">🔄 Refresh</button>
            <button onclick="clearAllResults()" class="btn btn-danger">🗑️ Clear All</button>
        </div>
    </div>
    
    <div class="results-container">
        ${resultItems}
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function showReviewResult(reviewId) {
            vscode.postMessage({
                command: 'showReviewResult',
                reviewId: reviewId
            });
        }
        
        function viewDiff(reviewId) {
            vscode.postMessage({
                command: 'viewDiff',
                reviewId: reviewId
            });
        }
        
        function deleteReviewResult(reviewId) {
            vscode.postMessage({
                command: 'deleteReviewResult',
                reviewId: reviewId
            });
        }
        
        function clearAllResults() {
            vscode.postMessage({
                command: 'clearAllResults'
            });
        }
        
        function refreshHistory() {
            vscode.postMessage({
                command: 'refreshHistory'
            });
        }
    </script>
</body>
</html>`;
    }

    private static getReviewResultContent(content: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Review Result Details</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
            max-width: none;
        }
        h1, h2, h3, h4, h5, h6 {
            color: var(--vscode-titleBar-activeForeground);
            margin-top: 24px;
            margin-bottom: 12px;
        }
        h1 { font-size: 28px; }
        h2 { font-size: 22px; }
        h3 { font-size: 18px; }
        code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', Courier, monospace;
        }
        pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            border: 1px solid var(--vscode-panel-border);
        }
        pre code {
            background: none;
            padding: 0;
        }
        ul, ol {
            padding-left: 20px;
        }
        li {
            margin-bottom: 4px;
        }
        strong {
            font-weight: 600;
        }
        hr {
            border: none;
            border-top: 1px solid var(--vscode-panel-border);
            margin: 24px 0;
        }
        .timestamp {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="content">
        ${this.markdownToHtml(content)}
    </div>
    <div class="timestamp">Opened: ${new Date().toLocaleString()}</div>
</body>
</html>`;
    }

    private static markdownToHtml(markdown: string): string {
        return markdown
            // Headers
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            
            // Bold and italic
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            
            // Code blocks
            .replace(/```([^`]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            
            // Lists
            .replace(/^\* (.+)$/gm, '<li>$1</li>')
            .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            
            // Horizontal rules
            .replace(/^---$/gm, '<hr>')
            
            // Wrap in paragraphs
            .replace(/^(?!<[h|u|p|l])(.+)$/gm, '<p>$1</p>');
    }
}
