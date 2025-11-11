import * as vscode from 'vscode';

export interface SlackConfig {
    webhookUrl: string;
}

export interface SlackWebhookPayload {
    text: string;
    username?: string;
    icon_emoji?: string;
}

export class SlackService {
    private static instance: SlackService;

    private constructor() {}

    public static getInstance(): SlackService {
        if (!SlackService.instance) {
            SlackService.instance = new SlackService();
        }
        return SlackService.instance;
    }

    /**
     * Get Slack configuration from VS Code settings
     */
    public getSlackConfig(): SlackConfig {
        const config = vscode.workspace.getConfiguration('premergeReview.slack');
        return {
            webhookUrl: config.get<string>('webhookUrl', '')
        };
    }

    /**
     * Check if Slack integration is configured
     */
    public isSlackConfigured(): boolean {
        const config = this.getSlackConfig();
        return config.webhookUrl.trim() !== '';
    }

    /**
     * Post review result to Slack channel via webhook
     */
    public async postReviewToSlack(
        reviewContent: string,
        options: { username?: string; iconEmoji?: string } = {}
    ): Promise<boolean> {
        const config = this.getSlackConfig();
        
        if (!this.isSlackConfigured()) {
            vscode.window.showErrorMessage('Slack webhook integration is not configured. Please check your settings.');
            return false;
        }

        try {
            const message = this.formatReviewForSlack(reviewContent);

            const success = await this.sendSlackWebhook(
                config.webhookUrl,
                message,
                options
            );

            if (success) {
                vscode.window.showInformationMessage(
                    `✅ Review posted to Slack!`
                );
                return true;
            } else {
                vscode.window.showErrorMessage('Failed to post review to Slack');
                return false;
            }
        } catch (error) {
            console.error('Error posting to Slack:', error);
            vscode.window.showErrorMessage(
                `Failed to post to Slack: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            return false;
        }
    }

    /**
     * Format review content for Slack
     */
    private formatReviewForSlack(reviewContent: string): string {
        // Convert markdown to Slack-friendly format
        let slackMessage = reviewContent
            // Headers
            .replace(/^### (.*$)/gim, '*$1*')
            .replace(/^## (.*$)/gim, '*$1*')
            .replace(/^# (.*$)/gim, '*$1*')
            
            // Bold and italic (Slack uses different syntax)
            .replace(/\*\*(.*?)\*\*/g, '*$1*')
            .replace(/\*(.*?)\*/g, '_$1_')
            
            // Code blocks - Slack uses triple backticks
            .replace(/```([\\s\\S]*?)```/g, '```$1```')
            .replace(/`(.*?)`/g, '`$1`')
            
            // Lists - keep as is, Slack handles bullet points
            .replace(/^\\* /gm, '• ')
            .replace(/^\\d+\\. /gm, '• ');

        // Add header with emoji
        const header = `:mag: *Code Review Result* - Generated at ${new Date().toLocaleString()}\\n\\n`;
        
        return header + slackMessage;
    }

    /**
     * Send message to Slack using Incoming Webhook
     */
    private async sendSlackWebhook(
        webhookUrl: string,
        message: string,
        options: { username?: string; iconEmoji?: string }
    ): Promise<boolean> {
        const payload: SlackWebhookPayload = {
            text: message,
            username: options.username || 'Code Review Bot',
            icon_emoji: options.iconEmoji || ':mag:'
        };

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                return true;
            } else {
                const errorText = await response.text();
                throw new Error(`Webhook error: ${response.status} - ${errorText}`);
            }
        } catch (error) {
            console.error('Slack webhook error:', error);
            throw error;
        }
    }

    /**
     * Test Slack webhook connection
     */
    public async testSlackConnection(): Promise<boolean> {
        const config = this.getSlackConfig();
        
        if (!config.webhookUrl) {
            vscode.window.showErrorMessage('Slack webhook URL is not configured');
            return false;
        }

        try {
            // Send a test message to webhook
            const testMessage = ':white_check_mark: *Test Message*\n\nSlack integration is working correctly!';
            
            const payload: SlackWebhookPayload = {
                text: testMessage,
                username: 'Code Review Bot (Test)',
                icon_emoji: ':gear:'
            };

            const response = await fetch(config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                vscode.window.showInformationMessage(
                    '✅ Slack webhook test successful! Check your Slack channel for the test message.'
                );
                return true;
            } else {
                const errorText = await response.text();
                vscode.window.showErrorMessage(
                    `❌ Slack webhook test failed: ${response.status} - ${errorText}`
                );
                return false;
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                `❌ Failed to test Slack webhook: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            return false;
        }
    }
}
