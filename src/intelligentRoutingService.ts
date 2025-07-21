import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface representing an instruction file with metadata
 */
export interface InstructionIndex {
    filename: string;
    title: string;
    description: string;
    keywords: string[];
    scope: string[];
    fileTypes: string[];
    content: string;
    priority: number; // 1-10, higher = more important
}

/**
 * Request structure for instruction routing analysis
 */
export interface RoutingRequest {
    diffSummary: string;
    changedFiles: string[];
    availableInstructions: InstructionIndex[];
}

/**
 * Response from AI instruction routing analysis
 */
export interface RoutingResponse {
    selectedInstructions: string[];  // filenames to use
    reasoning: string;               // why these were selected
    confidence: number;              // 0-1 confidence score
}

/**
 * Instruction metadata parsed from frontmatter
 */
export interface InstructionMetadata {
    title?: string;
    description?: string;
    keywords?: string[];
    scope?: string[];
    fileTypes?: string[];
    priority?: number;
}

/**
 * Service for intelligent instruction routing using AI
 */
export class IntelligentRoutingService {
    private static instance: IntelligentRoutingService;
    private workspaceRoot: string;

    private constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    public static getInstance(workspaceRoot?: string): IntelligentRoutingService {
        if (!IntelligentRoutingService.instance && workspaceRoot) {
            IntelligentRoutingService.instance = new IntelligentRoutingService(workspaceRoot);
        }
        return IntelligentRoutingService.instance;
    }

