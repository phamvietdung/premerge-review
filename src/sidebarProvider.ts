import * as vscode from 'vscode';
import { getNonce } from './utils';
import { GitService } from './gitService';
import { ReviewDataService } from './reviewDataService';
import { ReviewService } from './reviewService';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'premergeReviewView';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _gitService: GitService
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'buttonClicked':
                    vscode.window.showInformationMessage('Button được nhấn từ Preact UI!');
                    break;
                case 'requestBranchCommits':
                    // Send branch commits to webview
                    const { branchName } = data;
                    const commits = await this._gitService.getBranchCommits(branchName, 100);
                    webviewView.webview.postMessage({
                        type: 'branchCommits',
                        data: { branchName, commits }
                    });
                    break;
                case 'createReview':
                    try {
                        const { currentBranch, baseBranch, selectedCommit } = data.data;
                        
                        if (!currentBranch || (!baseBranch && !selectedCommit)) {
                            vscode.window.showErrorMessage('Please select current branch and either base branch or commit');
                            return;
                        }

                        // Show progress while getting diff
                        const compareTarget = selectedCommit || baseBranch;
                        const compareType = selectedCommit ? 'commit' : 'branch';
                        
                        vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: `Getting diff between ${currentBranch} and ${compareType} ${compareTarget}`,
                            cancellable: false
                        }, async (progress) => {
                            progress.report({ increment: 20, message: 'Calculating differences...' });
                            
                            try {
                                // Get diff data from git
                                let diffSummary;
                                if (selectedCommit) {
                                    diffSummary = await this._gitService.getDiffSummaryFromCommit(selectedCommit, currentBranch);
                                } else {
                                    diffSummary = await this._gitService.getDiffSummary(baseBranch, currentBranch);
                                }
                                
                                progress.report({ increment: 60, message: 'Processing diff data...' });
                                
                                // Store review data in memory
                                const reviewDataService = ReviewDataService.getInstance();
                                reviewDataService.setReviewData({
                                    currentBranch,
                                    baseBranch,
                                    selectedCommit,
                                    diff: diffSummary.diff,
                                    diffSummary: {
                                        files: diffSummary.files,
                                        insertions: diffSummary.insertions,
                                        deletions: diffSummary.deletions
                                    },
                                    createdAt: new Date()
                                });

                                progress.report({ increment: 100, message: 'Review data ready!' });

                                // Show success message with summary
                                const summary = reviewDataService.getReviewSummary();
                                const compareInfo = selectedCommit ? 
                                    `from commit ${selectedCommit.substring(0, 8)}` : 
                                    `from branch ${baseBranch}`;
                                
                                vscode.window.showInformationMessage(
                                    `Review created successfully!\nComparing ${currentBranch} ${compareInfo}\n\n${summary}`,
                                    'Show Details',
                                    'Process Review'
                                ).then(async selection => {
                                    if (selection === 'Show Details') {
                                        // TODO: Show detailed diff view
                                        vscode.window.showInformationMessage('Diff details view will be implemented next');
                                    } else if (selection === 'Process Review') {
                                        // Start processing review with ReviewService
                                        const reviewService = ReviewService.getInstance(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
                                        if (reviewService) {
                                            await this.processReviewWithService(reviewService, {
                                                currentBranch,
                                                baseBranch,
                                                selectedCommit
                                            });
                                        } else {
                                            vscode.window.showErrorMessage('Unable to initialize review service');
                                        }
                                    }
                                });

                            } catch (error) {
                                console.error('Error creating review:', error);
                                vscode.window.showErrorMessage(`Failed to create review: ${error instanceof Error ? error.message : 'Unknown error'}`);
                            }
                        });

                    } catch (error) {
                        console.error('Error in createReview handler:', error);
                        vscode.window.showErrorMessage('Failed to create review');
                    }
                    break;
                case 'requestGitInfo':
                    // Send git info to webview
                    const gitInfo = await this._gitService.getGitInfo();
                    webviewView.webview.postMessage({
                        type: 'gitInfo',
                        data: gitInfo
                    });
                    break;
                case 'refreshGit':
                    // Refresh git info and send to webview
                    await this._gitService.refreshBranches();
                    const refreshedGitInfo = await this._gitService.getGitInfo();
                    webviewView.webview.postMessage({
                        type: 'gitInfo',
                        data: refreshedGitInfo
                    });
                    vscode.window.showInformationMessage('Git branches refreshed!');
                    break;
            }
        });
    }

    /**
     * Process review using ReviewService
     */
    private async processReviewWithService(reviewService: ReviewService, params: {
        currentBranch: string;
        baseBranch: string;
        selectedCommit?: string;
    }): Promise<void> {
        try {
            // Show progress while processing with ReviewService
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Processing Review',
                cancellable: true
            }, async (progress, token) => {
                // Use ReviewService to process the review
                await reviewService.processReview(params, (increment, message) => {
                    progress.report({ increment, message });
                });
            });

        } catch (error) {
            console.error('Error processing review:', error);
            vscode.window.showErrorMessage(`Failed to process review: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

        const nonce = getNonce();

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet">
				<title>PreMerge Review</title>
			</head>
			<body>
				<div id="root"></div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}
