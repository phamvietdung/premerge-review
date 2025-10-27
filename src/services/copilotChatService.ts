import * as vscode from "vscode";
import { ReviewResultView } from './reviewResultView';
import { ReviewHistoryView } from './reviewHistoryView';
import { ReviewResultService } from './reviewResultService';
import { ReviewDataService } from './reviewDataService';

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
    context: vscode.ExtensionContext,
    selectedModelId?: string
): Promise<string | null> {
    // Get maxTokensPerPart from selected model's capacity
    let maxTokensPerPart = 8000; // Default fallback
    
    try {
        if (selectedModelId) {
            // Try to find the specific model to get its token limit
            const models = await vscode.lm.selectChatModels();
            const selectedModel = models.find(m => m.id === selectedModelId);
            
            if (selectedModel && selectedModel.maxInputTokens) {
                // Use 80% of model's max capacity for safety (leave room for instructions)
                maxTokensPerPart = Math.floor(selectedModel.maxInputTokens * 0.8);
                console.log(`Using model ${selectedModel.name || selectedModel.id} with max tokens: ${maxTokensPerPart}`);
            } else {
                console.warn(`Model ${selectedModelId} not found or missing maxInputTokens, using default`);
            }
        }
    } catch (error) {
        console.warn('Error getting model token limits, using default:', error);
    }
    
    const estimatedTokens = Math.ceil(diffChangeContent.length / 4); // Rough estimate: 4 chars per token
    
    if (estimatedTokens <= maxTokensPerPart) {
        // Single request for small diffs
        return await sendSingleReviewRequest(instructionContents, diffChangeContent, auditContext, context, selectedModelId);
    } else {
        // Split into multiple parts for large diffs
        return await sendMultiPartReviewRequest(instructionContents, diffChangeContent, auditContext, context, maxTokensPerPart, selectedModelId);
    }
}

