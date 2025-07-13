import * as vscode from "vscode";
import { ReviewResultView } from './reviewResultView';

export async function SendReviewDiffChangeRequest(
    instructionContents: string,
    diffChangeContent: string,
    context: vscode.ExtensionContext
): Promise<string | null> {
    const prompt = `Based on the following instructions:
----------------------------------
${instructionContents}
----------------------------------

Analyze the following code changes and provide a detailed review:
----------------------------------
${diffChangeContent}
----------------------------------

Please provide:
1. Overall assessment of the changes
2. Potential issues or improvements
3. Code quality feedback
4. Best practices recommendations
    `;

    return await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: "Asking Copilot...",
            cancellable: true,
        },
        async (progress, token) => {
            try {
                progress.report({
                    increment: 10,
                    message: "Selecting Copilot model...",
                });

                const [model] = await vscode.lm.selectChatModels({
                    family: "gpt-4o",
                });

                if (!model) {
                    vscode.window.showErrorMessage(
                        "No suitable model found for Copilot chat."
                    );
                    return null;
                }

                progress.report({
                    increment: 30,
                    message: "Sending request to Copilot...",
                });

                const messages: vscode.LanguageModelChatMessage[] = [
                    vscode.LanguageModelChatMessage.User(prompt),
                ];

                const response = await model.sendRequest(messages, {}, token);

                progress.report({
                    increment: 50,
                    message: "Processing response...",
                });

                const responseAsString = await GetRequestResponse(response, token);
                
                progress.report({
                    increment: 100,
                    message: "Review completed!",
                });

                // Show review result in a nice webview
                ReviewResultView.createOrShow(responseAsString, context);

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