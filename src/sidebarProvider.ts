import * as vscode from 'vscode';
import { getNonce } from './utils';
import * as path from 'path';
import fg from 'fast-glob';
import { GitService } from './gitService';
import { ReviewDataService } from './reviewDataService';
import { ReviewService } from './reviewService';
import { DiffViewerService } from './diffViewerService';
import { ReviewHistoryView } from './reviewHistoryView';
import { ReviewResultService } from './reviewResultService';
import { MessageType } from './models/messageTypes';

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
                case MessageType.RequestBranchCommits:
                    // Send branch commits to webview
                    const { branchName } = data;
                    const commits = await this._gitService.getBranchCommits(branchName, 100);
                    webviewView.webview.postMessage({
                        type: 'branchCommits',
                        data: { branchName, commits }
                    });
                    break;
                case MessageType.RequestWorkspaceFolders:
                    try {
                        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        if (!workspaceRoot) {
                            webviewView.webview.postMessage({ type: 'workspaceFoldersError', error: 'No workspace open' });
                            break;
                        }

                        // List top-level directories (non-dot) and root-level files
                        const dirEntries = await fg(['*/'], { onlyDirectories: true, cwd: workspaceRoot, deep: 1, dot: false });
                        const fileEntries = await fg(['*'], { onlyFiles: true, cwd: workspaceRoot, deep: 0, dot: false });

                        const directories = dirEntries.map(d => ({
                            name: path.basename(d.replace(/\/+$/, '')),
                            path: path.join(workspaceRoot, d),
                            relativePath: d.replace(/\/+$/, '')
                        }));

                        const files = fileEntries.map(f => ({
                            name: path.basename(f),
                            path: path.join(workspaceRoot, f),
                            relativePath: f
                        }));

                        webviewView.webview.postMessage({ type: 'workspaceFolders', data: { directories, files } });
                    } catch (error) {
                        console.error('Error listing workspace folders:', error);
                        webviewView.webview.postMessage({ type: 'workspaceFoldersError', error: error instanceof Error ? error.message : String(error) });
                    }
                    break;
                case MessageType.RequestFilesInFolder:
                    try {
                        const folderPath: string = data.folderPath;
                        if (!folderPath) {
                            webviewView.webview.postMessage({ type: 'filesInFolder', folderPath, data: { directories: [], files: [] }, error: 'No folder path provided' });
                            break;
                        }

                        // Use fast-glob to list immediate child directories and files
                        const dirs = await fg(['*/'], { onlyDirectories: true, cwd: folderPath, deep: 1, dot: false });
                        const files = await fg(['*'], { onlyFiles: true, cwd: folderPath, deep: 0, dot: false });

                        const directories = dirs.map(d => ({
                            name: path.basename(d.replace(/\/+$/, '')),
                            path: path.join(folderPath, d),
                            relativePath: d.replace(/\/+$/, '')
                        }));

                        const fileList = files.map(f => ({
                            name: path.basename(f),
                            path: path.join(folderPath, f),
                            relativePath: path.join(path.basename(folderPath), f)
                        }));

                        webviewView.webview.postMessage({ type: 'filesInFolder', folderPath, data: { directories, files: fileList } });
                    } catch (error) {
                        console.error('Error listing files in folder:', error);
                        webviewView.webview.postMessage({ type: 'filesInFolder', folderPath: data.folderPath, data: { directories: [], files: [] }, error: error instanceof Error ? error.message : String(error) });
                    }
                    break;

                case MessageType.SubmitFileReview:
                    try {
                        const filePath: string = data.filePath;
                        if (!filePath) {
                            webviewView.webview.postMessage({ type: 'fileReviewError', error: 'No file path provided' });
                            break;
                        }

                        const fileUri = vscode.Uri.file(filePath);
                        const doc = await vscode.workspace.openTextDocument(fileUri);
                        await vscode.window.showTextDocument(doc, { preview: false });

                        // Notify webview of success
                        webviewView.webview.postMessage({ type: 'fileReviewSubmitted', filePath });
                    } catch (error) {
                        console.error('Error opening file for review:', error);
                        webviewView.webview.postMessage({ type: 'fileReviewError', error: error instanceof Error ? error.message : String(error) });
                    }
                    break;
                case MessageType.SubmitFilesReview:
                    try {
                        const filePaths: string[] = data.filePaths;
                        if (!Array.isArray(filePaths) || filePaths.length === 0) {
                            webviewView.webview.postMessage({ type: 'fileReviewError', error: 'No file paths provided' });
                            break;
                        }

                        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        const fileContents: { path: string; relativePath: string; content: string }[] = [];

                        for (const fp of filePaths) {
                            try {
                                const fileUri = vscode.Uri.file(fp);
                                const bytes = await vscode.workspace.fs.readFile(fileUri);
                                const content = Buffer.from(bytes).toString('utf8');
                                const relative = workspaceRoot ? require('path').relative(workspaceRoot, fp) : fp;
                                fileContents.push({ path: fp, relativePath: relative, content });
                            } catch (readErr) {
                                console.warn('Failed to read file for review:', fp, readErr);
                            }
                        }

                        if (fileContents.length === 0) {
                            webviewView.webview.postMessage({ type: 'fileReviewError', error: 'Unable to read any selected files' });
                            break;
                        }

                        // Build a simple diff-like payload by concatenating full file contents for now
                        const diffPayload = fileContents.map(f => `--- ${f.relativePath}\n${f.content}`).join('\n\n');

                        const diffSummary = {
                            files: fileContents.map(f => f.relativePath),
                            insertions: 0,
                            deletions: 0
                        };

                        // Prepare review data and store it in memory (so ReviewService can consume it)
                        const currentBranch = (this._gitService && await this._gitService.getCurrentBranch()) || '';

                        const reviewDataService = ReviewDataService.getInstance();
                        reviewDataService.setReviewData({
                            currentBranch: currentBranch,
                            baseBranch: '',
                            selectedCommit: undefined,
                            selectedModel: undefined,
                            diff: diffPayload,
                            diffSummary: diffSummary,
                            createdAt: new Date()
                        });

                        // Kick off processing flow similar to commit review
                        const reviewService = ReviewService.getInstance(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
                        if (reviewService) {
                            reviewService.setExtensionContext(this._extensionContext);
                            // Process review in background; user will be notified by ReviewService
                            this.processReviewWithService(reviewService, {
                                currentBranch: currentBranch,
                                baseBranch: ''
                            }).catch(err => {
                                console.error('Error processing files review:', err);
                            });
                        }

                        // Notify webview of success (send first file path as shorthand)
                        webviewView.webview.postMessage({ type: 'fileReviewSubmitted', filePath: fileContents[0].path });

                    } catch (error) {
                        console.error('Error submitting files for review:', error);
                        webviewView.webview.postMessage({ type: 'fileReviewError', error: error instanceof Error ? error.message : String(error) });
                    }
                    break;
                case MessageType.CreateReview:
                    try {
                        const { currentBranch, baseBranch, selectedCommit, selectedModel } = data.data;
                        
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
                                    selectedModel: selectedModel || 'gpt-4o', // Default fallback
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
                case MessageType.RequestGitInfo:
                    // Send git info to webview
                    const gitInfo = await this._gitService.getGitInfo();
                    webviewView.webview.postMessage({
                        type: 'gitInfo',
                        data: gitInfo
                    });
                    break;
                case MessageType.RequestChatModels:
                    // Send available chat models to webview
                    try {
                        const chatModels = await this.getAvailableChatModels();
                        webviewView.webview.postMessage({
                            type: 'chatModels',
                            data: chatModels
                        });
                    } catch (error) {
                        console.error('Error getting chat models:', error);
                        webviewView.webview.postMessage({
                            type: 'chatModels',
                            data: [],
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }
                    break;
                case MessageType.RefreshChatModels:
                    // Manually refresh chat models
                    try {
                        this.showInfoMessage('Refreshing AI models...');
                        const chatModels = await this.getAvailableChatModels();
                        webviewView.webview.postMessage({
                            type: 'chatModels',
                            data: chatModels
                        });
                        this.showInfoMessage('AI models refreshed successfully!');
                    } catch (error) {
                        console.error('Error refreshing chat models:', error);
                        this.showErrorMessage(`Failed to refresh AI models: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        webviewView.webview.postMessage({
                            type: 'chatModels',
                            data: [],
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }
                    break;
                case MessageType.RequestSettings:
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
                case MessageType.RefreshGit:
                    // Simply re-request git info (branches may have changed)
                    const refreshedGitInfo = await this._gitService.getGitInfo();
                    webviewView.webview.postMessage({
                        type: 'gitInfo',
                        data: refreshedGitInfo
                    });
                    this.showInfoMessage('Git branches refreshed!');
                    break;
                case MessageType.CheckTargetBranch:
                    // Check if target branch needs pull
                    try {
                        const { targetBranch } = data;
                        if (!targetBranch) {
                            webviewView.webview.postMessage({
                                type: 'targetBranchStatus',
                                data: { needsPull: false, message: 'No target branch specified' }
                            });
                            return;
                        }

                        const branchStatus = await this._gitService.checkTargetBranchStatus(targetBranch);
                        webviewView.webview.postMessage({
                            type: 'targetBranchStatus',
                            data: branchStatus
                        });
                    } catch (error) {
                        console.error('Error checking target branch:', error);
                        webviewView.webview.postMessage({
                            type: 'targetBranchStatus',
                            data: { 
                                needsPull: false,
                                message: 'Failed to check branch status',
                                error: error instanceof Error ? error.message : 'Unknown error'
                            }
                        });
                    }
                    break;
                case MessageType.ShowDiffViewer:
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
                case MessageType.ProcessReview:
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
                case MessageType.PostToSlack:
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
                case MessageType.ShowReviewResult:
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
                case MessageType.OpenSettings:
                    try {
                        const settingId = data.settingId || 'premergeReview';
                        await vscode.commands.executeCommand('workbench.action.openSettings', settingId);
                    } catch (error) {
                        console.error('Error opening settings:', error);
                        this.showErrorMessage('Failed to open settings');
                    }
                    break;
                case MessageType.ClearReviewData:
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
     * Get available chat models from VS Code Language Model API
     */
    private async getAvailableChatModels(): Promise<any[]> {
        try {
            console.log('Attempting to get chat models via vscode.lm.selectChatModels()...');
            
            // Check if the API exists
            if (!vscode.lm || !vscode.lm.selectChatModels) {
                console.warn('vscode.lm.selectChatModels API is not available in this VS Code version');
                vscode.window.showWarningMessage(
                    'Language Model API is not available. Please update VS Code to version 1.90+ and ensure GitHub Copilot is installed.',
                    'Install Copilot'
                ).then(selection => {
                    if (selection === 'Install Copilot') {
                        vscode.commands.executeCommand('workbench.extensions.search', 'GitHub.copilot');
                    }
                });
                return this.getFallbackModels();
            }

            // Try to get models with timeout
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Timeout after 30 seconds')), 30000);
            });
            
            const modelsPromise = vscode.lm.selectChatModels();
            const models = await Promise.race([modelsPromise, timeoutPromise]);
            
            console.log('Chat models returned:', models?.length || 0, 'models');
            
            if (!models || models.length === 0) {
                console.warn('No chat models available from API, using fallback');
                vscode.window.showWarningMessage(
                    'No AI chat models are currently available. Please ensure GitHub Copilot is installed and you are signed in.',
                    'Check Copilot Status',
                    'Use Fallback Models'
                ).then(selection => {
                    if (selection === 'Check Copilot Status') {
                        vscode.commands.executeCommand('github.copilot.signIn');
                    }
                });
                return this.getFallbackModels();
            }

            const formattedModels = await Promise.all(models.map(async model => {
                console.log('Processing model:', {
                    id: model.id,
                    name: model.name,
                    vendor: model.vendor,
                    family: model.family
                });

                // Validate model availability
                const isAvailable = await this.validateModelQuickly(model);
                const displayName = this.formatModelDisplayName(model, isAvailable);

                return {
                    id: model.id,
                    name: model.name || model.id,
                    vendor: model.vendor,
                    family: model.family,
                    version: model.version,
                    maxInputTokens: model.maxInputTokens,
                    displayName: displayName,
                    isAvailable: isAvailable
                };
            }));

            const availableCount = formattedModels.filter(m => m.isAvailable).length;
            const totalCount = formattedModels.length;
            
            console.log(`Successfully loaded ${totalCount} AI models (${availableCount} available)`);
            
            if (availableCount === 0) {
                vscode.window.showWarningMessage(
                    `Found ${totalCount} AI models but none are currently accessible. Please check your AI service permissions.`,
                    'Check Copilot Settings'
                ).then(selection => {
                    if (selection === 'Check Copilot Settings') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'github.copilot');
                    }
                });
            } else if (availableCount < totalCount) {
                vscode.window.showInformationMessage(
                    `Successfully loaded ${availableCount}/${totalCount} AI models for code review (some models may be disabled)`
                );
            } else {
                vscode.window.showInformationMessage(`Successfully loaded ${totalCount} AI models for code review`);
            }
            
            return formattedModels;

        } catch (error) {
            console.error('Error selecting chat models:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            if (errorMessage.includes('Timeout')) {
                vscode.window.showWarningMessage(
                    'Loading AI models timed out after 30 seconds. You can try manual refresh.',
                    'Manual Refresh',
                    'Check Copilot'
                ).then(selection => {
                    if (selection === 'Manual Refresh') {
                        // Trigger manual refresh via webview
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'showManualRefresh'
                            });
                        }
                    } else if (selection === 'Check Copilot') {
                        vscode.commands.executeCommand('github.copilot.signIn');
                    }
                });
            } else {
                vscode.window.showErrorMessage(
                    `Failed to load AI models: ${errorMessage}. Using fallback models.`,
                    'View Logs'
                ).then(selection => {
                    if (selection === 'View Logs') {
                        vscode.commands.executeCommand('workbench.action.showLogs');
                    }
                });
            }
            
            return this.getFallbackModels();
        }
    }

    private getFallbackModels(): any[] {
        console.log('Using fallback chat models - these are mock models for testing');
        return [
            {
                id: 'gpt-4o',
                name: 'GPT-4o',
                vendor: 'openai',
                family: 'gpt-4o', 
                version: 'latest',
                maxInputTokens: 128000,
                displayName: '🔄 GPT-4o (OpenAI) - Fallback'
            },
            // {
            //     id: 'gpt-3.5-turbo',
            //     name: 'GPT-3.5 Turbo',
            //     vendor: 'openai',
            //     family: 'gpt-3.5-turbo',
            //     version: 'latest',
            //     maxInputTokens: 16000,
            //     displayName: '🔄 GPT-3.5 Turbo (OpenAI) - Fallback'
            // },
            // {
            //     id: 'claude-3-haiku',
            //     name: 'Claude 3 Haiku',
            //     vendor: 'anthropic',
            //     family: 'claude-3',
            //     version: 'haiku',
            //     maxInputTokens: 200000,
            //     displayName: '🔄 Claude 3 Haiku (Anthropic) - Fallback'
            // },
            // {
            //     id: 'gemini-pro',
            //     name: 'Gemini Pro',
            //     vendor: 'google',
            //     family: 'gemini',
            //     version: 'pro',
            //     maxInputTokens: 1000000,
            //     displayName: '🔄 Gemini Pro (Google) - Fallback'
            // }
        ];
    }

    /**
     * Format model display name for UI
     */
    private formatModelDisplayName(model: any, isAvailable?: boolean): string {
        const parts = [];
        
        if (model.name) {
            parts.push(model.name);
        } else if (model.family) {
            parts.push(model.family);
        } else {
            parts.push(model.id);
        }
        
        if (model.vendor) {
            parts.push(`(${model.vendor})`);
        }
        
        if (model.maxInputTokens) {
            parts.push(`- ${Math.floor(model.maxInputTokens / 1000)}K tokens`);
        }
        
        // Add availability indicator
        if (isAvailable === false) {
            return `⚠️ ${parts.join(' ')} - Limited Access`;
        } else if (isAvailable === true) {
            return `✅ ${parts.join(' ')}`;
        }
        
        return parts.join(' ');
    }

    /**
     * Quick validation of model availability without full test
     */
    private async validateModelQuickly(model: any): Promise<boolean> {
        try {
            // For now, we assume models returned by selectChatModels are available
            // This is a placeholder for more sophisticated validation
            // Could be enhanced with actual test requests if needed
            
            // Check for known problematic patterns
            if (!model.id || !model.family) {
                return false;
            }
            
            // All models from selectChatModels should be available in theory
            return true;
        } catch (error) {
            console.warn(`Quick validation failed for model ${model.id}:`, error);
            return false;
        }
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
