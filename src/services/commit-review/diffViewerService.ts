/**
 * DiffViewerService - Hiển thị và xử lý giao diện so sánh diff code.
 *
 * Các function chính:
 * - getInstance: singleton instance cho service
 * - showDiffViewer: tạo hoặc hiển thị panel diff, render nội dung diff
 * - processDiffData: parse raw diff string thành cấu trúc dữ liệu file/hunk/line
 * - generateDiffViewerHtml: render HTML cho panel diff
 * - generateFileListHTML: render danh sách file thay đổi
 * - generateDiffContentHTML: render nội dung diff từng file
 * - generateHunkLinesHTML: render từng dòng diff trong hunk
 * - getDisplayFileName: lấy tên file hiển thị
 * - getFileIcon: lấy icon phù hợp cho file
 * - handleWebviewMessage: xử lý message từ webview (export, refresh)
 * - exportDiffToFile: xuất diff ra file
 * - escapeHtml: escape ký tự HTML đặc biệt
 * - getDiffViewerCSS: trả về CSS cho panel diff
 * - getDiffViewerJS: trả về JS cho panel diff
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { ReviewData } from './gitReviewDataService';

export interface DiffViewOptions {
    showLineNumbers?: boolean;
    highlightChanges?: boolean;
    splitView?: boolean;
}

export interface DiffFile {
    oldPath: string;
    newPath: string;
    hunks: DiffHunk[];
    additions: number;
    deletions: number;
    isNew: boolean;
    isDeleted: boolean;
    isBinary: boolean;
}

export interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    context: string;
    lines: DiffLine[];
}

export interface DiffLine {
    type: 'addition' | 'deletion' | 'context';
    content: string;
    oldLineNo: number | null;
    newLineNo: number | null;
}

export class DiffViewerService {
    private static instance: DiffViewerService;
    private panel: vscode.WebviewPanel | undefined;
    private options: DiffViewOptions = {
        showLineNumbers: false, // Default to hide line numbers
        highlightChanges: true,
        splitView: false
    };

    private constructor() {}

    public static getInstance(): DiffViewerService {
        if (!DiffViewerService.instance) {
            DiffViewerService.instance = new DiffViewerService();
        }
        return DiffViewerService.instance;
    }

    /**
     * Show diff viewer with review data
     */
    public async showDiffViewer(
        reviewData: ReviewData, 
        context: vscode.ExtensionContext,
        options: DiffViewOptions = {}
    ): Promise<void> {
        this.options = { ...this.options, ...options };

        // Create or show webview panel
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'diffViewer',
                '🔍 Code Review - Diff Viewer',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.file(path.join(context.extensionPath, 'media'))
                    ]
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });

            // Handle messages from webview
            this.panel.webview.onDidReceiveMessage(
                message => this.handleWebviewMessage(message, reviewData, context),
                undefined,
                context.subscriptions
            );
        }

        // Process diff data and generate HTML
        const diffData = this.processDiffData(reviewData.diff);
        this.panel.webview.html = this.generateDiffViewerHtml(reviewData, diffData, context);
    }

    /**
     * Process raw diff data into structured format
     */
    private processDiffData(rawDiff: string): DiffFile[] {
        const files: DiffFile[] = [];
        const diffLines = rawDiff.split('\n');
        let currentFile: DiffFile | null = null;
        let currentHunk: DiffHunk | null = null;
        let oldLineNo = 0;
        let newLineNo = 0;

        for (let i = 0; i < diffLines.length; i++) {
            const line = diffLines[i];

            // File header
            if (line.startsWith('diff --git')) {
                if (currentFile) {
                    if (currentHunk) currentFile.hunks.push(currentHunk);
                    files.push(currentFile);
                }
                
                const fileMatch = line.match(/diff --git a\/(.*?) b\/(.*?)$/);
                currentFile = {
                    oldPath: fileMatch?.[1] || '',
                    newPath: fileMatch?.[2] || '',
                    hunks: [],
                    additions: 0,
                    deletions: 0,
                    isNew: false,
                    isDeleted: false,
                    isBinary: false
                };
                currentHunk = null;
            }
            // New file mode
            else if (line.startsWith('new file mode')) {
                if (currentFile) currentFile.isNew = true;
            }
            // Deleted file mode
            else if (line.startsWith('deleted file mode')) {
                if (currentFile) currentFile.isDeleted = true;
            }
            // Binary file indicator
            else if (line.includes('Binary files') && line.includes('differ')) {
                if (currentFile) currentFile.isBinary = true;
            }
            // Hunk header
            else if (line.startsWith('@@')) {
                if (currentHunk && currentFile) {
                    currentFile.hunks.push(currentHunk);
                }
                
                const hunkMatch = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@(.*)?/);
                if (hunkMatch) {
                    oldLineNo = parseInt(hunkMatch[1]);
                    newLineNo = parseInt(hunkMatch[3]);
                    
                    currentHunk = {
                        oldStart: oldLineNo,
                        oldLines: parseInt(hunkMatch[2] || '1'),
                        newStart: newLineNo,
                        newLines: parseInt(hunkMatch[4] || '1'),
                        context: hunkMatch[5]?.trim() || '',
                        lines: []
                    };
                }
            }
            // Content lines
            else if (currentHunk && currentFile && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
                const type = line[0] === '+' ? 'addition' : 
                           line[0] === '-' ? 'deletion' : 'context';
                
                const diffLine: DiffLine = {
                    type,
                    content: line.substring(1),
                    oldLineNo: type !== 'addition' ? oldLineNo : null,
                    newLineNo: type !== 'deletion' ? newLineNo : null
                };

                currentHunk.lines.push(diffLine);

                if (type === 'addition') {
                    currentFile.additions++;
                    newLineNo++;
                } else if (type === 'deletion') {
                    currentFile.deletions++;
                    oldLineNo++;
                } else {
                    oldLineNo++;
                    newLineNo++;
                }
            }
        }

        // Add last file and hunk
        if (currentHunk && currentFile) {
            currentFile.hunks.push(currentHunk);
        }
        if (currentFile) {
            files.push(currentFile);
        }

        return files;
    }

    /**
     * Generate HTML for diff viewer
     */
    private generateDiffViewerHtml(
        reviewData: ReviewData, 
        diffData: DiffFile[],
        context: vscode.ExtensionContext
    ): string {
        const totalAdditions = diffData.reduce((sum, file) => sum + file.additions, 0);
        const totalDeletions = diffData.reduce((sum, file) => sum + file.deletions, 0);
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diff Viewer</title>
    <style>${this.getDiffViewerCSS()}</style>
</head>
<body>
    <div class="diff-viewer-container">
        <div class="diff-header">
            <h2>🔍 Code Review - Diff Viewer</h2>
            <div class="diff-summary">
                <div class="branch-info">
                    <strong>${reviewData.currentBranch}</strong> 
                    ${reviewData.selectedCommit ? 
                        `from commit <code>${reviewData.selectedCommit.substring(0, 8)}</code>` : 
                        `compared to <strong>${reviewData.baseBranch}</strong>`
                    }
                </div>
                <div class="stats-info">
                    <span class="file-count">${diffData.length} files changed</span>
                    <span class="additions">+${totalAdditions}</span>
                    <span class="deletions">-${totalDeletions}</span>
                </div>
            </div>
            <div class="diff-controls">
                <button id="exportDiff" class="control-btn">💾 Export Diff</button>
                <button id="refreshDiff" class="control-btn">🔄 Refresh</button>
            </div>
        </div>
        
        <div class="diff-body">
            <div class="file-list">
                ${this.generateFileListHTML(diffData)}
            </div>

            <div class="diff-content" id="diffContent">
                ${this.generateDiffContentHTML(diffData)}
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        ${this.getDiffViewerJS()}
    </script>
</body>
</html>`;
    }

    /**
     * Generate file list HTML
     */
    private generateFileListHTML(files: DiffFile[]): string {
        return `
        <div class="file-tree">
            <h3>📂 Changed Files (${files.length})</h3>
            <ul class="file-tree-list expanded">
                ${files.map((file, index) => `
                    <li class="file-item expanded" data-file-index="${index}">
                        <div class="file-item-content">
                            <span class="file-icon">${this.getFileIcon(file.newPath || file.oldPath)}</span>
                            <span class="file-name" title="${file.newPath || file.oldPath}">
                                ${this.getDisplayFileName(file)}
                            </span>
                            <div class="file-badges">
                                ${file.isNew ? '<span class="badge badge-new">NEW</span>' : ''}
                                ${file.isDeleted ? '<span class="badge badge-deleted">DELETED</span>' : ''}
                                ${file.isBinary ? '<span class="badge badge-binary">BINARY</span>' : ''}
                            </div>
                        </div>
                        <div class="file-changes">
                            ${!file.isBinary ? `
                                <span class="additions">+${file.additions}</span>
                                <span class="deletions">-${file.deletions}</span>
                            ` : '<span class="binary-indicator">Binary</span>'}
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>`;
    }

    /**
     * Generate diff content HTML
     */
    private generateDiffContentHTML(diffData: DiffFile[]): string {
        return diffData.map((file, fileIndex) => `
            <div class="file-diff" id="file-${fileIndex}">
                <div class="file-header">
                    <div class="file-title">
                        <h4>${this.getDisplayFileName(file)}</h4>
                        <div class="file-path">${file.newPath || file.oldPath}</div>
                    </div>
                    <div class="file-stats">
                        ${!file.isBinary ? `
                            <span class="additions">+${file.additions}</span>
                            <span class="deletions">-${file.deletions}</span>
                        ` : '<span class="binary-text">Binary file</span>'}
                    </div>
                </div>
                
                ${file.isBinary ? `
                    <div class="binary-file-notice">
                        <div class="binary-icon">📁</div>
                        <div class="binary-message">
                            <strong>Binary file</strong><br>
                            Binary files cannot be displayed in diff viewer.
                        </div>
                    </div>
                ` : file.hunks.map((hunk, hunkIndex) => `
                    <div class="hunk" data-hunk="${hunkIndex}">
                        <div class="hunk-header">
                            <span class="hunk-info">
                                @@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@
                            </span>
                            ${hunk.context ? `<span class="hunk-context">${this.escapeHtml(hunk.context)}</span>` : ''}
                        </div>
                        <div class="hunk-content ${this.options.splitView ? 'split-view' : 'unified-view'}">
                            ${this.generateHunkLinesHTML(hunk.lines)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');
    }

    /**
     * Generate hunk lines HTML
     */
    private generateHunkLinesHTML(lines: DiffLine[]): string {
        return lines.map(line => {
            const lineClass = `line line-${line.type}`;
            const lineNumbers = this.options.showLineNumbers ? 
                `<span class="line-number old">${line.oldLineNo || ''}</span>
                 <span class="line-number new">${line.newLineNo || ''}</span>` : '';
            
            const marker = line.type === 'addition' ? '+' : 
                         line.type === 'deletion' ? '-' : ' ';
            
            return `
                <div class="${lineClass}">
                    ${lineNumbers}
                    <span class="line-marker">${marker}</span>
                    <span class="line-content">${this.escapeHtml(line.content)}</span>
                </div>
            `;
        }).join('');
    }

    /**
     * Get display file name
     */
    private getDisplayFileName(file: DiffFile): string {
        if (file.isDeleted) {
            return file.oldPath;
        } else if (file.isNew) {
            return file.newPath;
        } else if (file.oldPath !== file.newPath) {
            return `${file.oldPath} → ${file.newPath}`;
        } else {
            return file.newPath;
        }
    }

    /**
     * Get file icon based on extension
     */
    private getFileIcon(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const iconMap: Record<string, string> = {
            '.ts': '📘', '.tsx': '📘',
            '.js': '📜', '.jsx': '📜',
            '.json': '📋',
            '.md': '📝',
            '.html': '🌐', '.htm': '🌐',
            '.css': '🎨', '.scss': '🎨', '.sass': '🎨',
            '.py': '🐍',
            '.java': '☕',
            '.cpp': '⚙️', '.c': '⚙️', '.h': '⚙️',
            '.php': '🐘',
            '.rb': '💎',
            '.go': '🐹',
            '.rs': '🦀',
            '.xml': '📄',
            '.yml': '📄', '.yaml': '📄',
            '.sql': '🗄️',
            '.sh': '📜', '.bash': '📜',
            '.dockerfile': '🐳',
            '.gitignore': '🙈',
            '.env': '🔧'
        };
        return iconMap[ext] || '📄';
    }

    /**
     * Handle messages from webview
     */
    private async handleWebviewMessage(
        message: any, 
        reviewData: ReviewData, 
        context: vscode.ExtensionContext
    ): Promise<void> {
        switch (message.command) {
            case 'exportDiff':
                await this.exportDiffToFile(reviewData);
                break;

            case 'refreshDiff':
                // Refresh the diff data
                const newDiffData = this.processDiffData(reviewData.diff);
                this.panel!.webview.html = this.generateDiffViewerHtml(reviewData, newDiffData, context);
                vscode.window.showInformationMessage('Diff viewer refreshed');
                break;
        }
    }

    /**
     * Export diff to file
     */
    private async exportDiffToFile(reviewData: ReviewData): Promise<void> {
        try {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const fileName = `${reviewData.currentBranch}-vs-${reviewData.baseBranch}-${timestamp}.diff`;
            
            const options: vscode.SaveDialogOptions = {
                defaultUri: vscode.Uri.file(fileName),
                filters: {
                    'Diff files': ['diff', 'patch'],
                    'Text files': ['txt'],
                    'All files': ['*']
                }
            };

            const fileUri = await vscode.window.showSaveDialog(options);
            if (fileUri) {
                await vscode.workspace.fs.writeFile(fileUri, Buffer.from(reviewData.diff, 'utf8'));
                vscode.window.showInformationMessage(`✅ Diff exported to ${path.basename(fileUri.fsPath)}`);
            }
        } catch (error) {
            console.error('Error exporting diff:', error);
            vscode.window.showErrorMessage(`❌ Failed to export diff: ${error}`);
        }
    }

    /**
     * Escape HTML characters
     */
    private escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    /**
     * Get CSS for diff viewer
     */
    private getDiffViewerCSS(): string {
        return `
        :root {
            --color-addition: #28a745;
            --color-deletion: #dc3545;
            --color-addition-bg: rgba(40, 167, 69, 0.15);
            --color-deletion-bg: rgba(220, 53, 69, 0.15);
            --color-border: var(--vscode-panel-border);
            --color-bg-secondary: var(--vscode-panel-background);
        }

        * {
            box-sizing: border-box;
        }

        body {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            margin: 0;
            padding: 0;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            overflow: hidden;
        }

        .diff-viewer-container {
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .diff-header {
            padding: 16px 20px;
            border-bottom: 2px solid var(--color-border);
            background: var(--color-bg-secondary);
            flex-shrink: 0;
        }

        .diff-header h2 {
            margin: 0 0 12px 0;
            font-size: 18px;
            font-weight: 600;
        }

        .diff-summary {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 8px 0 16px 0;
            font-size: 14px;
        }

        .branch-info {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .branch-info code {
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
        }

        .stats-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .file-count {
            font-weight: 500;
        }

        .additions {
            color: var(--color-addition);
            font-weight: 600;
        }

        .deletions {
            color: var(--color-deletion);
            font-weight: 600;
        }

        .diff-controls {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .control-btn {
            padding: 8px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
        }

        .control-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .control-btn.active {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .diff-body {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        .file-list {
            width: 300px;
            flex-shrink: 0;
            border-right: 1px solid var(--color-border);
            background: var(--vscode-sideBar-background);
            overflow-y: auto;
        }

        .file-tree {
            padding: 16px;
        }

        .file-tree h3 {
            margin: 0 0 12px 0;
            font-size: 14px;
            font-weight: 600;
        }

        .file-tree-controls {
            display: flex;
            gap: 6px;
            margin-bottom: 12px;
        }

        .tree-control-btn {
            padding: 4px 8px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
        }

        .tree-control-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .file-tree-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .file-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 4px;
            cursor: pointer;
            border-radius: 4px;
            margin-bottom: 2px;
            transition: background-color 0.15s ease;
        }

        .file-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .file-item-content {
            display: flex;
            align-items: center;
            flex: 1;
            min-width: 0;
        }

        .file-icon {
            margin-right: 8px;
            width: 16px;
            flex-shrink: 0;
        }

        .file-name {
            font-size: 13px;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .file-badges {
            display: flex;
            gap: 4px;
            margin-left: 8px;
        }

        .badge {
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .badge-new {
            background: rgba(40, 167, 69, 0.2);
            color: var(--color-addition);
        }

        .badge-deleted {
            background: rgba(220, 53, 69, 0.2);
            color: var(--color-deletion);
        }

        .badge-binary {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }

        .file-changes {
            display: flex;
            gap: 6px;
            font-size: 11px;
            flex-shrink: 0;
        }

        .binary-indicator {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .diff-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }

        .file-diff {
            margin-bottom: 32px;
            border: 1px solid var(--color-border);
            border-radius: 6px;
            background: var(--vscode-editor-background);
        }

        .file-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 16px 20px;
            background: var(--color-bg-secondary);
            border-bottom: 1px solid var(--color-border);
        }

        .file-title h4 {
            margin: 0 0 4px 0;
            font-size: 15px;
            font-weight: 600;
        }

        .file-path {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-family: monospace;
        }

        .file-stats {
            display: flex;
            gap: 8px;
            font-size: 12px;
            align-items: center;
        }

        .binary-file-notice {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            text-align: center;
            background: var(--vscode-editor-background);
        }

        .binary-icon {
            font-size: 48px;
            margin-right: 16px;
        }

        .binary-message {
            color: var(--vscode-descriptionForeground);
        }

        .binary-text {
            color: var(--vscode-descriptionForeground);
        }

        .hunk {
            margin: 0;
        }

        .hunk-header {
            display: flex;
            align-items: center;
            padding: 8px 16px;
            background: var(--vscode-textCodeBlock-background);
            font-family: monospace;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            border-bottom: 1px solid var(--color-border);
        }

        .hunk-info {
            font-weight: 600;
            margin-right: 16px;
        }

        .hunk-context {
            color: var(--vscode-editor-foreground);
        }

        .hunk-content {
            background: var(--vscode-editor-background);
        }

        .line {
            display: flex;
            align-items: flex-start;
            font-size: 13px;
            line-height: 1.4;
            min-height: 20px;
        }

        .line-addition {
            background: var(--color-addition-bg);
            border-left: 3px solid var(--color-addition);
        }

        .line-deletion {
            background: var(--color-deletion-bg);
            border-left: 3px solid var(--color-deletion);
        }

        .line-context {
            background: transparent;
            border-left: 3px solid transparent;
        }

        .line-number {
            display: inline-block;
            width: 50px;
            text-align: right;
            padding: 2px 8px;
            color: var(--vscode-editorLineNumber-foreground);
            font-size: 11px;
            background: var(--vscode-editorGutter-background);
            border-right: 1px solid var(--color-border);
            user-select: none;
        }

        .line-marker {
            display: inline-block;
            width: 20px;
            text-align: center;
            padding: 2px;
            font-weight: bold;
            user-select: none;
        }

        .line-addition .line-marker {
            color: var(--color-addition);
        }

        .line-deletion .line-marker {
            color: var(--color-deletion);
        }

        .line-content {
            flex: 1;
            padding: 2px 8px;
            white-space: pre;
            word-break: break-all;
            overflow-wrap: break-word;
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar {
            width: 12px;
            height: 12px;
        }

        ::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
        }

        ::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 6px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground);
        }
        `;
    }

    /**
     * Get JavaScript for diff viewer
     */
    private getDiffViewerJS(): string {
        return `
        // File navigation
        document.addEventListener('click', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                const fileIndex = fileItem.dataset.fileIndex;
                const fileElement = document.getElementById('file-' + fileIndex);
                if (fileElement) {
                    fileElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    
                    // Highlight the target file briefly
                    fileElement.style.boxShadow = '0 0 10px var(--vscode-focusBorder)';
                    setTimeout(() => {
                        fileElement.style.boxShadow = '';
                    }, 2000);
                }
                
                // Update active state
                document.querySelectorAll('.file-item').forEach(item => {
                    item.classList.remove('active');
                });
                fileItem.classList.add('active');
            }
        });

        // Control buttons
        document.getElementById('exportDiff')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'exportDiff' });
        });

        document.getElementById('refreshDiff')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'refreshDiff' });
        });

        // Auto-expand all files on load
        document.querySelectorAll('.file-diff').forEach(el => {
            el.style.display = 'block';
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        vscode.postMessage({ command: 'exportDiff' });
                        break;
                    case 'r':
                        e.preventDefault();
                        vscode.postMessage({ command: 'refreshDiff' });
                        break;
                }
            }
            
            // Arrow key navigation
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                const files = document.querySelectorAll('.file-diff');
                const activeFile = document.querySelector('.file-item.active');
                if (activeFile && files.length > 1) {
                    const currentIndex = parseInt(activeFile.dataset.fileIndex);
                    let nextIndex;
                    
                    if (e.key === 'ArrowDown') {
                        nextIndex = (currentIndex + 1) % files.length;
                    } else {
                        nextIndex = currentIndex === 0 ? files.length - 1 : currentIndex - 1;
                    }
                    
                    const nextFileItem = document.querySelector(\`[data-file-index="\${nextIndex}"]\`);
                    if (nextFileItem) {
                        nextFileItem.click();
                    }
                    e.preventDefault();
                }
            }
        });

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            // Auto-scroll to first file with changes
            const firstFile = document.querySelector('.file-item');
            if (firstFile) {
                firstFile.classList.add('active');
            }
        });
        `;
    }
}
