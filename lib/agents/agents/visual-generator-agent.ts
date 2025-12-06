import { BaseAgent } from './base-agent';
import { RetrievedContext } from '@/lib/rag/retriever';
import { visualValidatorTool, VisualValidationResult } from '../tools/visual-validator';
import { extractJSON } from '@/lib/utils/json-extractor';

export interface GeneratedVisual {
  type: 'graph' | 'table' | 'diagram' | 'chart' | 'image';
  description: string;
  data?: any; // Structured data for the visual
  svg?: string; // SVG representation (if applicable)
  needsRegeneration: boolean;
}

export interface VisualGenerationOptions {
  question: string;
  visualDescription: string;
  context: RetrievedContext;
  requirements: {
    section: string;
    topic: string;
    subtopic?: string;
  };
  maxIterations?: number;
}

/**
 * Visual Generator Agent - Generates visual content (graphs, tables, diagrams)
 * Includes feedback loop with Visual Checking Agent
 */
export class VisualGeneratorAgent extends BaseAgent {
  constructor() {
    super('gpt-4o');
  }

  async execute(options: VisualGenerationOptions): Promise<GeneratedVisual> {
    const maxIterations = options.maxIterations || 3;
    let iteration = 0;
    let lastValidation: VisualValidationResult | null = null;

    while (iteration < maxIterations) {
      const prompt = this.buildGenerationPrompt(options, lastValidation, iteration);

      const response = await this.chatCompletion(
        [
          {
            role: 'system',
            content: 'You are an expert at creating educational visuals for SAT questions. Generate clear, accurate, and appropriate visuals. You MUST respond with valid JSON only, no markdown, no code blocks, just the raw JSON object.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        undefined,
        undefined,
        { type: 'json_object' }
      );

      // Handle tool calls if any
      let finalResponse = response;
      if (response.choices[0].message.tool_calls) {
        const toolMessages = await this.handleToolCalls(response.choices[0].message.tool_calls);
        // Include the assistant message with tool_calls before the tool messages
        finalResponse = await this.chatCompletion(
          [
            {
              role: 'system',
              content: 'You are an expert at creating educational visuals for SAT questions. Generate clear, accurate, and appropriate visuals. You MUST respond with valid JSON only, no markdown, no code blocks, just the raw JSON object.',
            },
            {
              role: 'user',
              content: prompt,
            },
            {
              role: 'assistant',
              content: response.choices[0].message.content || null,
              tool_calls: response.choices[0].message.tool_calls,
            },
            ...toolMessages,
          ],
          undefined,
          undefined,
          { type: 'json_object' }
        );
      }

      const content = finalResponse.choices[0].message.content;
      if (!content) {
        throw new Error('No response from Visual Generator Agent');
      }

      let generatedVisual: GeneratedVisual;
      try {
        // Extract JSON from response (handles markdown code blocks)
        const parsed = extractJSON(content);
        generatedVisual = {
          type: parsed.type || 'graph',
          description: parsed.description,
          data: parsed.data,
          svg: parsed.svg,
          needsRegeneration: false,
        };
      } catch (error) {
        throw new Error(`Failed to parse visual: ${error}`);
      }

      // Validate the visual
      const validation = await visualValidatorTool.execute({
        visualDescription: generatedVisual.description,
        questionContext: options.question,
        visualType: generatedVisual.type,
        requirements: options.requirements,
      });

      lastValidation = validation;

      // If valid or score is high enough, return
      if (validation.isValid && validation.score >= 0.8) {
        return generatedVisual;
      }

      // If last iteration, mark as needing regeneration
      if (iteration === maxIterations - 1) {
        generatedVisual.needsRegeneration = true;
        return generatedVisual;
      }

      iteration++;
    }

    throw new Error('Failed to generate valid visual after max iterations');
  }

  private buildGenerationPrompt(
    options: VisualGenerationOptions,
    lastValidation: VisualValidationResult | null,
    iteration: number
  ): string {
    const { question, visualDescription, context, requirements } = options;

    // Use actual visual examples from context
    const visualExamples = context.visualExamples || [];

    let prompt = `Generate a visual representation for a SAT question:

Question: ${question}

Visual Requirements:
${visualDescription}

Section: ${requirements.section}
Topic: ${requirements.topic}
${requirements.subtopic ? `Subtopic: ${requirements.subtopic}` : ''}

Guidelines:
${context.rules}

${visualExamples.length > 0 ? `\nIMPORTANT: You have ${visualExamples.length} example visual(s) from actual SAT materials. Study these examples carefully and generate a visual that matches their style, format, and complexity:\n${visualExamples.map((ex, i) => `Example ${i + 1} (${ex.metadata.section || 'N/A'}, ${ex.metadata.topic || 'N/A'}, ${ex.metadata.difficulty || 'N/A'}):\n${ex.description}\n[Image data available - use this as reference for style and format]`).join('\n\n')}\n\n` : ''}

Generate a visual that:
1. Is directly relevant to the question
2. Is clear and easy to read
3. Matches SAT visual standards (use the examples above as reference)
4. Is appropriately complex for the difficulty level
5. Accurately represents the data/concepts
6. Follows the same style and format as the example visuals provided

${lastValidation && !lastValidation.isValid ? `\nPrevious attempt had issues:\n${lastValidation.issues.join('\n')}\n\nCorrections needed:\n${lastValidation.corrections || 'Please address the issues above.'}\n\nGenerate an improved version:` : ''}

Respond in JSON format:
{
  "type": "graph" | "table" | "diagram" | "chart" | "image",
  "description": "detailed description of the visual",
  "data": { /* structured data if applicable */ },
  "svg": "SVG code if applicable"
}`;

    return prompt;
  }

  /**
   * Enhanced execute method that can use OpenAI Vision API for visual examples
   */
  async executeWithVision(options: VisualGenerationOptions): Promise<GeneratedVisual> {
    const { context } = options;
    
    // If we have visual examples, use Vision API to analyze them
    if (context.visualExamples && context.visualExamples.length > 0) {
      // Use the first visual example as reference
      const referenceVisual = context.visualExamples[0];
      
      // Create a prompt that includes the visual example
      const visionPrompt = this.buildGenerationPrompt(options, null, 0);
      
      // For now, we'll use the text-based approach but with enhanced context
      // In the future, you could use OpenAI Vision API to analyze the actual images
      // This would require: openai.chat.completions.create with vision model
      
      return this.execute(options);
    }
    
    return this.execute(options);
  }
}

