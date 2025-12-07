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

    // Extract all critical information from the question
    const extractCriticalInfo = (q: string): string[] => {
      const info: string[] = [];
      // Extract angles (e.g., "60°", "90 degrees", "30°")
      const angleMatches = q.match(/\d+\s*(?:degrees?|°)/gi);
      if (angleMatches) info.push(...angleMatches.map(m => `Angle: ${m}`));
      // Extract measurements (e.g., "x", "2x", "5 cm", "10 units")
      const measurementMatches = q.match(/(?:\d+[x\s]*(?:cm|units?|meters?|inches?)?|[a-z]\d*|[a-z]\s*\*\s*\d+)/gi);
      if (measurementMatches) info.push(...measurementMatches.map(m => `Measurement: ${m}`));
      // Extract relationships (e.g., "twice as long", "half of")
      if (q.match(/twice|double|half|triple|equal|same/gi)) {
        info.push('Contains relationships between measurements');
      }
      return info;
    };

    const criticalInfo = extractCriticalInfo(question);

    let prompt = `Generate a visual representation for a SAT question.

CRITICAL: Before generating, extract ALL information from the question:
${criticalInfo.length > 0 ? `\nExtracted Information:\n${criticalInfo.map((info, i) => `${i + 1}. ${info}`).join('\n')}\n` : ''}

Question: ${question}

Visual Requirements:
${visualDescription}

Section: ${requirements.section}
Topic: ${requirements.topic}
${requirements.subtopic ? `Subtopic: ${requirements.subtopic}` : ''}

Guidelines:
${context.rules}

${visualExamples.length > 0 ? `\nIMPORTANT: You have ${visualExamples.length} example visual(s) from actual SAT materials. Study these examples carefully and generate a visual that matches their style, format, and complexity:\n${visualExamples.map((ex, i) => `Example ${i + 1} (${ex.metadata.section || 'N/A'}, ${ex.metadata.topic || 'N/A'}, ${ex.metadata.difficulty || 'N/A'}):\n${ex.description}\n[Image data available - use this as reference for style and format]`).join('\n\n')}\n\n` : ''}

MANDATORY REQUIREMENTS:
1. COMPLETENESS: Include ALL information extracted above in the visual:
   ${criticalInfo.length > 0 ? criticalInfo.map((info, i) => `   - ${info}`).join('\n') : '   - All angles, measurements, and relationships from the question'}
   - If the question mentions an angle (like 90°, 60°, 30°), it MUST be clearly labeled in the visual
   - If the question mentions relationships (like "twice as long"), they MUST be visually represented

2. NO DUPLICATES: 
   - The description should be concise and NOT repeat the same information
   - Do NOT include the question text or task description in the visual description
   - Only describe what the visual SHOWS, not what the question asks

3. SIZE AND CLARITY:
   - For SVG diagrams: Use viewBox="0 0 600 600" or larger (minimum 500x500)
   - All text labels: font-size="16" or larger (minimum 14)
   - Ensure proper spacing: at least 20px between elements
   - Numbers and labels should NOT overlap
   - Use clear, readable fonts

4. SVG QUALITY (if generating SVG):
   - Use proper spacing between all elements
   - Text elements should have: font-size="16" or larger, font-family="Arial, sans-serif"
   - Ensure labels are positioned with adequate padding (at least 10px from shapes)
   - Use stroke-width="2" or larger for visibility
   - Add proper viewBox and width/height attributes

5. ACCURACY:
   - All measurements, angles, and labels must exactly match the question
   - Verify all relationships are correctly represented

${lastValidation && !lastValidation.isValid ? `\nPrevious attempt had issues:\n${lastValidation.issues.join('\n')}\n\nCorrections needed:\n${lastValidation.corrections || 'Please address the issues above.'}\n\nGenerate an improved version that addresses ALL issues:` : ''}

Respond in JSON format:
{
  "type": "graph" | "table" | "diagram" | "chart" | "image",
  "description": "concise description of what the visual shows (NOT a repeat of the question or task). Only describe the visual elements, labels, and measurements shown.",
  "data": { /* structured data if applicable */ },
  "svg": "SVG code with proper sizing (viewBox 0 0 600 600 or larger), clear labels (font-size 16+), and adequate spacing between elements"
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

