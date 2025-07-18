import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ReviewDataService, ReviewData } from './reviewDataService';
import { SendReviewDiffChangeRequest, AuditContext } from './copilotChatService';

// Interface for review processing parameters
export interface ReviewProcessParams {
    currentBranch: string;
    baseBranch: string;
    selectedCommit?: string;
}

// Interface for instruction file content
export interface InstructionFile {
    path: string;
    content: string;
    exists: boolean;
}

export class ReviewService {
    private static instance: ReviewService;
    private workspaceRoot: string;

    private constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    public static getInstance(workspaceRoot?: string): ReviewService {
        if (!ReviewService.instance && workspaceRoot) {
            ReviewService.instance = new ReviewService(workspaceRoot);
        }
        return ReviewService.instance;
    }

    /**
     * Main function to process review
     */
    public async processReview(
        params: ReviewProcessParams,
        context: vscode.ExtensionContext,
        progressCallback?: (increment: number, message: string) => void
    ): Promise<void> {
        try {
            progressCallback?.(0, 'Initializing review process...');

            // Step 1: Read instructions (always attempt to load)
            progressCallback?.(20, 'Reading review instructions...');
            const instructions = await this.readReviewInstructions();

            // Step 2: Get review data from memory
            progressCallback?.(40, 'Loading review data...');
            const reviewDataService = ReviewDataService.getInstance();
            const reviewData = reviewDataService.getReviewData();
            
            if (!reviewData) {
                throw new Error('No review data found. Please create a review first.');
            }

            // Step 3: Process diff with AI/analysis
            progressCallback?.(60, 'Analyzing code changes...');
            await this.analyzeCodeChanges(reviewData, instructions);

            // Step 4: Generate review comments/suggestions
            progressCallback?.(80, 'Generating review feedback...');
            const reviewResults = await this.generateReviewFeedback(reviewData, instructions, context);

            // Step 5: Present results to user
            progressCallback?.(100, 'Review processing complete!');
            await this.presentReviewResults(reviewResults, params);

        } catch (error) {
            console.error('Error processing review:', error);
            throw error;
        }
    }

    /**
     * Read review instructions from configured paths
     */
    private async readReviewInstructions(): Promise<InstructionFile[]> {
        try {
            // Get instruction file paths from settings
            const config = vscode.workspace.getConfiguration('premergeReview');
            const instructionPaths: string[] = config.get('instructionFiles', [
                '.github/instructions.md',
                '.github/review-instructions.md',
                'docs/review-guidelines.md'
            ]);

            const instructions: InstructionFile[] = [];

            for (const relativePath of instructionPaths) {
                const fullPath = path.join(this.workspaceRoot, relativePath);
                
                try {
                    if (fs.existsSync(fullPath)) {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        instructions.push({
                            path: relativePath,
                            content: content,
                            exists: true
                        });
                        console.log(`Loaded instruction file: ${relativePath}`);
                    } else {
                        instructions.push({
                            path: relativePath,
                            content: '',
                            exists: false
                        });
                        console.log(`Instruction file not found: ${relativePath}`);
                    }
                } catch (fileError) {
                    console.error(`Error reading instruction file ${relativePath}:`, fileError);
                    instructions.push({
                        path: relativePath,
                        content: '',
                        exists: false
                    });
                }
            }

            // Show summary of loaded instructions
            const loadedCount = instructions.filter(i => i.exists).length;
            if (loadedCount > 0) {
                vscode.window.showInformationMessage(
                    `Loaded ${loadedCount} instruction file(s) for review guidance`
                );
            } else {
                vscode.window.showWarningMessage(
                    'No instruction files found. Review will proceed without specific guidelines.'
                );
            }

            return instructions;

        } catch (error) {
            console.error('Error loading instructions:', error);
            vscode.window.showErrorMessage('Failed to load review instructions');
            return [];
        }
    }

