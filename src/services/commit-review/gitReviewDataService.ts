/**
 * GitReviewDataService - Quản lý dữ liệu review git diff hiện tại (ReviewData) trong bộ nhớ.
 *
 * Các function chính:
 * - getInstance: singleton instance cho service
 * - setReviewData: lưu dữ liệu review hiện tại
 * - getReviewData: lấy dữ liệu review hiện tại
 * - clearReviewData: xóa dữ liệu review khỏi bộ nhớ
 * - hasReviewData: kiểm tra có dữ liệu review không
 * - getReviewSummary: trả về summary ngắn gọn về review hiện tại
 */
import * as vscode from 'vscode';

export interface ReviewData {
    currentBranch: string;
    baseBranch: string;
    selectedCommit?: string; // Optional commit hash to compare from
    selectedModel?: string; // Optional chat model to use for review
    diff: string;
    diffSummary: {
        files: string[];
        insertions: number;
        deletions: number;
    };
    createdAt: Date;
}


export class GitReviewDataService {
    private static instance: GitReviewDataService;
    private currentReviewData: ReviewData | null = null;

    private constructor() {}

    public static getInstance(): GitReviewDataService {
        if (!GitReviewDataService.instance) {
            GitReviewDataService.instance = new GitReviewDataService();
        }
        return GitReviewDataService.instance;
    }

    public setReviewData(data: ReviewData): void {
        this.currentReviewData = data;
        console.log('Review data stored in memory:', {
            branches: `${data.currentBranch} → ${data.baseBranch}`,
            filesChanged: data.diffSummary.files.length,
            insertions: data.diffSummary.insertions,
            deletions: data.diffSummary.deletions,
            diffSize: data.diff.length
        });
    }

    public getReviewData(): ReviewData | null {
        return this.currentReviewData;
    }

    public clearReviewData(): void {
    this.currentReviewData = null;
    console.log('Review data cleared from memory');
    }

    public hasReviewData(): boolean {
        return this.currentReviewData !== null;
    }

    public getReviewSummary(): string {
        if (!this.currentReviewData) {
            return 'No review data available';
        }

        const data = this.currentReviewData;
        return `Review: ${data.currentBranch} → ${data.baseBranch}
Files changed: ${data.diffSummary.files.length}
Insertions: +${data.diffSummary.insertions}
Deletions: -${data.diffSummary.deletions}
Created: ${data.createdAt.toLocaleString()}`;
    }
}
