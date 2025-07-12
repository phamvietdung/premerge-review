import * as vscode from 'vscode';
import { simpleGit, SimpleGit, BranchSummary, LogResult } from 'simple-git';

export interface GitCommit {
    hash: string;
    date: string;
    message: string;
    author: string;
    shortHash: string;
}

export interface GitInfo {
    currentBranch: string;
    allBranches: string[];
    remoteBranches: string[];
    isGitRepo: boolean;
}

export class GitService {
    private git: SimpleGit;
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.git = simpleGit(workspaceRoot);
    }

    async getGitInfo(): Promise<GitInfo> {
        try {
            // Check if it's a git repository
            const isRepo = await this.git.checkIsRepo();
            if (!isRepo) {
                return {
                    currentBranch: '',
                    allBranches: [],
                    remoteBranches: [],
                    isGitRepo: false
                };
            }

            // Get current branch
            const status = await this.git.status();
            const currentBranch = status.current || '';

            // Get all branches (local and remote)
            const branchSummary: BranchSummary = await this.git.branch(['-a']);
            
            // Extract local branches
            const localBranches = Object.keys(branchSummary.branches)
                .filter(branch => !branch.startsWith('remotes/'))
                .filter(branch => branch !== 'HEAD')
                .sort();

            // Extract remote branches (remove remotes/origin/ prefix)
            const remoteBranches = Object.keys(branchSummary.branches)
                .filter(branch => branch.startsWith('remotes/origin/'))
                .map(branch => branch.replace('remotes/origin/', ''))
                .filter(branch => branch !== 'HEAD')
                .filter(branch => !localBranches.includes(branch))
                .sort();

            // Combine all unique branches, but validate they exist
            const allBranchCandidates = Array.from(new Set([...localBranches, ...remoteBranches]));
            const validBranches: string[] = [];

            // Validate each branch exists
            for (const branch of allBranchCandidates) {
                try {
                    // Check if branch exists locally or remotely
                    const variations = [branch, `origin/${branch}`, `remotes/origin/${branch}`];
                    let branchExists = false;
                    
                    for (const variation of variations) {
                        try {
                            await this.git.raw(['rev-parse', '--verify', variation]);
                            branchExists = true;
                            break;
                        } catch {
                            continue;
                        }
                    }
                    
                    if (branchExists) {
                        validBranches.push(branch);
                    }
                } catch {
                    // Skip invalid branches
                    console.log(`Skipping invalid branch: ${branch}`);
                }
            }

            return {
                currentBranch,
                allBranches: validBranches.sort(),
                remoteBranches,
                isGitRepo: true
            };

        } catch (error) {
            console.error('Git error:', error);
            vscode.window.showErrorMessage(`Git error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            
            return {
                currentBranch: '',
                allBranches: [],
                remoteBranches: [],
                isGitRepo: false
            };
        }
    }

    async getCurrentBranch(): Promise<string> {
        try {
            const status = await this.git.status();
            return status.current || '';
        } catch (error) {
            console.error('Error getting current branch:', error);
            return '';
        }
    }

    async getAllBranches(): Promise<string[]> {
        try {
            const branchSummary = await this.git.branch(['-a']);
            return Object.keys(branchSummary.branches)
                .filter(branch => !branch.startsWith('remotes/') || branch.startsWith('remotes/origin/'))
                .map(branch => branch.replace('remotes/origin/', ''))
                .filter(branch => branch !== 'HEAD')
                .sort();
        } catch (error) {
            console.error('Error getting branches:', error);
            return [];
        }
    }

    async refreshBranches(): Promise<void> {
        try {
            // Fetch latest from remote
            await this.git.fetch();
        } catch (error) {
            console.error('Error fetching from remote:', error);
            vscode.window.showWarningMessage('Could not fetch latest branches from remote');
        }
    }

    async getDiff(baseBranch: string, currentBranch: string): Promise<string> {
        try {
            // Get diff between two branches
            const diff = await this.git.diff([`${baseBranch}...${currentBranch}`]);
            return diff;
        } catch (error) {
            console.error('Error getting diff:', error);
            vscode.window.showErrorMessage(`Failed to get diff between ${baseBranch} and ${currentBranch}`);
            return '';
        }
    }

    async getDiffSummary(baseBranch: string, currentBranch: string): Promise<{ 
        files: string[], 
        insertions: number, 
        deletions: number,
        diff: string 
    }> {
        try {
            // Get detailed diff with file statistics
            const diffSummary = await this.git.diffSummary([`${baseBranch}...${currentBranch}`]);
            const diff = await this.getDiff(baseBranch, currentBranch);
            
            return {
                files: diffSummary.files.map(file => file.file),
                insertions: diffSummary.insertions,
                deletions: diffSummary.deletions,
                diff: diff
            };
        } catch (error) {
            console.error('Error getting diff summary:', error);
            return {
                files: [],
                insertions: 0,
                deletions: 0,
                diff: ''
            };
        }
    }

    async getDiffFromCommit(commitHash: string, currentBranch: string): Promise<string> {
        try {
            // Get diff from specific commit to current branch
            const diff = await this.git.diff([`${commitHash}...${currentBranch}`]);
            return diff;
        } catch (error) {
            console.error('Error getting diff from commit:', error);
            vscode.window.showErrorMessage(`Failed to get diff from commit ${commitHash}`);
            return '';
        }
    }

    async getDiffSummaryFromCommit(commitHash: string, currentBranch: string): Promise<{ 
        files: string[], 
        insertions: number, 
        deletions: number,
        diff: string 
    }> {
        try {
            // Get detailed diff with file statistics from commit
            const diffSummary = await this.git.diffSummary([`${commitHash}...${currentBranch}`]);
            const diff = await this.getDiffFromCommit(commitHash, currentBranch);
            
            return {
                files: diffSummary.files.map(file => file.file),
                insertions: diffSummary.insertions,
                deletions: diffSummary.deletions,
                diff: diff
            };
        } catch (error) {
            console.error('Error getting diff summary from commit:', error);
            return {
                files: [],
                insertions: 0,
                deletions: 0,
                diff: ''
            };
        }
    }

    async getBranchCommits(branchName: string, limit: number = 100): Promise<GitCommit[]> {
        try {
            // Try different branch reference variations
            const branchVariations = [
                branchName,
                `origin/${branchName}`,
                `remotes/origin/${branchName}`
            ];

            let logResult: LogResult | null = null;
            let validBranchRef = '';

            // Try each branch variation until we find one that works
            for (const variation of branchVariations) {
                try {
                    // First verify the branch exists
                    await this.git.raw(['rev-parse', '--verify', variation]);
                    
                    // If verification succeeds, try to get the log
                    logResult = await this.git.log([variation, `--max-count=${limit}`]);
                    validBranchRef = variation;
                    break;
                } catch (verifyError) {
                    // Continue to next variation
                    continue;
                }
            }

            if (!logResult) {
                console.log(`No valid branch reference found for: ${branchName}`);
                return [];
            }

            console.log(`Successfully loaded ${logResult.all.length} commits from ${validBranchRef}`);

            return logResult.all.map(commit => ({
                hash: commit.hash,
                shortHash: commit.hash.substring(0, 8),
                date: commit.date,
                message: commit.message,
                author: commit.author_name
            }));

        } catch (error) {
            console.error(`Error getting commits for branch ${branchName}:`, error);
            vscode.window.showErrorMessage(`Failed to get commits for branch ${branchName}`);
            return [];
        }
    }
}