    /**
     * Analyze code changes (placeholder for AI integration)
     */
    private async analyzeCodeChanges(reviewData: ReviewData, instructions: InstructionFile[]): Promise<void> {
        // TODO: Implement AI analysis of code changes
        console.log('Analyzing code changes...');
        console.log(`Files changed: ${reviewData.diffSummary.files.length}`);
        console.log(`Instructions loaded: ${instructions.filter(i => i.exists).length}`);
        
        // Simulate analysis delay
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    /**
     * Generate review feedback (placeholder for AI integration)
     */
    private async generateReviewFeedback(reviewData: ReviewData, instructions: InstructionFile[], context: vscode.ExtensionContext): Promise<any> {
        var combineInstructionContent = instructions.filter(i => i.exists).map(i => i.content).join('\n\n');

        // Create audit context
        const auditContext: AuditContext = {
            reviewer: await this.getReviewerName(),
            reviewTime: new Date().toISOString(),
            sourceBranch: reviewData.currentBranch,
            targetBranch: reviewData.baseBranch,
            commitRange: reviewData.selectedCommit ? {
                fromCommit: reviewData.selectedCommit,
                toCommit: reviewData.currentBranch
            } : undefined,
            workspaceName: vscode.workspace.name,
            gitRepoUrl: await this.getGitRepoUrl()
        };

        await SendReviewDiffChangeRequest(combineInstructionContent, reviewData.diff, auditContext, context);
        
        return {
            summary: `Review completed for ${reviewData.diffSummary.files.length} files`,
            suggestions: [],
            issues: [],
            instructionsUsed: instructions.filter(i => i.exists).length
        };
    }

    /**
     * Present review results to user
     */
    private async presentReviewResults(reviewResults: any, params: ReviewProcessParams): Promise<void> {
        const compareInfo = params.selectedCommit ? 
            `from commit ${params.selectedCommit.substring(0, 8)}` : 
            `from branch ${params.baseBranch}`;

        vscode.window.showInformationMessage(
            `Review processing completed!\n\n` +
            `Comparing ${params.currentBranch} ${compareInfo}\n` +
            `${reviewResults.summary}\n` +
            `Instructions used: ${reviewResults.instructionsUsed}\n\n` +
            `Full implementation coming next...`,
            'Show Detailed Results',
            'Open Settings'
        ).then(selection => {
            if (selection === 'Show Detailed Results') {
                // TODO: Show detailed review results
                vscode.window.showInformationMessage('Detailed results view will be implemented next');
            } else if (selection === 'Open Settings') {
                // Open extension settings
                vscode.commands.executeCommand('workbench.action.openSettings', 'premergeReview');
            }
        });
    }

    /**
     * Get configured instruction file paths
     */
    public getConfiguredInstructionPaths(): string[] {
        const config = vscode.workspace.getConfiguration('premergeReview');
        return config.get('instructionFiles', [
            '.github/instructions.md',
            '.github/review-instructions.md', 
            'docs/review-guidelines.md'
        ]);
    }

    /**
     * Update instruction file paths in settings
     */
    public async updateInstructionPaths(paths: string[]): Promise<void> {
        const config = vscode.workspace.getConfiguration('premergeReview');
        await config.update('instructionFiles', paths, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage('Instruction file paths updated successfully');
    }

    /**
     * Get Git repository URL
     */
    private async getGitRepoUrl(): Promise<string | undefined> {
        try {
            const simpleGit = require('simple-git');
            const git = simpleGit(this.workspaceRoot);
            
            // Get list of remotes
            const remotes = await git.getRemotes(true);
            
            // Find origin remote or use the first available
            const originRemote = remotes.find((remote: any) => remote.name === 'origin') || remotes[0];
            
            if (originRemote && originRemote.refs && originRemote.refs.fetch) {
                return originRemote.refs.fetch;
            }
            
            return undefined;
        } catch (error) {
            console.error('Error getting git repository URL:', error);
            return undefined;
        }
    }

    /**
     * Get reviewer name from git config or VS Code environment
     */
    private async getReviewerName(): Promise<string> {
        try {
            const simpleGit = require('simple-git');
            const git = simpleGit(this.workspaceRoot);
            
            // Try to get git username
            const gitConfig = await git.listConfig();
            const userName = gitConfig.all['user.name'];
            const userEmail = gitConfig.all['user.email'];
            
            if (userName) {
                return userEmail ? `${userName} <${userEmail}>` : userName;
            }
            
            // Fallback to VS Code username or machine ID
            return vscode.env.remoteName || vscode.env.machineId || 'Unknown Reviewer';
        } catch (error) {
            console.error('Error getting reviewer name:', error);
            return vscode.env.machineId || 'Unknown Reviewer';
        }
    }
}
