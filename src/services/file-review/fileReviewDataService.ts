/**
 * FileReviewDataService - Quản lý dữ liệu review file content hiện tại trong bộ nhớ (không liên quan git).
 *
 * Các function chính:
 * - getInstance: singleton instance cho service
 * - setReviewData: lưu dữ liệu review file hiện tại
 * - getReviewData: lấy dữ liệu review file hiện tại
 * - clearReviewData: xóa dữ liệu review khỏi bộ nhớ
 * - hasReviewData: kiểm tra có dữ liệu review không
 * - getReviewSummary: trả về summary ngắn gọn về review file hiện tại
 */
import * as vscode from 'vscode';

export interface FileReviewData {
    fileName: string;
    content: string;
    selectedModel?: string;
    createdAt: Date;
}

export class FileReviewDataService {
    private static instance: FileReviewDataService;
    private currentReviewData: FileReviewData | null = null;
    private fileReviewList: FileReviewData[] = [];

    private constructor() {}

    public static getInstance(): FileReviewDataService {
        if (!FileReviewDataService.instance) {
            FileReviewDataService.instance = new FileReviewDataService();
        }
        return FileReviewDataService.instance;
    }

    public setReviewData(data: FileReviewData): void {
        this.currentReviewData = data;
        console.log('File review data stored in memory:', {
            fileName: data.fileName,
            contentLength: data.content.length,
            model: data.selectedModel
        });
    }

    public getReviewData(): FileReviewData | null {
        return this.currentReviewData;
    }

    public clearReviewData(): void {
        this.currentReviewData = null;
        console.log('File review data cleared from memory');
    }

    public hasReviewData(): boolean {
        return this.currentReviewData !== null;
    }

    // --- List management ---
    public addFileReview(data: FileReviewData): void {
        this.fileReviewList.push(data);
        console.log('Added file to review list:', data.fileName);
    }

    public removeFileReview(fileName: string): void {
        this.fileReviewList = this.fileReviewList.filter(f => f.fileName !== fileName);
        console.log('Removed file from review list:', fileName);
    }

    public getFileReviewList(): FileReviewData[] {
        return this.fileReviewList;
    }

    public clearFileReviewList(): void {
        this.fileReviewList = [];
        console.log('Cleared file review list');
    }

    public getReviewSummary(): string {
        if (!this.currentReviewData) {
            return 'No file review data available';
        }
        const data = this.currentReviewData;
        return `File: ${data.fileName}\nContent length: ${data.content.length}\nModel: ${data.selectedModel || 'N/A'}\nCreated: ${data.createdAt.toLocaleString()}`;
    }
}
