/**
 * FileReviewResultService - Quản lý lưu trữ, truy xuất, format kết quả review file.
 *
 * Các function chính:
 * - getInstance: singleton instance cho service
 * - storeReviewResult: lưu 1 kết quả review file mới
 * - getReviewResult: lấy kết quả review file theo id
 * - getAllReviewResults: lấy toàn bộ kết quả review file
 * - clearAllResults: xóa toàn bộ kết quả review file
 * - clearReviewResult: xóa 1 kết quả review file theo id
 * - hasStoredResults: kiểm tra có kết quả review file nào không
 * - getLatestReviewResult: lấy kết quả review file mới nhất
 * - formatReviewResultForDisplay: format kết quả review file ra markdown để hiển thị
 */
import * as vscode from 'vscode';

export interface FileReviewResultData {
    id: string;
    timestamp: Date;
    fileName: string;
    content: string;
    summary?: string;
    instructionsUsed?: string;
}

export class FileReviewResultService {
    private static STORAGE_KEY = 'fileReviewResults';
    private extensionContext: vscode.ExtensionContext | null = null;
    private static instance: FileReviewResultService;
    private reviewResults: Map<string, FileReviewResultData> = new Map();
    private currentReviewId: string | null = null;

    private constructor() {}

    public initialize(context: vscode.ExtensionContext) {
        this.extensionContext = context;
        this.loadFromStorage();
    }

    public static getInstance(): FileReviewResultService {
        if (!FileReviewResultService.instance) {
            FileReviewResultService.instance = new FileReviewResultService();
        }
        return FileReviewResultService.instance;
    }

    /**
     * Store a file review result
     */
    public storeReviewResult(fileName: string, content: string, summary?: string, instructionsUsed?: string): string {
        const reviewId = this.generateReviewId();
        const resultData: FileReviewResultData = {
            id: reviewId,
            timestamp: new Date(),
            fileName,
            content,
            summary,
            instructionsUsed
        };
        this.reviewResults.set(reviewId, resultData);
        this.currentReviewId = reviewId;
        this.saveToStorage();
        return reviewId;
    }

    /**
     * Get a specific file review result by ID
     */
    public getReviewResult(reviewId: string): FileReviewResultData | null {
        return this.reviewResults.get(reviewId) || null;
    }

    /**
     * Get all file review results
     */
    public getAllReviewResults(): FileReviewResultData[] {
        return Array.from(this.reviewResults.values()).sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );
    }

    /**
     * Clear all file review results
     */
    public clearAllResults(): void {
        this.reviewResults.clear();
        this.currentReviewId = null;
        this.saveToStorage();
    }

    /**
     * Clear a specific file review result
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

    private saveToStorage() {
        if (!this.extensionContext) return;
        // Convert Map to array and Date to ISO string
        const arr = Array.from(this.reviewResults.values()).map(r => ({
            ...r,
            timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp
        }));
        this.extensionContext.globalState.update(FileReviewResultService.STORAGE_KEY, arr);
    }

    private loadFromStorage() {
        if (!this.extensionContext) return;
        const arr = this.extensionContext.globalState.get<any[]>(FileReviewResultService.STORAGE_KEY, []);
        this.reviewResults.clear();
        arr.forEach(r => {
            this.reviewResults.set(r.id, {
                ...r,
                timestamp: r.timestamp ? new Date(r.timestamp) : new Date()
            });
        });
    }

    /**
     * Check if there are any stored file review results
     */
    public hasStoredResults(): boolean {
        return this.reviewResults.size > 0;
    }

    /**
     * Get the latest file review result
     */
    public getLatestReviewResult(): FileReviewResultData | null {
        const results = this.getAllReviewResults();
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Generate a unique review ID
     */
    private generateReviewId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `file_review_${timestamp}_${random}`;
    }

    /**
     * Format file review result for display
     */
    public formatReviewResultForDisplay(reviewResult: FileReviewResultData): string {
        let content = `# File Review Result\n\n`;
        content += `**Review ID:** ${reviewResult.id}\n`;
        content += `**Timestamp:** ${reviewResult.timestamp.toLocaleString()}\n`;
        content += `**File:** ${reviewResult.fileName}\n`;
        if (reviewResult.instructionsUsed) {
            content += `**Instructions Used:** ${reviewResult.instructionsUsed}\n`;
        }
        if (reviewResult.summary) {
            content += `**Summary:** ${reviewResult.summary}\n`;
        }
        content += `\n## Content\n\n`;
        content += reviewResult.content;
        return content;
    }
}
