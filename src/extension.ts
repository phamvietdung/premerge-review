import * as vscode from 'vscode';
import { SidebarProvider } from './sidebarProvider';
import { GitService } from './gitService';
import { ReviewDataService } from './reviewDataService';
import { ReviewService } from './reviewService';
import { SlackService } from './slackService';
import { DiffViewerService } from './diffViewerService';
import { ReviewHistoryView } from './reviewHistoryView';
import { ReviewResultService } from './reviewResultService';

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
	
	// Set extension context for review service
	reviewService.setExtensionContext(context);

	// Remove blocking git load - let webview request it when needed
	// This speeds up extension activation significantly

	// Register the sidebar provider with git service
	const provider = new SidebarProvider(context.extensionUri, gitService, context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, provider)
	);

	// Register refresh git info command
	const refreshGitCommand = vscode.commands.registerCommand('premerge-review.refreshGit', async () => {
		// Git info is loaded on-demand by webview when needed
		// This command is kept for compatibility with package.json command registration
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

	// Register test language models command
	const testLanguageModelsCommand = vscode.commands.registerCommand('premerge-review.testLanguageModels', async () => {
		try {
			vscode.window.showInformationMessage('Testing Language Models API...');
			
			// Check if the API exists
			if (!vscode.lm || !vscode.lm.selectChatModels) {
				vscode.window.showErrorMessage('Language Model API is not available in this VS Code version. Please update VS Code to version 1.90+');
				return;
			}

			console.log('Testing vscode.lm.selectChatModels()...');
			const models = await vscode.lm.selectChatModels();
			
			if (!models || models.length === 0) {
				vscode.window.showWarningMessage(
					'No AI chat models are currently available. Please ensure GitHub Copilot is installed and you are signed in.',
					'Install Copilot',
					'Sign in to Copilot'
				).then(selection => {
					if (selection === 'Install Copilot') {
						vscode.commands.executeCommand('workbench.extensions.search', 'GitHub.copilot');
					} else if (selection === 'Sign in to Copilot') {
						vscode.commands.executeCommand('github.copilot.signIn');
					}
				});
				return;
			}

			// Show available models
			const modelNames = models.map(model => `${model.name || model.id} (${model.vendor}/${model.family})`);
			const modelList = modelNames.join('\n• ');
			
			vscode.window.showInformationMessage(
				`Found ${models.length} AI models:\n• ${modelList}`,
				{ modal: true }
			);

			console.log('Available models:', models.map(m => ({
				id: m.id,
				name: m.name,
				vendor: m.vendor,
				family: m.family,
				maxTokens: m.maxInputTokens
			})));

		} catch (error) {
			console.error('Error testing language models:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			vscode.window.showErrorMessage(`Failed to test Language Models API: ${errorMessage}`);
		}
	});

	// Register validate all models command  
	const validateAllModelsCommand = vscode.commands.registerCommand('premerge-review.validateAllModels', async () => {
		try {
			vscode.window.showInformationMessage('Validating all AI models...');
			console.log('=== Validating All AI Models ===');
			
			// Check if API exists
			if (!vscode.lm || !vscode.lm.selectChatModels) {
				const message = 'Language Model API is not available in this VS Code version';
				console.error(message);
				vscode.window.showErrorMessage(message);
				return;
			}
			
			// Get all available models
			const allModels = await vscode.lm.selectChatModels();
			console.log(`Found ${allModels.length} models to validate`);
			
			if (!allModels || allModels.length === 0) {
				vscode.window.showWarningMessage('No AI models available to validate');
				return;
			}
			
			// Validate each model with actual test requests
			const validationResults: Array<{
				model: string;
				id: string;
				vendor: string;
				family: string;
				status: 'available' | 'error';
				responseLength: number;
				error: string | null;
			}> = [];
			let validatedCount = 0;
			
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: `Validating ${allModels.length} AI models...`,
					cancellable: true,
				},
				async (progress, token) => {
					for (let i = 0; i < allModels.length; i++) {
						if (token.isCancellationRequested) {
							break;
						}
						
						const model = allModels[i];
						const modelName = model.name || model.id;
						
						progress.report({
							increment: (100 / allModels.length),
							message: `Testing ${modelName}...`,
						});
						
						console.log(`Validating model ${i + 1}/${allModels.length}: ${modelName}`);
						
						try {
							// Test with a simple request
							const testMessages = [vscode.LanguageModelChatMessage.User("Hello")];
							const testResponse = await Promise.race([
								model.sendRequest(testMessages, {}, token),
								new Promise<never>((_, reject) => {
									setTimeout(() => reject(new Error('Timeout')), 10000);
								})
							]);
							
							// Try to consume response
							let responseText = '';
							for await (const chunk of testResponse.stream) {
								responseText += (chunk as any).value || '';
								if (responseText.length > 50) break; // Just need a small response
							}
							
							validationResults.push({
								model: modelName,
								id: model.id,
								vendor: model.vendor,
								family: model.family,
								status: 'available',
								responseLength: responseText.length,
								error: null
							});
							
							validatedCount++;
							console.log(`✅ ${modelName}: Available (response: ${responseText.length} chars)`);
							
						} catch (error) {
							const errorMessage = error instanceof Error ? error.message : 'Unknown error';
							validationResults.push({
								model: modelName,
								id: model.id,
								vendor: model.vendor,
								family: model.family,
								status: 'error',
								responseLength: 0,
								error: errorMessage
							});
							
							console.log(`❌ ${modelName}: ${errorMessage}`);
						}
					}
				}
			);
			
			// Show results
			const availableModels = validationResults.filter(r => r.status === 'available');
			const errorModels = validationResults.filter(r => r.status === 'error');
			
			const resultMessage = `Validation Complete:\n✅ ${availableModels.length} models available\n❌ ${errorModels.length} models with errors`;
			
			console.log('=== Validation Results ===');
			console.log('Available models:', availableModels.map(m => m.model));
			console.log('Error models:', errorModels.map(m => `${m.model}: ${m.error}`));
			
			if (errorModels.length > 0) {
				const errorDetails = errorModels.map(m => `• ${m.model}: ${m.error}`).join('\n');
				vscode.window.showWarningMessage(
					`${resultMessage}\n\nErrors:\n${errorDetails}`,
					{ modal: true },
					'View Console'
				).then(selection => {
					if (selection === 'View Console') {
						vscode.commands.executeCommand('workbench.action.toggleDevTools');
					}
				});
			} else {
				vscode.window.showInformationMessage(resultMessage);
			}
			
		} catch (error) {
			const errorMessage = `Model validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
			console.error(errorMessage, error);
			vscode.window.showErrorMessage(errorMessage);
		}
	});

	// Register diff viewer command
	const showDiffViewerCommand = vscode.commands.registerCommand('premerge-review.showDiffViewer', async () => {
		try {
			const reviewDataService = ReviewDataService.getInstance();
			const reviewData = reviewDataService.getReviewData();
			
			if (!reviewData) {
				vscode.window.showErrorMessage('No review data available. Please create a review first.');
				return;
			}

			const diffViewerService = DiffViewerService.getInstance();
			await diffViewerService.showDiffViewer(reviewData, context, {
				showLineNumbers: true,
				highlightChanges: true,
				splitView: false
			});
		} catch (error) {
			console.error('Error showing diff viewer:', error);
			vscode.window.showErrorMessage(`Failed to show diff viewer: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	});

	// Register export diff command
	const exportDiffCommand = vscode.commands.registerCommand('premerge-review.exportDiff', async () => {
		try {
			const reviewDataService = ReviewDataService.getInstance();
			const reviewData = reviewDataService.getReviewData();
			
			if (!reviewData) {
				vscode.window.showErrorMessage('No review data available for export.');
				return;
			}

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
				vscode.window.showInformationMessage(`✅ Diff exported to ${fileUri.fsPath}`);
			}
		} catch (error) {
			console.error('Error exporting diff:', error);
			vscode.window.showErrorMessage(`Failed to export diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	});

	// Register show review history command
	const showReviewHistoryCommand = vscode.commands.registerCommand('premerge-review.showReviewHistory', async () => {
		try {
			ReviewHistoryView.createOrShow(context);
		} catch (error) {
			console.error('Error showing review history:', error);
			vscode.window.showErrorMessage(`Failed to show review history: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	});

	// Register clear review results command  
	const clearReviewResultsCommand = vscode.commands.registerCommand('premerge-review.clearReviewResults', async () => {
		try {
			const result = await vscode.window.showWarningMessage(
				'Are you sure you want to clear all stored review results? This action cannot be undone.',
				'Yes, Clear All',
				'Cancel'
			);
			
			if (result === 'Yes, Clear All') {
				const reviewResultService = ReviewResultService.getInstance();
				reviewResultService.clearAllResults();
				vscode.window.showInformationMessage('All review results cleared successfully!');
			}
		} catch (error) {
			console.error('Error clearing review results:', error);
			vscode.window.showErrorMessage(`Failed to clear review results: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('premerge-review.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from PreMerge Review!');
	});

	context.subscriptions.push(
		disposable, 
		refreshGitCommand, 
		showReviewDataCommand, 
		testSlackCommand,
		testLanguageModelsCommand,
		validateAllModelsCommand,
		showDiffViewerCommand,
		exportDiffCommand,
		showReviewHistoryCommand,
		clearReviewResultsCommand
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
