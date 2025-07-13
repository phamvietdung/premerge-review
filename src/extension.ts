import * as vscode from 'vscode';
import { SidebarProvider } from './sidebarProvider';
import { GitService } from './gitService';
import { ReviewDataService } from './reviewDataService';
import { ReviewService } from './reviewService';
import { SlackService } from './slackService';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "premerge-review" is now active!');

	// Get workspace folder
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		vscode.window.showErrorMessage('No workspace folder found. Please open a folder.');
		return;
	}

	// Initialize Git service
	const gitService = new GitService(workspaceFolder.uri.fsPath);

	// Initialize Review service
	const reviewService = ReviewService.getInstance(workspaceFolder.uri.fsPath);

	// Load git information on activation
	loadGitInfo(gitService);

	// Register the sidebar provider with git service
	const provider = new SidebarProvider(context.extensionUri, gitService, context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, provider)
	);

	// Register refresh git info command
	const refreshGitCommand = vscode.commands.registerCommand('premerge-review.refreshGit', async () => {
		await loadGitInfo(gitService);
		vscode.window.showInformationMessage('Git information refreshed!');
	});

	// Register command to show current review data
	const showReviewDataCommand = vscode.commands.registerCommand('premerge-review.showReviewData', () => {
		const reviewDataService = ReviewDataService.getInstance();
		
		if (!reviewDataService.hasReviewData()) {
			vscode.window.showInformationMessage('No review data available. Create a review first.');
			return;
		}

		const reviewData = reviewDataService.getReviewData();
		if (reviewData) {
			const summary = reviewDataService.getReviewSummary();
			vscode.window.showInformationMessage(
				`Current Review Data:\n\n${summary}\n\nDiff size: ${reviewData.diff.length} characters`,
				'Clear Data',
				'Show Diff Sample'
			).then(selection => {
				if (selection === 'Clear Data') {
					reviewDataService.clearReviewData();
					vscode.window.showInformationMessage('Review data cleared');
				} else if (selection === 'Show Diff Sample') {
					// Show first 500 characters of diff
					const diffSample = reviewData.diff.substring(0, 500) + (reviewData.diff.length > 500 ? '\n...(truncated)' : '');
					vscode.window.showInformationMessage(`Diff Sample:\n\n${diffSample}`);
				}
			});
		}
	});

	const testSlackCommand = vscode.commands.registerCommand('premerge-review.testSlackConnection', async () => {
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

		await slackService.testSlackConnection();
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('premerge-review.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from PreMerge Review!');
	});

	context.subscriptions.push(disposable, refreshGitCommand, showReviewDataCommand, testSlackCommand);
}

async function loadGitInfo(gitService: GitService) {
	try {
		console.log('Loading git information...');
		const gitInfo = await gitService.getGitInfo();
		
		if (!gitInfo.isGitRepo) {
			vscode.window.showWarningMessage('Current workspace is not a Git repository.');
			return;
		}

		console.log('Git Info loaded:', {
			currentBranch: gitInfo.currentBranch,
			totalBranches: gitInfo.allBranches.length,
			branches: gitInfo.allBranches.slice(0, 5) // Log first 5 branches
		});

		vscode.window.showInformationMessage(
			`Git loaded: ${gitInfo.allBranches.length} branches, current: ${gitInfo.currentBranch}`
		);

	} catch (error) {
		console.error('Failed to load git info:', error);
		vscode.window.showErrorMessage('Failed to load Git information');
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
