/**
 * ReviewResultService - Quản lý lưu trữ, truy xuất, format kết quả review.
 *
 * Các function chính:
 * - getInstance: singleton instance cho service
 * - storeReviewResult: lưu 1 kết quả review mới
 * - storeReviewPart: lưu 1 phần kết quả (multi-part review)
 * - storeFinalMergedResult: lưu kết quả tổng hợp cuối cùng cho multi-part
 * - getCurrentReviewResult: lấy kết quả review hiện tại (theo id)
 * - getReviewResult: lấy kết quả review theo id
 * - getAllReviewResults: lấy toàn bộ kết quả review (mới nhất lên đầu)
 * - clearAllResults: xóa toàn bộ kết quả review
 * - clearReviewResult: xóa 1 kết quả review theo id
 * - hasStoredResults: kiểm tra có kết quả review nào không
 * - getLatestReviewResult: lấy kết quả review mới nhất
 * - formatReviewResultForDisplay: format kết quả review ra markdown để hiển thị
 */
import * as vscode from 'vscode';

export interface ReviewResultData {
    id: string;
    timestamp: Date;
    reviewData: {
        currentBranch: string;
        baseBranch: string;
        selectedCommit?: string;
        diffSummary: {
            files: number;
            insertions: number;
            deletions: number;
        };
        diff?: string; // Store the actual diff content for DiffViewerService
    };
    reviewResults: {
        summary: string;
        instructionsUsed: string;
        content: string;
        isMultiPart?: boolean;
        parts?: ReviewPartResult[];
        finalMergedResult?: string;
    };
    sharedGitsUrl?: string;
}

export interface ReviewPartResult {
    partNumber: number;
    totalParts: number;
    content: string;
    timestamp: Date;
}

export class ReviewResultService {
    private extensionContext: vscode.ExtensionContext | null = null;
    private static instance: ReviewResultService;
    private reviewResults: Map<string, ReviewResultData> = new Map();
    private currentReviewId: string | null = null;

    private constructor() {}

    public initialize(context: vscode.ExtensionContext) {
        this.extensionContext = context;
        this.loadFromStorage();
    }

    public static getInstance(): ReviewResultService {
        if (!ReviewResultService.instance) {
            ReviewResultService.instance = new ReviewResultService();
        }
        return ReviewResultService.instance;
    }

    /**
     * Store a review result
     */
    public storeReviewResult(reviewData: any, reviewResults: any): string {
        const reviewId = this.generateReviewId();
        const resultData: ReviewResultData = {
            id: reviewId,
            timestamp: new Date(),
            reviewData,
            reviewResults
        };
        this.reviewResults.set(reviewId, resultData);
        this.currentReviewId = reviewId;
        this.saveToStorage();
        console.log(`Review result stored with ID: ${reviewId}`);
        return reviewId;
    }

    /**
     * Store a review part (for multi-part reviews)
     */
    public storeReviewPart(
        reviewId: string,
        partNumber: number,
        totalParts: number,
        content: string
    ): void {
        const existingResult = this.reviewResults.get(reviewId);
        if (!existingResult) {
            console.error(`Review with ID ${reviewId} not found`);
            return;
        }

        if (!existingResult.reviewResults.parts) {
            existingResult.reviewResults.parts = [];
        }

        const partResult: ReviewPartResult = {
            partNumber,
            totalParts,
            content,
            timestamp: new Date()
        };

    existingResult.reviewResults.parts.push(partResult);
    existingResult.reviewResults.isMultiPart = true;
    this.saveToStorage();
    console.log(`Review part ${partNumber}/${totalParts} stored for review ${reviewId}`);
    }

    /**
     * Store the final merged result for multi-part reviews
     */
    public storeFinalMergedResult(reviewId: string, mergedContent: string): void {
        const existingResult = this.reviewResults.get(reviewId);
        if (!existingResult) {
            console.error(`Review with ID ${reviewId} not found`);
            return;
        }

    existingResult.reviewResults.finalMergedResult = mergedContent;
    this.saveToStorage();
    console.log(`Final merged result stored for review ${reviewId}`);
    }

    /**
     * Get the current review result
     */
    public getCurrentReviewResult(): ReviewResultData | null {
        if (!this.currentReviewId) {
            return null;
        }
        return this.reviewResults.get(this.currentReviewId) || null;
    }

    /**
     * Get a specific review result by ID
     */
    public getReviewResult(reviewId: string): ReviewResultData | null {
        return this.reviewResults.get(reviewId) || null;
    }

    public setSharedGitsUrl(reviewId: string, url: string) {
        const review = this.reviewResults.get(reviewId);
        if (review) {
            review.sharedGitsUrl = url;
            this.saveToStorage();
        }
    }

