import * as vscode from "vscode";
import { ReviewResultView } from './reviewResultView';

export interface AuditContext {
    reviewer: string;
    reviewTime: string;
    sourceBranch: string;
    targetBranch: string;
    commitRange?: {
        fromCommit?: string;
        toCommit?: string;
    };
    workspaceName?: string;
    gitRepoUrl?: string;
}

export async function SendReviewDiffChangeRequest(
    instructionContents: string,
    diffChangeContent: string,
    auditContext: AuditContext,
    context: vscode.ExtensionContext
): Promise<string | null> {
    // Get maxTokensPerPart from user settings
    const config = vscode.workspace.getConfiguration('premergeReview');
    const maxTokensPerPart = config.get<number>('maxTokensPerPart', 8000);
    
    const estimatedTokens = Math.ceil(diffChangeContent.length / 4); // Rough estimate: 4 chars per token
    
    if (estimatedTokens <= maxTokensPerPart) {
        // Single request for small diffs
        return await sendSingleReviewRequest(instructionContents, diffChangeContent, auditContext, context);
    } else {
        // Split into multiple parts for large diffs
        return await sendMultiPartReviewRequest(instructionContents, diffChangeContent, auditContext, context, maxTokensPerPart);
    }
}

async function sendSingleReviewRequest(
    instructionContents: string,
    diffChangeContent: string,
    auditContext: AuditContext,
    context: vscode.ExtensionContext
): Promise<string | null> {
    const prompt = createReviewPrompt(instructionContents, diffChangeContent, auditContext, false);

    return await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: "Asking Copilot...",
            cancellable: true,
        },
        async (progress, token) => {
            try {
                const responseAsString = await sendToCopilot(prompt, progress, token);
                
                if (responseAsString) {
                    // Show review result in a nice webview
                    ReviewResultView.createOrShow(responseAsString, context);
                }

                return responseAsString;
            } catch (error) {
                console.error("Error during Copilot request:", error);
                vscode.window.showErrorMessage(
                    `Failed to generate review feedback: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
                return null;
            }
        }
    );
}

async function sendMultiPartReviewRequest(
    instructionContents: string,
    diffChangeContent: string,
    auditContext: AuditContext,
    context: vscode.ExtensionContext,
    maxTokensPerPart: number
): Promise<string | null> {
    return await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: "Processing large diff in multiple parts...",
            cancellable: true,
        },
        async (progress, token) => {
            try {
                // Split diff into parts
                const diffParts = splitDiffIntoParts(diffChangeContent, maxTokensPerPart);
                const reviewParts: string[] = [];

                progress.report({
                    increment: 5,
                    message: `Split diff into ${diffParts.length} parts...`,
                });

                // Process each part
                for (let i = 0; i < diffParts.length; i++) {
                    if (token.isCancellationRequested) {
                        break;
                    }

                    const partNumber = i + 1;
                    const isPartialReview = true;
                    const prompt = createReviewPrompt(
                        instructionContents, 
                        diffParts[i], 
                        auditContext,
                        isPartialReview, 
                        partNumber, 
                        diffParts.length
                    );

                    progress.report({
                        increment: (80 / diffParts.length),
                        message: `Processing part ${partNumber}/${diffParts.length}...`,
                    });

                    const partResponse = await sendToCopilot(prompt, progress, token, false);
                    if (partResponse) {
                        reviewParts.push(`## Part ${partNumber}/${diffParts.length}\n\n${partResponse}`);
                    }
                }

                if (reviewParts.length === 0) {
                    throw new Error("No review parts were processed successfully");
                }

                // Merge all parts and create final summary
                progress.report({
                    increment: 90,
                    message: "Merging review parts and generating summary...",
                });

                const mergedReview = await mergeReviewParts(reviewParts, instructionContents, progress, token);
                
                progress.report({
                    increment: 100,
                    message: "Multi-part review completed!",
                });

                if (mergedReview) {
                    // Show merged review result in webview
                    ReviewResultView.createOrShow(mergedReview, context);
                }

                return mergedReview;

            } catch (error) {
                console.error("Error during multi-part Copilot request:", error);
                vscode.window.showErrorMessage(
                    `Failed to generate multi-part review: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
                return null;
            }
        }
    );
}

function createReviewPrompt(
    instructionContents: string, 
    diffContent: string, 
    auditContext: AuditContext,
    isPartialReview: boolean = false,
    partNumber?: number,
    totalParts?: number
): string {
    const partInfo = isPartialReview && partNumber && totalParts 
        ? `\n\nNOTE: This is part ${partNumber} of ${totalParts} of a larger diff. Focus on reviewing this specific part, but keep in mind it's part of a larger change set.`
        : '';

    // Create audit context section
    const auditInfo = `
Review Context:
- Reviewer: ${auditContext.reviewer}
- Review Time: ${auditContext.reviewTime}
- Source Branch: ${auditContext.sourceBranch}
- Target Branch: ${auditContext.targetBranch}${auditContext.commitRange?.fromCommit ? `
- From Commit: ${auditContext.commitRange.fromCommit}` : ''}${auditContext.commitRange?.toCommit ? `
- To Commit: ${auditContext.commitRange.toCommit}` : ''}${auditContext.workspaceName ? `
- Workspace: ${auditContext.workspaceName}` : ''}${auditContext.gitRepoUrl ? `
- Repository: ${auditContext.gitRepoUrl}` : ''}
`;

// return `
// Audit Context:
// ----------------------------------    
// ${auditInfo}


// Review Instructions (MANDATORY):
// ----------------------------------
// ${instructionContents}



// Code Changes to Review:
// ----------------------------------
// ${diffContent}


// ${partInfo ? `Additional Context:\n----------------------------------\n${partInfo}\n\n` : ''}

// Review Requirement:
// You must perform a detailed code review **based strictly on the instructions provided above**.

// Your review must include the following:
// 1. **Overall assessment of the changes**  
// 2. **Potential issues or improvements**  
// 3. **Code quality feedback**  
// 4. **Best practices recommendations**
// ${isPartialReview ? '5. Dependencies or connections with other parts' : ''}
// `;

    return `
Based on the following audit context:
----------------------------------    
${auditInfo}
---------------------------------- 
And require to following the instructions:
----------------------------------
${instructionContents}
----------------------------------
And require to review the following code changes:
----------------------------------
${diffContent}
----------------------------------

${partInfo}

And require to provide:
1. Overall assessment of the changes
2. Potential issues or improvements
3. Code quality feedback
4. Best practices recommendations
${isPartialReview ? '5. Note any dependencies or connections this part might have with other parts' : ''}
    `;
}

function splitDiffIntoParts(diffContent: string, maxTokensPerPart: number): string[] {
    const maxCharsPerPart = maxTokensPerPart * 4; // Rough estimate: 4 chars per token
    const parts: string[] = [];
    
    // Try to split by file boundaries first
    const fileBlocks = diffContent.split(/^diff --git/m);
    
    let currentPart = '';
    
    for (let i = 0; i < fileBlocks.length; i++) {
        const block = i === 0 ? fileBlocks[i] : 'diff --git' + fileBlocks[i];
        
        // If adding this block would exceed the limit
        if (currentPart.length + block.length > maxCharsPerPart && currentPart.length > 0) {
            parts.push(currentPart.trim());
            currentPart = block;
        } else {
            currentPart += (currentPart.length > 0 ? '\n' : '') + block;
        }
    }
    
    // Add the last part
    if (currentPart.trim().length > 0) {
        parts.push(currentPart.trim());
    }
    
    // If we still have parts that are too large, split them further by lines
    const finalParts: string[] = [];
    for (const part of parts) {
        if (part.length <= maxCharsPerPart) {
            finalParts.push(part);
        } else {
            const subParts = splitLargePart(part, maxCharsPerPart);
            finalParts.push(...subParts);
        }
    }
    
    return finalParts.filter(part => part.trim().length > 0);
}

function splitLargePart(content: string, maxChars: number): string[] {
    const lines = content.split('\n');
    const parts: string[] = [];
    let currentPart = '';
    
    for (const line of lines) {
        if (currentPart.length + line.length + 1 > maxChars && currentPart.length > 0) {
            parts.push(currentPart.trim());
            currentPart = line;
        } else {
            currentPart += (currentPart.length > 0 ? '\n' : '') + line;
        }
    }
    
    if (currentPart.trim().length > 0) {
        parts.push(currentPart.trim());
    }
    
    return parts;
}

async function mergeReviewParts(
    reviewParts: string[], 
    instructionContents: string,
    progress: vscode.Progress<{increment?: number, message?: string}>,
    token: vscode.CancellationToken
): Promise<string | null> {
    const combinedParts = reviewParts.join('\n\n---\n\n');
    
    const mergePrompt = `Based on the following review instructions:
----------------------------------
${instructionContents}
----------------------------------

I have received multiple review parts for a large code diff. Please merge these reviews into a comprehensive, cohesive final review:

${combinedParts}

Please provide:
1. A consolidated overall assessment
2. All important issues and improvements (deduplicated)
3. Overall code quality feedback
4. Best practices recommendations
5. A summary of the most critical points

Make sure to:
- Remove any redundant points between parts
- Prioritize the most important issues
- Provide a coherent narrative
- Keep the final review well-structured and actionable
    `;

    return await sendToCopilot(mergePrompt, progress, token, false);
}

async function sendToCopilot(
    prompt: string, 
    progress: vscode.Progress<{increment?: number, message?: string}>,
    token: vscode.CancellationToken,
    updateProgress: boolean = true
): Promise<string | null> {
    try {
        if (updateProgress) {
            progress.report({
                increment: 10,
                message: "Selecting Copilot model...",
            });
        }

        const [model] = await vscode.lm.selectChatModels({
            family: "gpt-4o",
        });

        if (!model) {
            throw new Error("No suitable model found for Copilot chat.");
        }

        if (updateProgress) {
            progress.report({
                increment: 30,
                message: "Sending request to Copilot...",
            });
        }

        const messages: vscode.LanguageModelChatMessage[] = [
            vscode.LanguageModelChatMessage.User(prompt),
        ];

        const response = await model.sendRequest(messages, {}, token);

        if (updateProgress) {
            progress.report({
                increment: 50,
                message: "Processing response...",
            });
        }

        const responseAsString = await GetRequestResponse(response, token);
        
        if (updateProgress) {
            progress.report({
                increment: 100,
                message: "Review completed!",
            });
        }

        return responseAsString;
    } catch (error) {
        console.error("Error in sendToCopilot:", error);
        throw error;
    }
}

async function GetRequestResponse(response: vscode.LanguageModelChatResponse, token: vscode.CancellationToken): Promise<string> {
    let responseAsString = "";

    for await (const chunk of response.stream) {
        if (token.isCancellationRequested) {
            console.warn("Request cancelled by user.");
            break;
        }

        responseAsString += (chunk as any).value || '';
    }

    return responseAsString;
}