    /**
     * Check if intelligent routing is enabled in settings
     */
    public isIntelligentRoutingEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('premergeReview');
        return config.get<boolean>('intelligentRouting.enabled', false);
    }

    /**
     * Get the instruction folder path from settings
     */
    public getInstructionFolderPath(): string {
        const config = vscode.workspace.getConfiguration('premergeReview');
        const folderPath = config.get<string>('intelligentRouting.instructionFolderPath', '.github/instructions');
        return path.join(this.workspaceRoot, folderPath);
    }

    /**
     * Create instruction index by scanning all instruction files
     */
    public async createInstructionIndex(): Promise<InstructionIndex[]> {
        const instructionFolderPath = this.getInstructionFolderPath();
        
        if (!fs.existsSync(instructionFolderPath)) {
            console.log(`Instruction folder not found: ${instructionFolderPath}`);
            return [];
        }

        const instructionFiles = fs.readdirSync(instructionFolderPath)
            .filter(file => file.endsWith('.md'))
            .map(file => path.join(instructionFolderPath, file));

        const index: InstructionIndex[] = [];

        for (const filePath of instructionFiles) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const metadata = this.parseInstructionMetadata(content);
                const filename = path.basename(filePath);

                index.push({
                    filename,
                    title: metadata.title || this.generateTitleFromFilename(filename),
                    description: metadata.description || "Review instruction",
                    keywords: metadata.keywords || [],
                    scope: metadata.scope || [],
                    fileTypes: metadata.fileTypes || [],
                    content: content,
                    priority: metadata.priority || 5
                });

                console.log(`Indexed instruction: ${filename}`);
            } catch (error) {
                console.error(`Error reading instruction file ${filePath}:`, error);
            }
        }

        // Sort by priority (higher first)
        index.sort((a, b) => b.priority - a.priority);

        console.log(`Created instruction index with ${index.length} files`);
        return index;
    }

    /**
     * Parse instruction metadata from frontmatter
     */
    private parseInstructionMetadata(content: string): InstructionMetadata {
        // Look for YAML frontmatter
        const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
        
        if (frontmatterMatch) {
            try {
                // Simple YAML parsing for basic properties
                const yamlContent = frontmatterMatch[1];
                const metadata: InstructionMetadata = {};
                
                // Parse each line
                const lines = yamlContent.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) continue;
                    
                    const colonIndex = trimmed.indexOf(':');
                    if (colonIndex === -1) continue;
                    
                    const key = trimmed.substring(0, colonIndex).trim();
                    const value = trimmed.substring(colonIndex + 1).trim();
                    
                    switch (key) {
                        case 'title':
                            metadata.title = value.replace(/['"]/g, '');
                            break;
                        case 'description':
                            metadata.description = value.replace(/['"]/g, '');
                            break;
                        case 'priority':
                            metadata.priority = parseInt(value) || 5;
                            break;
                        case 'keywords':
                            metadata.keywords = this.parseArrayValue(value);
                            break;
                        case 'scope':
                            metadata.scope = this.parseArrayValue(value);
                            break;
                        case 'fileTypes':
                            metadata.fileTypes = this.parseArrayValue(value);
                            break;
                    }
                }
                
                return metadata;
            } catch (error) {
                console.error('Error parsing frontmatter:', error);
            }
        }
        
        return {};
    }

    /**
     * Parse array values from YAML (simple implementation)
     */
    private parseArrayValue(value: string): string[] {
        // Handle both ["item1", "item2"] and [item1, item2] formats
        const arrayMatch = value.match(/\[(.*)\]/);
        if (arrayMatch) {
            return arrayMatch[1]
                .split(',')
                .map(item => item.trim().replace(/['"]/g, ''))
                .filter(item => item.length > 0);
        }
        return [];
    }

    /**
     * Generate title from filename
     */
    private generateTitleFromFilename(filename: string): string {
        return filename
            .replace('.md', '')
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Get instruction routing decision from AI
     */
    public async getInstructionRouting(
        diffSummary: string,
        changedFiles: string[],
        instructionIndex: InstructionIndex[]
    ): Promise<RoutingResponse> {
        
        const routingPrompt = this.createRoutingPrompt(diffSummary, changedFiles, instructionIndex);
        
        try {
            // Get available language models
            const [model] = await vscode.lm.selectChatModels({
                family: "gpt-4o",
            });

            if (!model) {
                throw new Error("No suitable language model found for instruction routing.");
            }

            const messages: vscode.LanguageModelChatMessage[] = [
                vscode.LanguageModelChatMessage.User(routingPrompt)
            ];

            const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
            
            // Get response content
            let responseText = '';
            for await (const chunk of response.stream) {
                responseText += (chunk as any).value || '';
            }

            // Try to parse JSON response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsedResponse = JSON.parse(jsonMatch[0]) as RoutingResponse;
                console.log('Instruction routing decision:', parsedResponse);
                return parsedResponse;
            } else {
                throw new Error('No valid JSON found in response');
            }

        } catch (error) {
            console.error('Error getting instruction routing:', error);
            
            // Fallback: use all instructions
            return {
                selectedInstructions: instructionIndex.map(i => i.filename),
                reasoning: `Failed to get AI routing decision (${error instanceof Error ? error.message : 'Unknown error'}). Using all available instructions as fallback.`,
                confidence: 0.3
            };
        }
    }

    /**
     * Create routing prompt for AI analysis
     */
    private createRoutingPrompt(
        diffSummary: string,
        changedFiles: string[],
        instructionIndex: InstructionIndex[]
    ): string {
        return `🎯 INSTRUCTION ROUTING ANALYSIS

You are a code review assistant. Analyze the following code changes and determine which review instructions are most relevant.

📊 AVAILABLE INSTRUCTIONS:
${instructionIndex.map((inst, index) => `
${index + 1}. Filename: ${inst.filename}
   Title: ${inst.title}
   Description: ${inst.description}
   Keywords: ${inst.keywords.join(', ') || 'None'}
   Scope: ${inst.scope.join(', ') || 'General'}
   File Types: ${inst.fileTypes.join(', ') || 'Any'}
   Priority: ${inst.priority}/10
`).join('')}

📁 CHANGED FILES:
${changedFiles.map(file => `- ${file}`).join('\n')}

🔍 CODE CHANGES SUMMARY:
----------------------------------
${diffSummary}
----------------------------------

🎯 SELECTION CRITERIA:
- Always include general or high-priority instructions if available
- Select instructions based on:
  * File types being changed (.tsx → frontend instructions)
  * Code areas being modified (API, database, UI, etc.)
  * Keywords found in diff content
  * Scope of changes (frontend, backend, database, etc.)
- Prioritize quality over quantity (2-5 instructions max)
- Higher priority instructions should be favored
- Provide confidence score (0.0-1.0)

📋 REQUIRED OUTPUT (VALID JSON ONLY):
{
  "selectedInstructions": ["instruction1.md", "instruction2.md"],
  "reasoning": "Detailed explanation of why these instructions were selected based on the code changes",
  "confidence": 0.95
}

RESPOND WITH VALID JSON ONLY:`;
    }

    /**
     * Select instruction content based on routing decision
     */
    public selectInstructionsByRouting(
        instructionIndex: InstructionIndex[],
        routingDecision: RoutingResponse
    ): InstructionIndex[] {
        
        const selectedInstructions = instructionIndex.filter(inst => 
            routingDecision.selectedInstructions.includes(inst.filename)
        );

        // Log routing decision for debugging
        console.log(`🎯 Intelligent Routing Results:`);
        console.log(`Selected ${selectedInstructions.length} instructions:`, 
            selectedInstructions.map(i => `${i.filename} (${i.title})`));
        console.log(`Reasoning: ${routingDecision.reasoning}`);
        console.log(`Confidence: ${routingDecision.confidence}`);

        return selectedInstructions;
    }

    /**
     * Combine selected instruction content for final prompt
     */
    public combineInstructionContent(selectedInstructions: InstructionIndex[]): string {
        if (selectedInstructions.length === 0) {
            return '';
        }

        const combinedContent = selectedInstructions
            .map(inst => `# ${inst.title}\n\n${inst.content}`)
            .join('\n\n---\n\n');

        return `📋 SELECTED REVIEW INSTRUCTIONS (${selectedInstructions.length} files):\n\n${combinedContent}`;
    }
}
