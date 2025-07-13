import * as vscode from 'vscode';
import { SlackService } from './slackService';

export class ReviewResultView {
    private static currentPanel: vscode.WebviewPanel | undefined;

    public static createOrShow(reviewContent: string, context: vscode.ExtensionContext) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (ReviewResultView.currentPanel) {
            ReviewResultView.currentPanel.reveal(column);
            ReviewResultView.currentPanel.webview.html = this.getWebviewContent(reviewContent);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'reviewResult',
            'Code Review Result',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        ReviewResultView.currentPanel = panel;

        // Set the webview's initial html content
        panel.webview.html = this.getWebviewContent(reviewContent);

        // Listen for when the panel is disposed
        panel.onDidDispose(() => {
            ReviewResultView.currentPanel = undefined;
        }, null, context.subscriptions);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'copy':
                        vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Review content copied to clipboard!');
                        return;
                    case 'save':
                        this.saveReviewToFile(message.text);
                        return;
                    case 'slack':
                        ReviewResultView.postToSlack(message.text);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    }

    private static getWebviewContent(reviewContent: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Review Result</title>
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
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .header h1 {
            margin: 0;
            color: var(--vscode-titleBar-activeForeground);
            font-size: 24px;
        }
        .actions {
            margin-top: 10px;
        }
        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            margin-right: 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .btn-slack {
            background-color: #4A154B;
            color: white;
        }
        .btn-slack:hover {
            background-color: #611F69;
        }
        .content {
            max-width: none;
        }
        .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
            color: var(--vscode-titleBar-activeForeground);
            margin-top: 24px;
            margin-bottom: 16px;
        }
        .content h1 { font-size: 20px; }
        .content h2 { font-size: 18px; }
        .content h3 { font-size: 16px; }
        .content p {
            margin-bottom: 16px;
        }
        .content ul, .content ol {
            padding-left: 20px;
            margin-bottom: 16px;
        }
        .content li {
            margin-bottom: 8px;
        }
        .content code {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textPreformat-foreground);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        .content pre {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textPreformat-foreground);
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            line-height: 1.4;
        }
        .content blockquote {
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            background-color: var(--vscode-textBlockQuote-background);
            padding: 8px 16px;
            margin: 16px 0;
            color: var(--vscode-textPreformat-foreground);
        }
        .timestamp {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Code Review Result</h1>
        <div class="actions">
            <button class="btn" onclick="copyToClipboard()">📋 Copy to Clipboard</button>
            <button class="btn" onclick="saveToFile()">💾 Save to File</button>
            ${ReviewResultView.getSlackButtonHtml()}
        </div>
        <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>
    </div>
    
    <div class="content" id="reviewContent">
        ${this.markdownToHtml(reviewContent)}
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function copyToClipboard() {
            const content = document.getElementById('reviewContent').innerText;
            vscode.postMessage({
                command: 'copy',
                text: content
            });
        }
        
        function saveToFile() {
            const content = document.getElementById('reviewContent').innerText;
            vscode.postMessage({
                command: 'save',
                text: content
            });
        }
        
        function postToSlack() {
            const content = document.getElementById('reviewContent').innerText;
            vscode.postMessage({
                command: 'slack',
                text: content
            });
        }
    </script>
</body>
</html>`;
    }

    private static markdownToHtml(markdown: string): string {
        // Simple markdown to HTML conversion
        let html = markdown
            // Headers
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            
            // Bold and italic
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            
            // Code blocks
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            
            // Lists
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
            
            // Line breaks
            .replace(/\n/g, '<br>');

        // Wrap consecutive <li> tags in <ul>
        html = html.replace(/(<li>.*?<\/li>(?:\s*<br>\s*<li>.*?<\/li>)*)/g, '<ul>$1</ul>');
        html = html.replace(/<br>\s*<\/li>/g, '</li>');
        html = html.replace(/<li>\s*<br>/g, '<li>');

        return html;
    }

    private static async saveReviewToFile(content: string) {
        const options: vscode.SaveDialogOptions = {
            saveLabel: 'Save Review',
            filters: {
                'Markdown files': ['md'],
                'Text files': ['txt'],
                'All files': ['*']
            },
            defaultUri: vscode.Uri.file('code-review-' + new Date().toISOString().slice(0, 10) + '.md')
        };

        const fileUri = await vscode.window.showSaveDialog(options);
        if (fileUri) {
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
            vscode.window.showInformationMessage(`Review saved to ${fileUri.fsPath}`);
        }
    }

    /**
     * Get Slack button HTML based on configuration
     */
    private static getSlackButtonHtml(): string {
        const slackService = SlackService.getInstance();
        if (slackService.isSlackConfigured()) {
            return `<button class="btn btn-slack" onclick="postToSlack()">📤 Post to Slack</button>`;
        }
        return '';
    }

    /**
     * Post review content to Slack
     */
    private static async postToSlack(content: string): Promise<void> {
        const slackService = SlackService.getInstance();
        
        if (!slackService.isSlackConfigured()) {
            const result = await vscode.window.showInformationMessage(
                'Slack webhook integration is not configured. Would you like to set it up?',
                'Open Settings',
                'Cancel'
            );
            
            if (result === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'premergeReview.slack');
            }
            return;
        }

        try {
            // Post to Slack with progress indicator
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Posting to Slack...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Preparing message...' });
                
                const success = await slackService.postReviewToSlack(content);
                
                progress.report({ increment: 100, message: 'Complete!' });
                
                if (!success) {
                    throw new Error('Failed to post to Slack');
                }
            });
        } catch (error) {
            console.error('Error posting to Slack:', error);
            vscode.window.showErrorMessage(
                `Failed to post to Slack: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
