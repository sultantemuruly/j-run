import { BaseAgent } from './base-agent';
import { RetrievedContext } from '@/lib/rag/retriever';
import { questionValidatorTool, ValidationResult } from '../tools/question-validator';

export interface GeneratedQuestion {
  question: string;
  answerChoices: string[];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  needsVisual: boolean;
  visualDescription?: string;
}

export interface QuestionGenerationOptions {
  section: string;
  topic: string;
  subtopic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  context: RetrievedContext;
  maxIterations?: number;
}

/**
 * Question Generator Agent - Generates SAT-style questions
 * Includes feedback loop with Checking Agent
 */
export class QuestionGeneratorAgent extends BaseAgent {
  constructor() {
    super('gpt-4o');
  }

  async execute(options: QuestionGenerationOptions): Promise<GeneratedQuestion> {
    const maxIterations = options.maxIterations || 3;
    let iteration = 0;
    let lastValidation: ValidationResult | null = null;

    while (iteration < maxIterations) {
      const prompt = this.buildGenerationPrompt(options, lastValidation, iteration);

      const response = await this.chatCompletion([
        {
          role: 'system',
          content: 'You are an expert SAT question writer. Generate high-quality, SAT-standard questions. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      // Handle tool calls if any
      let finalResponse = response;
      if (response.choices[0].message.tool_calls) {
        const toolMessages = await this.handleToolCalls(response.choices[0].message.tool_calls);
        // Include the assistant message with tool_calls before the tool messages
        finalResponse = await this.chatCompletion([
          {
            role: 'system',
            content: 'You are an expert SAT question writer. Generate high-quality, SAT-standard questions. Always respond with valid JSON.',
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
        ]);
      }

      const content = finalResponse.choices[0].message.content;
      if (!content) {
        throw new Error('No response from Question Generator Agent');
      }

      let generatedQuestion: GeneratedQuestion;
      try {
        const parsed = JSON.parse(content);
        generatedQuestion = {
          question: parsed.question,
          answerChoices: parsed.answerChoices || [],
          correctAnswer: parsed.correctAnswer,
          explanation: parsed.explanation,
          needsVisual: parsed.needsVisual || false,
          visualDescription: parsed.visualDescription,
        };
      } catch (error) {
        throw new Error(`Failed to parse question: ${error}`);
      }

      // Validate the question
      const validation = await questionValidatorTool.execute({
        question: generatedQuestion.question,
        answerChoices: generatedQuestion.answerChoices,
        correctAnswer: generatedQuestion.correctAnswer,
        requirements: {
          section: options.section,
          topic: options.topic,
          subtopic: options.subtopic,
          difficulty: options.difficulty,
        },
        context: options.context.rules,
      });

      lastValidation = validation;

      // If valid or score is high enough, return
      if (validation.isValid && validation.score >= 0.8) {
        return generatedQuestion;
      }

      // If last iteration, return anyway
      if (iteration === maxIterations - 1) {
        console.warn('Question validation failed but max iterations reached');
        return generatedQuestion;
      }

      iteration++;
    }

    throw new Error('Failed to generate valid question after max iterations');
  }

  private buildGenerationPrompt(
    options: QuestionGenerationOptions,
    lastValidation: ValidationResult | null,
    iteration: number
  ): string {
    const { context, section, topic, subtopic, difficulty } = options;

    let prompt = `Generate a SAT-style question with the following requirements:

Section: ${section}
Topic: ${topic}
${subtopic ? `Subtopic: ${subtopic}` : ''}
Difficulty: ${difficulty}

Rules and Guidelines:
${context.rules}

Instructions:
${context.instructions}

Examples of similar questions:
${context.examples.map((ex, i) => `Example ${i + 1}:\n${ex.question}\nAnswer: ${ex.answer}`).join('\n\n')}

Generate a question that:
1. Follows SAT format exactly (4 answer choices: A, B, C, D)
2. Matches the specified difficulty level
3. Tests the specified topic/subtopic appropriately
4. Is clear and unambiguous
5. Has one clearly correct answer
6. Has plausible but incorrect distractors

${lastValidation && !lastValidation.isValid ? `\nPrevious attempt had issues:\n${lastValidation.issues.join('\n')}\n\nCorrections needed:\n${lastValidation.corrections || 'Please address the issues above.'}\n\nGenerate an improved version:` : ''}

Respond in JSON format:
{
  "question": "the question text",
  "answerChoices": ["choice A", "choice B", "choice C", "choice D"],
  "correctAnswer": "A" | "B" | "C" | "D",
  "explanation": "brief explanation of why the correct answer is correct",
  "needsVisual": boolean,
  "visualDescription": "description of visual needed (if needsVisual is true)"
}`;

    return prompt;
  }
}

