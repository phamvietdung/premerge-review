import * as vscode from 'vscode';

export function getExtensionSetting<T = any>(key: string, defaultValue?: T): T | undefined {
    const config = vscode.workspace.getConfiguration('premergeReview');
    return config.get<T>(key, defaultValue as T);
}