import * as vscode from 'vscode';
import { SidebarProvider } from './sidebarProvider';
import { GitService } from './services/git/gitService';
import { GitReviewDataService } from './services/commit-review/gitReviewDataService';
import { ReviewService } from './services/reviewService';
import { SlackService } from './services/intergrations/slackService';
import { DiffViewerService } from './services/commit-review/diffViewerService';
import { ReviewHistoryView } from './services/commit-review/reviewHistoryView';
import { ReviewResultService } from './services/commit-review/reviewResultService';

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

	// Command to add a file path into the FileReviewTab list from anywhere
	const addFileToReviewCommand = vscode.commands.registerCommand('fileReview.add', async (filePathArg?: any) => {
		try {
			let filePath: string | undefined;

			if (typeof filePathArg === 'string') {
				filePath = filePathArg;
			} else if (filePathArg && typeof filePathArg === 'object') {
				// vscode.Uri
				if (filePathArg.fsPath && typeof filePathArg.fsPath === 'string') {
					filePath = filePathArg.fsPath;
				} else if (filePathArg.path && typeof filePathArg.path === 'string') {
					filePath = filePathArg.path;
				}
			}

			if (!filePath) {
				filePath = await vscode.window.showInputBox({ prompt: 'Enter full file path to add to File Review list' });
			}

			if (!filePath) {
				vscode.window.showInformationMessage('No file path provided');
				return;
			}

			// Ask provider to post message (or queue it)

			// vscode.postMessage({ type: 'createFileReview', data: { files: payload, selectedModel  } });

			provider.addFileToReview(filePath);
			vscode.window.showInformationMessage(`Added file to review list: ${filePath}`);
		} catch (error) {
			console.error('Error handling fileReview.add command:', error);
			vscode.window.showErrorMessage('Failed to add file to review list');
		}
	});


	// Command to add all files in a folder to FileReviewTab list
	const addFolderToReviewCommand = vscode.commands.registerCommand('folderReview.add', async (folderPathArg?: any) => {
		try {
			let folderPath: string | undefined;

			if (typeof folderPathArg === 'string') {
				folderPath = folderPathArg;
			} else if (folderPathArg && typeof folderPathArg === 'object') {
				// vscode.Uri
				if (folderPathArg.fsPath && typeof folderPathArg.fsPath === 'string') {
					folderPath = folderPathArg.fsPath;
				} else if (folderPathArg.path && typeof folderPathArg.path === 'string') {
					folderPath = folderPathArg.path;
				}
			}

			if (!folderPath) {
				folderPath = await vscode.window.showInputBox({ prompt: 'Enter folder path to add all files to review' });
			}

			if (!folderPath) {
				vscode.window.showInformationMessage('No folder path provided');
				return;
			}

			// Check if path is a directory
			const folderUri = vscode.Uri.file(folderPath);
			try {
				const stat = await vscode.workspace.fs.stat(folderUri);
				if (stat.type !== vscode.FileType.Directory) {
					vscode.window.showWarningMessage('The selected path is not a folder');
					return;
				}
			} catch (err) {
				vscode.window.showErrorMessage(`Folder not found: ${folderPath}`);
				return;
			}

			// Recursively find all files in the folder
			const files = await vscode.workspace.findFiles(
				new vscode.RelativePattern(folderUri, '**/*'),
				'**/node_modules/**'
			);

			if (files.length === 0) {
				vscode.window.showInformationMessage('No files found in the selected folder');
				return;
			}

			// Add all files to review
			for (const fileUri of files) {
				provider.addFileToReview(fileUri.fsPath);
			}

			vscode.window.showInformationMessage(`Added ${files.length} file(s) from folder to review list`);
		} catch (error) {
			console.error('Error handling folderReview.add command:', error);
			vscode.window.showErrorMessage('Failed to add folder to review list');
		}
	});

	context.subscriptions.push(
		addFileToReviewCommand,
		addFolderToReviewCommand,
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
