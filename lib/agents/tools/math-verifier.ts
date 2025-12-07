/**
 * Math Verifier - Actually solves math problems to verify answers
 * This prevents AI hallucinations in math explanations
 */

export interface MathVerificationResult {
  isCorrect: boolean;
  actualAnswer: string | number | null;
  correctAnswerLetter: 'A' | 'B' | 'C' | 'D' | null;
  explanation: string;
  calculationSteps: string[];
}

/**
 * Verify a math question by actually solving it
 */
export async function verifyMathQuestion(
  question: string,
  answerChoices: string[],
  markedCorrectAnswer: string,
  explanation?: string
): Promise<MathVerificationResult> {
  try {
    // Use OpenAI to actually solve the math problem
    const prompt = `You are a math expert. Solve this SAT math problem step by step and verify the answer.

Question: ${question}

Answer Choices:
${answerChoices.map((choice, i) => `${String.fromCharCode(65 + i)}. ${choice}`).join('\n')}

Marked Correct Answer: ${markedCorrectAnswer}

${explanation ? `Given Explanation: ${explanation}\n\nCRITICAL: Check if this explanation is mathematically correct. Look for errors, contradictions, or hallucinations.` : ''}

Your task:
1. Solve the problem step by step, showing ALL work with clear calculations
2. Calculate the actual numerical or algebraic answer precisely
3. Compare your calculated answer with each answer choice to find the match
4. Determine which answer choice (A, B, C, or D) contains the correct answer
5. Verify if the marked correct answer (${markedCorrectAnswer}) is actually correct
6. ${explanation ? 'Check if the given explanation is mathematically sound and matches your solution. Flag any errors or hallucinations.' : ''}
7. If the marked answer is wrong OR the explanation is incorrect, identify the actual correct answer choice

IMPORTANT:
- Show all calculation steps clearly
- Double-check your arithmetic
- Verify your answer matches one of the choices
- If the explanation contains errors (like saying "14/13 simplifies to 4"), flag it as incorrect

Respond in JSON format:
{
  "actualAnswer": "the actual calculated answer (number or expression)",
  "correctAnswerLetter": "A" | "B" | "C" | "D" (the letter of the choice containing the correct answer),
  "isMarkedAnswerCorrect": boolean,
  "isExplanationCorrect": boolean${explanation ? ' (check if the given explanation is mathematically sound)' : ' (true if no explanation provided)'},
  "explanationErrors": ["list of any errors found in the explanation, if any"],
  "calculationSteps": ["step 1 with calculation", "step 2 with calculation", ...],
  "explanation": "clear, correct explanation of the solution. Use LaTeX format ($...$ for inline math) for all mathematical expressions: fractions, operations, variables, equations, etc."
}`;

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // OPTIMIZATION: Switched to mini for 33-100x cost reduction
      messages: [
        {
          role: 'system',
          content: 'You are a math expert. Always solve problems step by step and verify answers. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Low temperature for math accuracy
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    const isMarkedAnswerCorrect = result.isMarkedAnswerCorrect === true;
    const isExplanationCorrect = result.isExplanationCorrect !== false; // Default to true if not specified
    const isCorrect = isMarkedAnswerCorrect && isExplanationCorrect;
    const correctLetter = result.correctAnswerLetter || null;

    // Build explanation with error details if explanation is wrong
    let finalExplanation = result.explanation || 'No explanation provided';
    if (!isExplanationCorrect && result.explanationErrors && result.explanationErrors.length > 0) {
      finalExplanation += `\n\nEXPLANATION ERRORS FOUND:\n${result.explanationErrors.join('\n')}`;
    }

    return {
      isCorrect,
      actualAnswer: result.actualAnswer || null,
      correctAnswerLetter: correctLetter,
      explanation: finalExplanation,
      calculationSteps: result.calculationSteps || [],
    };
  } catch (error) {
    console.error('Error verifying math question:', error);
    return {
      isCorrect: false,
      actualAnswer: null,
      correctAnswerLetter: null,
      explanation: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
      calculationSteps: [],
    };
  }
}