async function sendSingleReviewRequest(
    instructionContents: string,
    diffChangeContent: string,
    auditContext: AuditContext,
    context: vscode.ExtensionContext,
    selectedModelId?: string
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
                const responseAsString = await sendToCopilot(prompt, progress, token, selectedModelId, true);
                
                if (responseAsString) {
                    // Note: ReviewHistoryView will be shown by reviewService after storing result
                    // This avoids timing issues with data not being saved yet
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
    maxTokensPerPart: number,
    selectedModelId?: string
): Promise<string | null> {
    return await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: "Processing large diff in multiple parts (using model's token limit)...",
            cancellable: true,
        },
        async (progress, token) => {
            try {
                // Get current review data for storing parts
                const reviewDataService = ReviewDataService.getInstance();
                const reviewData = reviewDataService.getReviewData();
                
                if (!reviewData) {
                    throw new Error('No review data available for storing multi-part results');
                }

                // Create initial review result entry
                const reviewResultService = ReviewResultService.getInstance();
                const initialResultData = {
                    summary: `Processing large diff in multiple parts...`,
                    instructionsUsed: 'Processing...',
                    content: '',
                    isMultiPart: true,
                    parts: []
                };

                const reviewId = reviewResultService.storeReviewResult(reviewData, initialResultData);

                // Split diff into parts
                const diffParts = splitDiffIntoParts(diffChangeContent, maxTokensPerPart);
                const reviewParts: string[] = [];

                progress.report({
                    increment: 5,
                    message: `Split diff into ${diffParts.length} parts (using ${Math.floor(maxTokensPerPart / 1000)}K token limit)...`,
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

                    const partResponse = await sendToCopilot(prompt, progress, token, selectedModelId, false);
                    if (partResponse) {
                        const partContent = `## Part ${partNumber}/${diffParts.length}\n\n${partResponse}`;
                        reviewParts.push(partContent);
                        
                        // Store each part
                        reviewResultService.storeReviewPart(reviewId, partNumber, diffParts.length, partResponse);
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
                
                const mergedReview = await mergeReviewParts(reviewParts, instructionContents, progress, token, selectedModelId);
                
                progress.report({
                    increment: 100,
                    message: "Multi-part review completed!",
                });

                if (mergedReview) {
                    // Store the final merged result
                    reviewResultService.storeFinalMergedResult(reviewId, mergedReview);
                    
                    // Show review history instead of individual result
                    ReviewHistoryView.createOrShow(context);
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
    token: vscode.CancellationToken,
    selectedModelId?: string
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

    return await sendToCopilot(mergePrompt, progress, token, selectedModelId, false);
}

async function sendToCopilot(
    prompt: string, 
    progress: vscode.Progress<{increment?: number, message?: string}>,
    token: vscode.CancellationToken,
    selectedModelId?: string,
    updateProgress: boolean = true
): Promise<string | null> {
    try {
        if (updateProgress) {
            progress.report({
                increment: 10,
                message: "Selecting Copilot model...",
            });
        }

        // Select model based on selectedModelId or fallback to default
        let model;
        if (selectedModelId) {
            // Try to find the specific model by ID first
            const modelsById = await vscode.lm.selectChatModels();
            model = modelsById.find(m => m.id === selectedModelId);
            
            if (!model) {
                console.warn(`Model with ID ${selectedModelId} not found, falling back to family-based selection`);
                // Fallback: try to extract family from model ID
                const family = extractFamilyFromModelId(selectedModelId);
                if (family) {
                    const [fallbackModel] = await vscode.lm.selectChatModels({ family });
                    model = fallbackModel;
                }
            } else {
                // Validate model availability before using
                const isModelAvailable = await validateModelAvailability(model);
                if (!isModelAvailable) {
                    console.warn(`Model ${selectedModelId} is not available or disabled, trying fallback`);
                    model = undefined;
                    const family = extractFamilyFromModelId(selectedModelId);
                    if (family) {
                        const [fallbackModel] = await vscode.lm.selectChatModels({ family });
                        if (fallbackModel) {
                            const isFallbackAvailable = await validateModelAvailability(fallbackModel);
                            if (isFallbackAvailable) {
                                model = fallbackModel;
                            }
                        }
                    }
                }
            }
        }
        
        // Final fallback to gpt-4o if no model found
        if (!model) {
            console.log('Using fallback model selection for gpt-4o family');
            const [fallbackModel] = await vscode.lm.selectChatModels({
                family: "gpt-4o",
            });
            model = fallbackModel;
        }

        if (!model) {
            throw new Error("No suitable model found for Copilot chat.");
        }

        // Log selected model info
        console.log(`Using AI model: ${model.name || model.id} (${model.vendor}/${model.family})`);

        if (updateProgress) {
            progress.report({
                increment: 30,
                message: `Sending request to ${model.name || model.id}...`,
            });
        }

        const messages: vscode.LanguageModelChatMessage[] = [
            vscode.LanguageModelChatMessage.User(prompt),
        ];

        try {
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
        } catch (sendError) {
            // Handle specific errors related to model availability/permissions
            if (sendError instanceof Error) {
                const errorMessage = sendError.message.toLowerCase();
                
                if (errorMessage.includes('permission') || 
                    errorMessage.includes('access') || 
                    errorMessage.includes('denied') ||
                    errorMessage.includes('disabled') ||
                    errorMessage.includes('quota') ||
                    errorMessage.includes('limit')) {
                    
                    console.error(`Model ${model.id} access error:`, sendError.message);
                    vscode.window.showWarningMessage(
                        `AI model "${model.name || model.id}" is not accessible (${sendError.message}). Trying alternative models...`,
                        'Check Settings'
                    ).then(selection => {
                        if (selection === 'Check Settings') {
                            vscode.commands.executeCommand('workbench.action.openSettings', 'github.copilot');
                        }
                    });
                    
                    // Try to find an alternative model
                    const alternativeModel = await findAlternativeModel(model, selectedModelId);
                    if (alternativeModel) {
                        console.log(`Retrying with alternative model: ${alternativeModel.name || alternativeModel.id}`);
                        const retryResponse = await alternativeModel.sendRequest(messages, {}, token);
                        return await GetRequestResponse(retryResponse, token);
                    }
                }
            }
            
            throw sendError;
        }
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

/**
 * Extract family name from model ID for fallback selection
 */
function extractFamilyFromModelId(modelId: string): string | null {
    // Common patterns for model IDs
    if (modelId.includes('gpt-4o')) return 'gpt-4o';
    if (modelId.includes('gpt-4')) return 'gpt-4';
    if (modelId.includes('gpt-3.5')) return 'gpt-3.5-turbo';
    if (modelId.includes('claude-3')) return 'claude-3';
    if (modelId.includes('claude')) return 'claude';
    if (modelId.includes('gemini')) return 'gemini';
    
    // Extract family from common naming patterns
    const patterns = [
        /^(gpt-[\d\.]+[a-z]*)/i,
        /^(claude-[\d\.]+[a-z]*)/i,
        /^(gemini[a-z-]*)/i,
    ];
    
    for (const pattern of patterns) {
        const match = modelId.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
    return null;
}

/**
 * Validate if a model is available and can be used
 */
async function validateModelAvailability(model: vscode.LanguageModelChat): Promise<boolean> {
    try {
        // Try a simple test request to validate model availability
        const testMessages = [vscode.LanguageModelChatMessage.User("test")];
        
        // Create a quick timeout test
        const testPromise = model.sendRequest(testMessages, {}, new vscode.CancellationTokenSource().token);
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Validation timeout')), 10000); // 10 second timeout
        });
        
        await Promise.race([testPromise, timeoutPromise]);
        return true;
    } catch (error) {
        console.warn(`Model ${model.id} validation failed:`, error instanceof Error ? error.message : 'Unknown error');
        
        // Check for specific error types that indicate model is disabled/inaccessible
        if (error instanceof Error) {
            const errorMessage = error.message.toLowerCase();
            if (errorMessage.includes('permission') || 
                errorMessage.includes('access') || 
                errorMessage.includes('denied') ||
                errorMessage.includes('disabled') ||
                errorMessage.includes('quota') ||
                errorMessage.includes('limit')) {
                return false;
            }
        }
        
        // For timeout or other errors, assume model might work (don't block it)
        return true;
    }
}

/**
 * Find an alternative model when the selected one fails
 */
async function findAlternativeModel(
    failedModel: vscode.LanguageModelChat, 
    originalSelectedModelId?: string
): Promise<vscode.LanguageModelChat | null> {
    try {
        console.log(`Finding alternative to failed model: ${failedModel.id}`);
        
        // Get all available models
        const allModels = await vscode.lm.selectChatModels();
        
        // Filter out the failed model
        const alternativeModels = allModels.filter(m => m.id !== failedModel.id);
        
        if (alternativeModels.length === 0) {
            console.warn('No alternative models available');
            return null;
        }
        
        // Prioritize models in this order:
        // 1. Same family as original selection
        // 2. GPT models
        // 3. Any other available model
        
        let preferredFamily: string | null = null;
        if (originalSelectedModelId) {
            preferredFamily = extractFamilyFromModelId(originalSelectedModelId);
        }
        
        // Try same family first
        if (preferredFamily) {
            const sameFamilyModel = alternativeModels.find(m => 
                m.family === preferredFamily || m.id.includes(preferredFamily)
            );
            if (sameFamilyModel) {
                console.log(`Found same family alternative: ${sameFamilyModel.id}`);
                return sameFamilyModel;
            }
        }
        
        // Try GPT models as general fallback
        const gptModel = alternativeModels.find(m => 
            m.family.includes('gpt') || m.id.includes('gpt')
        );
        if (gptModel) {
            console.log(`Found GPT alternative: ${gptModel.id}`);
            return gptModel;
        }
        
        // Return first available model
        console.log(`Using first available alternative: ${alternativeModels[0].id}`);
        return alternativeModels[0];
        
    } catch (error) {
        console.error('Error finding alternative model:', error);
        return null;
    }
}