import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  corrections?: string;
  score: number; // 0-1, how well it aligns with SAT standards
}

/**
 * Tool for validating generated questions
 */
export const questionValidatorTool = {
  name: 'validate_question',
  description: 'Validate a generated question against SAT standards. Checks for format, difficulty, clarity, and alignment with requirements.',
  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'The generated question text',
      },
      answerChoices: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of answer choices (should be 4 choices)',
      },
      correctAnswer: {
        type: 'string',
        description: 'The correct answer (A, B, C, or D)',
      },
      requirements: {
        type: 'object',
        properties: {
          section: { type: 'string' },
          topic: { type: 'string' },
          subtopic: { type: 'string' },
          difficulty: { type: 'string' },
        },
        description: 'The requirements this question should meet',
      },
      context: {
        type: 'string',
        description: 'Additional context about what the question should test',
      },
    },
    required: ['question', 'answerChoices', 'correctAnswer', 'requirements'],
  },
  execute: async (args: {
    question: string;
    answerChoices: string[];
    correctAnswer: string;
    requirements: {
      section?: string;
      topic?: string;
      subtopic?: string;
      difficulty?: string;
    };
    context?: string;
  }): Promise<ValidationResult> => {
    try {
      const validationPrompt = `You are an expert SAT question validator. Validate the following question:

Question: ${args.question}

Answer Choices:
${args.answerChoices.map((choice, i) => `${String.fromCharCode(65 + i)}. ${choice}`).join('\n')}

Correct Answer: ${args.correctAnswer}

Requirements:
- Section: ${args.requirements.section || 'N/A'}
- Topic: ${args.requirements.topic || 'N/A'}
- Subtopic: ${args.requirements.subtopic || 'N/A'}
- Difficulty: ${args.requirements.difficulty || 'N/A'}

${args.context ? `Context: ${args.context}` : ''}

Evaluate this question on:
1. Format compliance (4 answer choices, clear question structure)
2. Difficulty alignment with specified level
3. Clarity and unambiguous wording
4. Alignment with SAT standards for the specified topic/subtopic
5. Correct answer is clearly the best choice
6. Distractors are plausible but clearly incorrect

Respond in JSON format:
{
  "isValid": boolean,
  "issues": ["list of issues if any"],
  "corrections": "specific instructions for corrections if needed",
  "score": 0.0-1.0
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert SAT question validator. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: validationPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        isValid: result.isValid || false,
        issues: result.issues || [],
        corrections: result.corrections,
        score: result.score || 0,
      };
    } catch (error) {
      console.error('Error validating question:', error);
      return {
        isValid: false,
        issues: ['Validation error occurred'],
        score: 0,
      };
    }
  },
};

