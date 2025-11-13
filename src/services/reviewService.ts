/**
 * ReviewService - Điều phối toàn bộ quy trình review code.
 *
 * Các function chính:
 * - getInstance: singleton instance cho service
 * - setExtensionContext: gán context cho webview
 * - processReview: xử lý review cho commit diff (luồng chính)
 * - processReviewFile: xử lý review cho file content
 * - readReviewInstructions: đọc hướng dẫn review từ file cấu hình
 * - analyzeCodeChanges: (placeholder) phân tích thay đổi code
 * - generateReviewFeedback: gọi AI sinh nhận xét cho commit diff
 * - generateFileReviewFeedback: gọi AI sinh nhận xét cho file content
 * - presentReviewResults: hiển thị thông báo kết quả review
 * - showDiffViewer: mở giao diện so sánh diff
 * - postReviewToSlack: gửi kết quả review lên Slack
 * - formatReviewForSlack: format kết quả review gửi Slack
 * - getConfiguredInstructionPaths: lấy danh sách file hướng dẫn
 * - updateInstructionPaths: cập nhật danh sách file hướng dẫn
 * - getGitRepoUrl: lấy URL repo git
 * - getReviewerName: lấy tên reviewer từ git hoặc VSCode
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { GitReviewDataService, ReviewData } from "./commit-review/gitReviewDataService";
import {
    SendReviewDiffChangeRequest,
    AuditContext,
} from "./copilot/copilotChatService";
import { DiffViewerService } from "./commit-review/diffViewerService";
import { SlackService } from "./intergrations/slackService";
import { ReviewResultService, ReviewResultType } from "./commit-review/reviewResultService";
import { ReviewHistoryView } from "./commit-review/reviewHistoryView";

// Interface for review processing parameters
export interface ReviewProcessParams {
    type : ReviewResultType;
    currentBranch: string;
    baseBranch: string;
    selectedCommit?: string;
}

export interface ReviewFileProcessParams {
    type : ReviewResultType;
    content: string,
    selectedModel : string,
    fileNames : string[],
    // currentBranch: string;
    // baseBranch: string;
    // selectedCommit?: string;
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
    private extensionContext: vscode.ExtensionContext | undefined;

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
     * Set extension context for webview operations
     */
    public setExtensionContext(context: vscode.ExtensionContext): void {
        this.extensionContext = context;
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
            progressCallback?.(0, "Initializing review process...");

            // Step 1: Read instructions (always attempt to load)
            progressCallback?.(20, "Reading review instructions...");
            const instructions = await this.readReviewInstructions();

            // Step 2: Get review data from memory
            progressCallback?.(40, "Loading review data...");
            const reviewDataService = GitReviewDataService.getInstance();
            const reviewData = reviewDataService.getReviewData();

            if (!reviewData) {
                throw new Error(
                    "No review data found. Please create a review first."
                );
            }

            // Step 3: Process diff with AI/analysis
            progressCallback?.(60, "Analyzing code changes...");
            await this.analyzeCodeChanges(reviewData, instructions);

            // Step 4: Generate review comments/suggestions
            progressCallback?.(80, "Generating review feedback...");
            const reviewResults = await this.generateReviewFeedback(
                params.type,
                reviewData,
                instructions,
                context
            );

            // Step 5: Present results to user
            progressCallback?.(100, "Review processing complete!");
            await this.presentReviewResults(reviewResults, params);
        } catch (error) {
            console.error("Error processing review:", error);
            throw error;
        }
    }

    public async processReviewFile(
        params: ReviewFileProcessParams,
        context: vscode.ExtensionContext,
        progressCallback?: (increment: number, message: string) => void
    ): Promise<void> {
        try {
            progressCallback?.(0, "Initializing review process...");

            // Step 1: Read instructions (always attempt to load)
            progressCallback?.(20, "Reading review instructions...");
            const instructions = await this.readReviewInstructions();

            // Step 2: Get review data from memory
            progressCallback?.(40, "Loading review data...");
            if (!params.content) {
                throw new Error(
                    "No review data found. Please create a review first."
                );
            }

            // Step 3: Process diff with AI/analysis
            progressCallback?.(60, "Analyzing code changes...");

            // Step 4: Generate review comments/suggestions
            progressCallback?.(80, "Generating review feedback...");
            const reviewResults = await this.generateFileReviewFeedback(
                params.type,
                instructions,
                params.content,
                params.fileNames,
                params.selectedModel,
                context
            );

            // Step 5: Present results to user
            progressCallback?.(100, "Review processing complete!");
            // await this.presentReviewResults(reviewResults, params);
        } catch (error) {
            console.error("Error processing review:", error);
            throw error;
        }
    }

    /**
     * Read review instructions from configured paths
     */
    private async readReviewInstructions(): Promise<InstructionFile[]> {
        try {
            // Get instruction file paths from settings
            const config = vscode.workspace.getConfiguration("premergeReview");
            const instructionPaths: string[] = config.get("instructionFiles", [
                ".github/instructions.md",
                ".github/review-instructions.md",
                "docs/review-guidelines.md",
            ]);

            const instructions: InstructionFile[] = [];

            for (const relativePath of instructionPaths) {
                const fullPath = path.join(this.workspaceRoot, relativePath);

                try {
                    if (fs.existsSync(fullPath)) {
                        const content = fs.readFileSync(fullPath, "utf8");
                        instructions.push({
                            path: relativePath,
                            content: content,
                            exists: true,
                        });
                        console.log(`Loaded instruction file: ${relativePath}`);
                    } else {
                        instructions.push({
                            path: relativePath,
                            content: "",
                            exists: false,
                        });
                        console.log(
                            `Instruction file not found: ${relativePath}`
                        );
                    }
                } catch (fileError) {
                    console.error(
                        `Error reading instruction file ${relativePath}:`,
                        fileError
                    );
                    instructions.push({
                        path: relativePath,
                        content: "",
                        exists: false,
                    });
                }
            }

            // Show summary of loaded instructions
            const loadedCount = instructions.filter((i) => i.exists).length;
            if (loadedCount > 0) {
                vscode.window.showInformationMessage(
                    `Loaded ${loadedCount} instruction file(s) for review guidance`
                );
            } else {
                vscode.window.showWarningMessage(
                    "No instruction files found. Review will proceed without specific guidelines."
                );

                if (this.extensionContext) {
                    const bundledPath = vscode.Uri.joinPath(
                        this.extensionContext.extensionUri,
                        "resources",
                        "default-instructions.md"
                    ).fsPath;

                    const content = fs.readFileSync(bundledPath, "utf8");

                    instructions.push({
                        exists: true,
                        path: "",
                        content: content,
                    });
                }
            }

            return instructions;
        } catch (error) {
            console.error("Error loading instructions:", error);
            vscode.window.showErrorMessage(
                "Failed to load review instructions"
            );
            return [];
        }
    }

    /**
     * Analyze code changes (placeholder for AI integration)
     */
    private async analyzeCodeChanges(
        reviewData: ReviewData,
        instructions: InstructionFile[]
    ): Promise<void> {
        // TODO: Implement AI analysis of code changes
        console.log("Analyzing code changes...");
        console.log(`Files changed: ${reviewData.diffSummary.files.length}`);
        console.log(
            `Instructions loaded: ${
                instructions.filter((i) => i.exists).length
            }`
        );

        // Simulate analysis delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    /**
     * Generate review feedback with intelligent instruction routing
     */
    private async generateReviewFeedback(
        type : ReviewResultType ,
        reviewData: ReviewData,
        instructions: InstructionFile[],
        context: vscode.ExtensionContext
    ): Promise<any> {
        let combineInstructionContent: string;
        let instructionsUsedInfo: string;

        // Traditional method: use all instructions
        combineInstructionContent = instructions
            .filter((i) => i.exists)
            .map((i) => i.content)
            .join("\n\n");
        instructionsUsedInfo = `Traditional instructions (${
            instructions.filter((i) => i.exists).length
        } files)`;

        // Create audit context
        const auditContext: AuditContext = {
            reviewer: await this.getReviewerName(),
            reviewTime: new Date().toISOString(),
            sourceBranch: reviewData.currentBranch,
            targetBranch: reviewData.baseBranch,
            commitRange: reviewData.selectedCommit
                ? {
                      fromCommit: reviewData.selectedCommit,
                      toCommit: reviewData.currentBranch,
                  }
                : undefined,
            workspaceName: vscode.workspace.name,
            gitRepoUrl: await this.getGitRepoUrl(),
        };

        // Send review request and get result
        const reviewResult = await SendReviewDiffChangeRequest(
            type,
            combineInstructionContent,
            reviewData.diff,
            context,
            auditContext,
            reviewData.selectedModel
        );

        // Prepare result data
        const resultData = {
            summary: `Review completed for ${reviewData.diffSummary.files.length} files`,
            instructionsUsed: instructionsUsedInfo,
            content: reviewResult || "No review content generated",
            isMultiPart: false,
        };

        // Check if this was handled as a multi-part review (which already stores its own result)
        const reviewResultService = ReviewResultService.getInstance();
        const currentResult = reviewResultService.getCurrentReviewResult();

        // Only store result if it wasn't already stored by multi-part flow
        if (!currentResult || !currentResult.reviewResults.isMultiPart) {
            // Store the review result in memory
            reviewResultService.storeReviewResult(type, reviewData, resultData);

            // Show review history after data has been stored (avoid timing issues)
            setTimeout(() => {
                ReviewHistoryView.createOrShow(context);
            }, 100); // Small delay to ensure data is fully saved
        }

        return {
            summary: resultData.summary,
            instructionsUsed: resultData.instructionsUsed,
            suggestions: [],
            issues: [],
            result: reviewResult,
        };
    }

    private async generateFileReviewFeedback(
        type : ReviewResultType,
        instructions: InstructionFile[],
        content: string,
        fileNames : string[],
        selectedModel : string,
        context: vscode.ExtensionContext
    ): Promise<any> {
        let combineInstructionContent: string;
        let instructionsUsedInfo: string;

        // Traditional method: use all instructions
        combineInstructionContent = instructions
            .filter((i) => i.exists)
            .map((i) => i.content)
            .join("\n\n");
        instructionsUsedInfo = `Traditional instructions (${
            instructions.filter((i) => i.exists).length
        } files)`;

        const reviewResult = await SendReviewDiffChangeRequest(
            type,
            combineInstructionContent,
            content,
            context,
            undefined,
            selectedModel
        );

        // Prepare result data
        const resultData = {
            summary: `Review completed for selected files`,
            instructionsUsed: instructionsUsedInfo,
            content: reviewResult || "No review content generated",
            isMultiPart: false,
        };

        // Check if this was handled as a multi-part review (which already stores its own result)
        const reviewResultService = ReviewResultService.getInstance();
        const currentResult = reviewResultService.getCurrentReviewResult();

        // Only store result if it wasn't already stored by multi-part flow
        if (!currentResult || !currentResult.reviewResults.isMultiPart) {
            // Store the review result in memory
            reviewResultService.storeReviewResult('FILE',
                {
                currentBranch: 'N/A',
                baseBranch: 'N/A',
                selectedCommit: undefined,
                selectedModel: selectedModel,
                diff: '',
                diffSummary: {
                    files: fileNames,
                    insertions: 0,
                    deletions: 0
                },
                createdAt: new Date()
            }, resultData);

            // Show review history after data has been stored (avoid timing issues)
            setTimeout(() => {
                ReviewHistoryView.createOrShow(context);
            }, 100); // Small delay to ensure data is fully saved
        }

        return {
            summary: resultData.summary,
            instructionsUsed: resultData.instructionsUsed,
            suggestions: [],
            issues: [],
            result: reviewResult,
        };
    }

    /**
     * Present review results to user
     */
    private async presentReviewResults(
        reviewResults: any,
        params: ReviewProcessParams
    ): Promise<void> {
        const compareInfo = params.selectedCommit
            ? `from commit ${params.selectedCommit.substring(0, 8)}`
            : `from branch ${params.baseBranch}`;

        // Simple completion notification without action buttons
        // since Review History is already shown automatically
        const disposable = vscode.window.showInformationMessage(
            `Review processing completed!\n\n` +
                `Comparing ${params.currentBranch} ${compareInfo}\n` +
                `${reviewResults.summary}\n` +
                `Instructions used: ${reviewResults.instructionsUsed}`
        );

        // Auto-close after 10 seconds
        setTimeout(() => {
            if (disposable) {
                disposable.then((selection) => {
                    // Auto-close after timeout
                });
            }
        }, 10000);
    }

    /**
     * Show diff viewer with current review data
     */
    private async showDiffViewer(): Promise<void> {
        try {
            const reviewDataService = GitReviewDataService.getInstance();
            const reviewData = reviewDataService.getReviewData();

            if (!reviewData) {
                vscode.window.showErrorMessage(
                    "No review data available for diff viewer"
                );
                return;
            }

            if (!this.extensionContext) {
                vscode.window.showErrorMessage(
                    "Extension context not available"
                );
                return;
            }

            const diffViewerService = DiffViewerService.getInstance();
            await diffViewerService.showDiffViewer(
                reviewData,
                this.extensionContext,
                {
                    showLineNumbers: true,
                    highlightChanges: true,
                    splitView: false,
                }
            );

            vscode.window.showInformationMessage(
                "📊 Diff viewer opened successfully!"
            );
        } catch (error) {
            console.error("Error showing diff viewer:", error);
            vscode.window.showErrorMessage(
                `Failed to show diff viewer: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    /**
     * Post review to Slack
     */
    private async postReviewToSlack(reviewResults: any): Promise<void> {
        try {
            const slackService = SlackService.getInstance();

            if (!slackService.isSlackConfigured()) {
                const result = await vscode.window.showWarningMessage(
                    "Slack is not configured. Please set up webhook URL in settings.",
                    "Open Settings",
                    "Cancel"
                );

                if (result === "Open Settings") {
                    vscode.commands.executeCommand(
                        "workbench.action.openSettings",
                        "premergeReview.slack"
                    );
                }
                return;
            }

            const reviewContent = this.formatReviewForSlack(reviewResults);
            const success = await slackService.postReviewToSlack(reviewContent);

            if (success) {
                vscode.window.showInformationMessage(
                    "✅ Review posted to Slack successfully!"
                );
            }
        } catch (error) {
            console.error("Error posting to Slack:", error);
            vscode.window.showErrorMessage(
                `Failed to post to Slack: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    /**
     * Format review results for Slack
     */
    private formatReviewForSlack(reviewResults: any): string {
        const reviewDataService = GitReviewDataService.getInstance();
        const reviewData = reviewDataService.getReviewData();

        if (!reviewData) {
            return "Review completed but no data available for formatting.";
        }

        const compareInfo = reviewData.selectedCommit
            ? `from commit \`${reviewData.selectedCommit.substring(0, 8)}\``
            : `compared to \`${reviewData.baseBranch}\``;

        return `
## 🔍 Code Review Summary

**Branch:** \`${reviewData.currentBranch}\` ${compareInfo}
**Summary:** ${reviewResults.summary}
**Files Changed:** ${reviewData.diffSummary.files.length}
**Changes:** +${reviewData.diffSummary.insertions} -${
            reviewData.diffSummary.deletions
        }
**Instructions Used:** ${reviewResults.instructionsUsed}
**Issues Found:** ${reviewResults.issues?.length || 0}
**Suggestions:** ${reviewResults.suggestions?.length || 0}

*Generated by PreMerge Review at ${new Date().toLocaleString()}*
        `.trim();
    }

    /**
     * Get configured instruction file paths
     */
    public getConfiguredInstructionPaths(): string[] {
        const config = vscode.workspace.getConfiguration("premergeReview");
        return config.get("instructionFiles", [
            ".github/instructions.md",
            ".github/review-instructions.md",
            "docs/review-guidelines.md",
        ]);
    }

    /**
     * Update instruction file paths in settings
     */
    public async updateInstructionPaths(paths: string[]): Promise<void> {
        const config = vscode.workspace.getConfiguration("premergeReview");
        await config.update(
            "instructionFiles",
            paths,
            vscode.ConfigurationTarget.Workspace
        );
        vscode.window.showInformationMessage(
            "Instruction file paths updated successfully"
        );
    }

    /**
     * Get Git repository URL
     */
    private async getGitRepoUrl(): Promise<string | undefined> {
        try {
            const simpleGit = require("simple-git");
            const git = simpleGit(this.workspaceRoot);

            // Get list of remotes
            const remotes = await git.getRemotes(true);

            // Find origin remote or use the first available
            const originRemote =
                remotes.find((remote: any) => remote.name === "origin") ||
                remotes[0];

            if (originRemote && originRemote.refs && originRemote.refs.fetch) {
                return originRemote.refs.fetch;
            }

            return undefined;
        } catch (error) {
            console.error("Error getting git repository URL:", error);
            return undefined;
        }
    }

    /**
     * Get reviewer name from git config or VS Code environment
     */
    private async getReviewerName(): Promise<string> {
        try {
            const simpleGit = require("simple-git");
            const git = simpleGit(this.workspaceRoot);

            // Try to get git username
            const gitConfig = await git.listConfig();
            const userName = gitConfig.all["user.name"];
            const userEmail = gitConfig.all["user.email"];

            if (userName) {
                return userEmail ? `${userName} <${userEmail}>` : userName;
            }

            // Fallback to VS Code username or machine ID
            return (
                vscode.env.remoteName ||
                vscode.env.machineId ||
                "Unknown Reviewer"
            );
        } catch (error) {
            console.error("Error getting reviewer name:", error);
            return vscode.env.machineId || "Unknown Reviewer";
        }
    }
}
