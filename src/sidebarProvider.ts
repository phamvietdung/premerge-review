import * as vscode from 'vscode';
import { getNonce } from './utils';
import { GitService } from './gitService';
import { ReviewDataService } from './reviewDataService';
import { ReviewService } from './reviewService';
import { DiffViewerService } from './diffViewerService';
import { ReviewHistoryView } from './reviewHistoryView';
import { ReviewResultService } from './reviewResultService';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'premergeReviewView';

    private _view?: vscode.WebviewView;
    private _context?: vscode.ExtensionContext;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _gitService: GitService,
        private readonly _extensionContext: vscode.ExtensionContext
    ) { }

    /**
     * Show information message with automatic timeout
     */
    private showInfoMessage(message: string, timeout: number = 10000): void {
        const disposable = vscode.window.showInformationMessage(message);
        setTimeout(() => {
            if (disposable) {
                disposable.then(selection => {
                    // Auto-close after timeout
                });
            }
        }, timeout);
    }

    /**
     * Show error message with automatic timeout
     */
    private showErrorMessage(message: string, timeout: number = 10000): void {
        const disposable = vscode.window.showErrorMessage(message);
        setTimeout(() => {
            if (disposable) {
                disposable.then(selection => {
                    // Auto-close after timeout
                });
            }
        }, timeout);
    }

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
                    this.showInfoMessage('Button được nhấn từ Preact UI!');
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
                            this.showErrorMessage('Please select current branch and either base branch or commit');
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

                                // Notify webview that review has been created
                                const summary = reviewDataService.getReviewSummary();
                                webviewView.webview.postMessage({
                                    type: 'reviewCreated',
                                    data: { summary }
                                });

                                // Show success message with summary
                                const compareInfo = selectedCommit ? 
                                    `from commit ${selectedCommit.substring(0, 8)}` : 
                                    `from branch ${baseBranch}`;
                                
                                vscode.window.showInformationMessage(
                                    `Review created successfully!\nComparing ${currentBranch} ${compareInfo}\n\n${summary}`,
                                    'Show Details',
                                    'Process Review'
                                ).then(async selection => {
                                    if (selection === 'Show Details') {
                                        // Show diff viewer
                                        const reviewService = ReviewService.getInstance(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
                                        if (reviewService) {
                                            reviewService.setExtensionContext(this._extensionContext);
                                            try {
                                                const diffViewerService = DiffViewerService.getInstance();
                                                const reviewData = reviewDataService.getReviewData();
                                                if (reviewData) {
                                                    await diffViewerService.showDiffViewer(reviewData, this._extensionContext);
                                                    this.showInfoMessage('📊 Diff viewer opened!');
                                                }
                                            } catch (error) {
                                                console.error('Error showing diff viewer:', error);
                                                this.showErrorMessage('Failed to show diff viewer');
                                            }
                                        }
                                    } else if (selection === 'Process Review') {
                                        // Start processing review with ReviewService
                                        const reviewService = ReviewService.getInstance(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
                                        if (reviewService) {
                                            reviewService.setExtensionContext(this._extensionContext);
                                            await this.processReviewWithService(reviewService, {
                                                currentBranch,
                                                baseBranch,
                                                selectedCommit
                                            });
                                        } else {
                                            this.showErrorMessage('Unable to initialize review service');
                                        }
                                    }
                                });

                            } catch (error) {
                                console.error('Error creating review:', error);
                                this.showErrorMessage(`Failed to create review: ${error instanceof Error ? error.message : 'Unknown error'}`);
                            }
                        });

                    } catch (error) {
                        console.error('Error in createReview handler:', error);
                        this.showErrorMessage('Failed to create review');
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
                case 'requestSettings':
                    // Send extension settings to webview
                    const config = vscode.workspace.getConfiguration('premergeReview');
                    const settings = {
                        intelligentRoutingEnabled: config.get<boolean>('intelligentRouting.enabled', false),
                        instructionFolderPath: config.get<string>('intelligentRouting.instructionFolderPath', '.github/instructions')
                    };
                    webviewView.webview.postMessage({
                        type: 'settings',
                        data: settings
                    });
                    break;
                case 'refreshGit':
                    // Simply re-request git info (branches may have changed)
                    const refreshedGitInfo = await this._gitService.getGitInfo();
                    webviewView.webview.postMessage({
                        type: 'gitInfo',
                        data: refreshedGitInfo
                    });
                    this.showInfoMessage('Git branches refreshed!');
                    break;
                case 'showDiffViewer':
                    try {
                        const reviewDataService = ReviewDataService.getInstance();
                        const reviewData = reviewDataService.getReviewData();
                        
                        if (!reviewData) {
                            vscode.window.showWarningMessage('No review data available. Please create a review first.');
                            return;
                        }

                        const diffViewerService = DiffViewerService.getInstance();
                        await diffViewerService.showDiffViewer(reviewData, this._extensionContext);
                        this.showInfoMessage('📊 Diff viewer opened!');
                    } catch (error) {
                        console.error('Error showing diff viewer:', error);
                        this.showErrorMessage('Failed to show diff viewer');
                    }
                    break;
                case 'processReview':
                    try {
                        const reviewDataService = ReviewDataService.getInstance();
                        const reviewData = reviewDataService.getReviewData();
                        
                        if (!reviewData) {
                            vscode.window.showWarningMessage('No review data available. Please create a review first.');
                            return;
                        }

                        const reviewService = ReviewService.getInstance(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
                        if (reviewService) {
                            reviewService.setExtensionContext(this._extensionContext);
                            await this.processReviewWithService(reviewService, {
                                currentBranch: reviewData.currentBranch,
                                baseBranch: reviewData.baseBranch,
                                selectedCommit: reviewData.selectedCommit
                            });
                        } else {
                            this.showErrorMessage('Unable to initialize review service');
                        }
                    } catch (error) {
                        console.error('Error processing review:', error);
                        this.showErrorMessage('Failed to process review');
                    }
                    break;
                case 'postToSlack':
                    try {
                        const reviewDataService = ReviewDataService.getInstance();
                        const reviewData = reviewDataService.getReviewData();
                        
                        if (!reviewData) {
                            vscode.window.showWarningMessage('No review data available. Please create a review first.');
                            return;
                        }

                        // Get the review summary for Slack
                        const summary = reviewDataService.getReviewSummary();
                        const compareInfo = reviewData.selectedCommit ? 
                            `from commit ${reviewData.selectedCommit.substring(0, 8)}` : 
                            `from branch ${reviewData.baseBranch}`;

                        // For now, just show a message with what would be posted
                        // You can integrate with SlackService here if needed
                        const slackMessage = `📋 Code Review Summary:\nComparing ${reviewData.currentBranch} ${compareInfo}\n\n${summary}`;
                        
                        vscode.window.showInformationMessage(
                            'Slack integration coming soon!',
                            'Copy Message'
                        ).then(selection => {
                            if (selection === 'Copy Message') {
                                vscode.env.clipboard.writeText(slackMessage);
                                this.showInfoMessage('Review summary copied to clipboard!');
                            }
                        });
                    } catch (error) {
                        console.error('Error posting to Slack:', error);
                        this.showErrorMessage('Failed to post to Slack');
                    }
                    break;
                case 'showReviewResult':
                    try {
                        const reviewResultService = ReviewResultService.getInstance();
                        
                        if (!reviewResultService.hasStoredResults()) {
                            vscode.window.showInformationMessage(
                                'No review results found. Process some reviews first to see their history.',
                                'OK'
                            );
                            return;
                        }

                        // Show review history view
                        ReviewHistoryView.createOrShow(this._extensionContext);
                        
                    } catch (error) {
                        console.error('Error showing review result:', error);
                        this.showErrorMessage('Failed to show review result');
                    }
                    break;
                case 'openSettings':
                    try {
                        const settingId = data.settingId || 'premergeReview';
                        await vscode.commands.executeCommand('workbench.action.openSettings', settingId);
                    } catch (error) {
                        console.error('Error opening settings:', error);
                        this.showErrorMessage('Failed to open settings');
                    }
                    break;
                case 'clearReviewData':
                    try {
                        const reviewDataService = ReviewDataService.getInstance();
                        reviewDataService.clearReviewData();
                        
                        // Notify webview that review data has been cleared
                        webviewView.webview.postMessage({
                            type: 'reviewDataCleared'
                        });
                        
                        this.showInfoMessage('Review data cleared successfully!');
                    } catch (error) {
                        console.error('Error clearing review data:', error);
                        this.showErrorMessage('Failed to clear review data');
                    }
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
                await reviewService.processReview(params, this._extensionContext, (increment: number, message: string) => {
                    progress.report({ increment, message });
                });
            });

        } catch (error) {
            console.error('Error processing review:', error);
            this.showErrorMessage(`Failed to process review: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