    /**
     * Get all review results
     */
    public getAllReviewResults(): ReviewResultData[] {
        return Array.from(this.reviewResults.values()).sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );
    }

    /**
     * Clear all review results
     */
    public clearAllResults(): void {
        this.reviewResults.clear();
        this.currentReviewId = null;
        this.saveToStorage();
        console.log('All review results cleared');
    }

    /**
     * Clear a specific review result
     */
    public clearReviewResult(reviewId: string): boolean {
        const deleted = this.reviewResults.delete(reviewId);
        if (this.currentReviewId === reviewId) {
            this.currentReviewId = null;
        }
        if (deleted) {
            this.saveToStorage();
        }
        return deleted;
    }

    private getStorageKey(): string {
        const wsFolders = vscode.workspace.workspaceFolders;
        if (wsFolders && wsFolders.length > 0) {
            // Có thể dùng fsPath hoặc hash để tránh key quá dài
            return `commitReviewResults_${encodeURIComponent(wsFolders[0].uri.fsPath)}`;
        }
        return 'commitReviewResults_global';
    }

    private saveToStorage() {
        if (!this.extensionContext) return;
        // Convert Map to array and Date to ISO string
        const arr = Array.from(this.reviewResults.values()).map(r => ({
            ...r,
            timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
            reviewResults: {
                ...r.reviewResults,
                parts: r.reviewResults.parts ? r.reviewResults.parts.map(p => ({
                    ...p,
                    timestamp: p.timestamp instanceof Date ? p.timestamp.toISOString() : p.timestamp
                })) : undefined
            },
            sharedGitsUrl: r.sharedGitsUrl || undefined
        }));
        this.extensionContext.globalState.update(this.getStorageKey(), arr);
    }

    private loadFromStorage() {
        if (!this.extensionContext) return;
        const arr = this.extensionContext.globalState.get<any[]>(this.getStorageKey(), []);
        this.reviewResults.clear();
        arr.forEach(r => {
            this.reviewResults.set(r.id, {
                ...r,
                timestamp: r.timestamp ? new Date(r.timestamp) : new Date(),
                reviewResults: {
                    ...r.reviewResults,
                    parts: r.reviewResults.parts ? r.reviewResults.parts.map((p: any) => ({
                        ...p,
                        timestamp: p.timestamp ? new Date(p.timestamp) : new Date()
                    })) : undefined
                },
                sharedGitsUrl: r.sharedGitsUrl || undefined
            });
        });
    }

    /**
     * Check if there are any stored review results
     */
    public hasStoredResults(): boolean {
        return this.reviewResults.size > 0;
    }

    /**
     * Get the latest review result
     */
    public getLatestReviewResult(): ReviewResultData | null {
        const results = this.getAllReviewResults();
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Generate a unique review ID
     */
    private generateReviewId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `review_${timestamp}_${random}`;
    }

    /**
     * Format review result for display
     */
    public formatReviewResultForDisplay(reviewResult: ReviewResultData): string {
        const { reviewData, reviewResults } = reviewResult;
        
        let content = `# Code Review Result\n\n`;
        content += `**Review ID:** ${reviewResult.id}\n`;
        content += `**Timestamp:** ${reviewResult.timestamp.toLocaleString()}\n\n`;
        
        const compareInfo = reviewData.selectedCommit 
            ? `from commit \`${reviewData.selectedCommit.substring(0, 8)}\``
            : `compared to \`${reviewData.baseBranch}\``;
        
        content += `**Branch:** \`${reviewData.currentBranch}\` ${compareInfo}\n`;
        content += `**Files Changed:** ${reviewData.diffSummary.files}\n`;
        content += `**Changes:** +${reviewData.diffSummary.insertions} -${reviewData.diffSummary.deletions}\n`;
        content += `**Instructions Used:** ${reviewResults.instructionsUsed}\n\n`;

        if (reviewResults.isMultiPart && reviewResults.parts) {
            content += `## Multi-Part Review\n\n`;
            content += `This review was processed in ${reviewResults.parts.length} parts:\n\n`;
            
            reviewResults.parts.forEach((part, index) => {
                content += `### Part ${part.partNumber}/${part.totalParts}\n`;
                content += `*Processed at: ${part.timestamp.toLocaleString()}*\n\n`;
                content += part.content + '\n\n---\n\n';
            });

            if (reviewResults.finalMergedResult) {
                content += `## Final Merged Review\n\n`;
                content += reviewResults.finalMergedResult;
            }
        } else {
            content += `## Review Content\n\n`;
            content += reviewResults.content;
        }

        return content;
    }
}
