import OpenAI from 'openai';
import { verifyMathQuestion } from './math-verifier';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  corrections?: string;
  score: number; // 0-1, how well it aligns with SAT standards
  correctedAnswer?: string; // The correct answer if validation found the marked answer was wrong
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
      passage: {
        type: 'string',
        description: 'The reading passage (required for Reading & Writing questions)',
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
    passage?: string;
    answerChoices: string[];
    correctAnswer: string;
    requirements: {
      section?: string;
      topic?: string;
      subtopic?: string;
      difficulty?: string;
    };
    context?: string;
    explanation?: string;
  }): Promise<ValidationResult> => {
    try {
      const isReadingWriting = args.requirements.section === 'reading-writing' || args.requirements.section === 'reading-and-writing';
      const isMath = args.requirements.section === 'math';
      
      // For math questions, verify by actually solving the problem
      if (isMath) {
        const mathVerification = await verifyMathQuestion(
          args.question,
          args.answerChoices,
          args.correctAnswer,
          args.explanation
        );
        
        if (!mathVerification.isCorrect) {
          const issues = [
            `CRITICAL MATH ERROR: Mathematical verification failed.`,
            `Actual calculated answer: ${mathVerification.actualAnswer}`,
            `The correct answer choice is: ${mathVerification.correctAnswerLetter || 'Unknown'}`,
            `Marked answer (${args.correctAnswer}) is ${mathVerification.correctAnswerLetter === args.correctAnswer ? 'correct but explanation is wrong' : 'incorrect'}`,
            `Verification explanation: ${mathVerification.explanation}`,
            ...mathVerification.calculationSteps.map(step => `Calculation step: ${step}`),
          ];
          
          return {
            isValid: false,
            issues,
            corrections: `The correct answer should be ${mathVerification.correctAnswerLetter}. ${mathVerification.correctAnswerLetter !== args.correctAnswer ? 'The marked answer is wrong.' : 'The marked answer is correct, but the explanation contains errors.'} Regenerate with correct answer and mathematically sound explanation.`,
            score: 0.1, // Very low score for math errors
            correctedAnswer: mathVerification.correctAnswerLetter || undefined,
          };
        }
        
        console.log('Math verification passed - answer and explanation are correct');
        
        // If math verification passes, continue with standard validation
      }
      
      const validationPrompt = `You are an expert SAT question validator. Validate the following question:

${args.passage ? `Passage:\n${args.passage}\n\n` : ''}Question: ${args.question}

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
${isReadingWriting ? '1a. For Reading & Writing: Passage must be present (25-150 words) and the question must reference it' : ''}
2. Difficulty alignment with specified level
3. Clarity and unambiguous wording
4. Alignment with SAT standards for the specified topic/subtopic
5. ANSWER CORRECTNESS CHECK (CRITICAL):
   - Verify that the marked correct answer (${args.correctAnswer}) is actually the best/correct answer
   - Check that there is indeed ONE clearly correct answer
   - Ensure the correct answer is supported by the passage/question content
   - Verify that the correct answer is not ambiguous or debatable
   - If the marked answer is wrong or there's no clear correct answer, this is a critical failure
6. Distractors are plausible but clearly incorrect
7. Content originality (not copied from examples)
${isReadingWriting ? '8. For Reading & Writing: Question must be answerable based on the passage content' : ''}

Respond in JSON format:
{
  "isValid": boolean,
  "issues": ["list of issues if any"],
  "corrections": "specific instructions for corrections if needed",
  "score": 0.0-1.0,
  "answerCorrectness": {
    "isCorrect": boolean,
    "explanation": "explanation of why the marked answer is correct or incorrect",
    "actualCorrectAnswer": "A" | "B" | "C" | "D" | null
  }
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
      
      // Check answer correctness
      const answerCorrectness = result.answerCorrectness || {};
      const isAnswerCorrect = answerCorrectness.isCorrect !== false; // Default to true if not specified
      
      // If answer is incorrect, add to issues and provide the correct answer
      let correctedAnswer: string | undefined = undefined;
      if (!isAnswerCorrect) {
        const issues = result.issues || [];
        issues.push(`CRITICAL: The marked correct answer (${args.correctAnswer}) is incorrect. ${answerCorrectness.explanation || 'The actual correct answer may be different.'}`);
        if (answerCorrectness.actualCorrectAnswer) {
          issues.push(`The actual correct answer appears to be: ${answerCorrectness.actualCorrectAnswer}`);
          correctedAnswer = answerCorrectness.actualCorrectAnswer;
        }
        result.issues = issues;
        result.isValid = false;
        result.score = Math.min(result.score || 0, 0.3); // Cap score at 0.3 if answer is wrong
      }
      
      return {
        isValid: result.isValid !== false && isAnswerCorrect,
        issues: result.issues || [],
        corrections: result.corrections,
        score: result.score || 0,
        correctedAnswer, // Return the corrected answer if validation found it was wrong
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

