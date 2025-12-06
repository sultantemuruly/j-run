import { BaseAgent } from './base-agent';
import { questionValidatorTool, ValidationResult } from '../tools/question-validator';
import { GeneratedQuestion } from './question-generator-agent';

/**
 * Checking Agent - Validates generated questions
 * Provides feedback for corrections
 */
export class CheckingAgent extends BaseAgent {
  constructor() {
    super('gpt-4o-mini');
  }

  async execute(question: GeneratedQuestion, requirements: {
    section: string;
    topic: string;
    subtopic?: string;
    difficulty: string;
  }, context?: string): Promise<ValidationResult & { shouldRegenerate: boolean }> {
    const validation = await questionValidatorTool.execute({
      question: question.question,
      answerChoices: question.answerChoices,
      correctAnswer: question.correctAnswer,
      requirements,
      context,
    });

    // Determine if regeneration is needed
    const shouldRegenerate = !validation.isValid || validation.score < 0.8;

    return {
      ...validation,
      shouldRegenerate,
    };
  }
}

