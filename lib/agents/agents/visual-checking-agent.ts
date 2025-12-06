import { BaseAgent } from './base-agent';
import { visualValidatorTool, VisualValidationResult } from '../tools/visual-validator';
import { GeneratedVisual } from './visual-generator-agent';

/**
 * Visual Checking Agent - Validates generated visual content
 * Provides feedback for corrections
 */
export class VisualCheckingAgent extends BaseAgent {
  constructor() {
    super('gpt-4o-mini');
  }

  async execute(
    visual: GeneratedVisual,
    question: string,
    requirements: {
      section: string;
      topic: string;
      subtopic?: string;
    }
  ): Promise<VisualValidationResult & { shouldRegenerate: boolean }> {
    const validation = await visualValidatorTool.execute({
      visualDescription: visual.description,
      questionContext: question,
      visualType: visual.type,
      requirements,
    });

    // Determine if regeneration is needed
    const shouldRegenerate = !validation.isValid || validation.score < 0.8;

    return {
      ...validation,
      shouldRegenerate,
    };
  }
}

