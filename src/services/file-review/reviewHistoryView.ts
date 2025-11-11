/**
 * FileReviewHistoryView - Quản lý và hiển thị lịch sử các kết quả review file.
 *
 * Các function chính:
 * - createOrShow: tạo hoặc hiển thị panel lịch sử review file
 * - refreshContent: cập nhật lại nội dung panel
 * - showReviewResult: hiển thị chi tiết 1 kết quả review file
 * - deleteReviewResult: xóa 1 kết quả review khỏi lịch sử
 * - clearAllResults: xóa toàn bộ lịch sử review file
 * - getWebviewContent: render HTML cho panel lịch sử review file
 */
import * as vscode from 'vscode';
import { FileReviewResultService, FileReviewResultData } from './reviewResultService';

export class FileReviewHistoryView {
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static extensionContext: vscode.ExtensionContext;

    public static createOrShow(context: vscode.ExtensionContext) {
        FileReviewHistoryView.extensionContext = context;
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (FileReviewHistoryView.currentPanel) {
            FileReviewHistoryView.currentPanel.reveal(columnToShowIn);
            FileReviewHistoryView.refreshContent();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'fileReviewHistory',
            'File Review History',
            columnToShowIn || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        FileReviewHistoryView.currentPanel = panel;
        FileReviewHistoryView.refreshContent();

        panel.onDidDispose(() => {
            FileReviewHistoryView.currentPanel = undefined;
        }, null, context.subscriptions);

        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'showReviewResult':
                        FileReviewHistoryView.showReviewResult(message.reviewId);
                        return;
                    case 'deleteReviewResult':
                        FileReviewHistoryView.deleteReviewResult(message.reviewId);
                        return;
                    case 'clearAllResults':
                        FileReviewHistoryView.clearAllResults();
                        return;
                    case 'refreshHistory':
                        FileReviewHistoryView.refreshContent();
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    }

    private static refreshContent() {
        if (!FileReviewHistoryView.currentPanel) {
            return;
        }
    const fileReviewResultService = FileReviewResultService.getInstance();
    const allResults = fileReviewResultService.getAllReviewResults();
    const hasResults = allResults.length > 0;
    FileReviewHistoryView.currentPanel.webview.html = FileReviewHistoryView.getWebviewContent(allResults, hasResults);
    }

    private static showReviewResult(reviewId: string) {
        const fileReviewResultService = FileReviewResultService.getInstance();
        const reviewResult = fileReviewResultService.getReviewResult(reviewId);
        if (!reviewResult) {
            vscode.window.showErrorMessage(`File review result with ID ${reviewId} not found`);
            return;
        }
        const panel = vscode.window.createWebviewPanel(
            'fileReviewResult',
            `File Review Result - ${reviewId}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true
            }
        );
        panel.webview.html = `<pre>${fileReviewResultService.formatReviewResultForDisplay(reviewResult)}</pre>`;
    }

    private static deleteReviewResult(reviewId: string) {
        const fileReviewResultService = FileReviewResultService.getInstance();
        fileReviewResultService.clearReviewResult(reviewId);
        vscode.window.showInformationMessage(`File review result ${reviewId} deleted successfully`);
        FileReviewHistoryView.refreshContent();
    }

    private static clearAllResults() {
        vscode.window.showWarningMessage(
            'Are you sure you want to clear all file review results? This action cannot be undone.',
            'Yes, Clear All',
            'Cancel'
        ).then(selection => {
            if (selection === 'Yes, Clear All') {
                const fileReviewResultService = FileReviewResultService.getInstance();
                fileReviewResultService.clearAllResults();
                vscode.window.showInformationMessage('All file review results cleared successfully');
                FileReviewHistoryView.refreshContent();
            }
        });
    }

    private static getWebviewContent(reviewResults: FileReviewResultData[], hasResults: boolean): string {
        if (!hasResults) {
            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>File Review History</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        .empty-state { text-align: center; padding: 40px 20px; }
        .empty-icon { font-size: 48px; margin-bottom: 16px; }
        .empty-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
        .empty-message { color: #888; margin-bottom: 24px; }
    </style>
</head>
<body>
    <div class="empty-state">
        <div class="empty-icon">📄</div>
        <div class="empty-title">No File Review Results Found</div>
        <div class="empty-message">Review some files to see their history here</div>
    </div>
</body>
</html>`;
        }
        const maxShow = 3;
        const fileItems = reviewResults.slice(0, maxShow).map(r =>
            `<li>${r.fileName} <button onclick="showReviewResult('${r.id}')">View Details</button> <button onclick="deleteReviewResult('${r.id}')">Delete</button></li>`
        ).join('');
        const more = reviewResults.length > maxShow ? `<li>...and ${reviewResults.length - maxShow} more</li>` : '';
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>File Review History</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 24px; }
        .header-actions { display: flex; gap: 10px; }
        ul { padding-left: 20px; }
        li { margin-bottom: 8px; }
        button { margin-left: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📄 File Review History</h1>
        <div class="header-actions">
            <span>${reviewResults.length} result${reviewResults.length !== 1 ? 's' : ''}</span>
            <button onclick="refreshHistory()">🔄 Refresh</button>
            <button onclick="clearAllResults()">🗑️ Clear All</button>
        </div>
    </div>
    <ul>
        ${fileItems}
        ${more}
    </ul>
    <script>
        const vscode = acquireVsCodeApi();
        function showReviewResult(reviewId) {
            vscode.postMessage({ command: 'showReviewResult', reviewId });
        }
        function deleteReviewResult(reviewId) {
            vscode.postMessage({ command: 'deleteReviewResult', reviewId });
        }
        function clearAllResults() {
            vscode.postMessage({ command: 'clearAllResults' });
        }
        function refreshHistory() {
            vscode.postMessage({ command: 'refreshHistory' });
        }
    </script>
</body>
</html>`;
    }
}
