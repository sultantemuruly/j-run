import OpenAI from 'openai';
import { verifyMathQuestion } from './math-verifier';
import { validateTopicMatch, folderToDisplayName } from '@/lib/utils/topic-classifier';

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
      
      // OPTIMIZATION: Only run math verifier for math questions when needed
      // Do standard validation first, then verify math only if score is low or answer seems wrong
      let mathVerificationResult: any = null;
      
      if (isMath) {
        // Quick heuristic: only verify if explanation is missing/short or question looks complex
        const needsVerification = !args.explanation || 
                                  args.explanation.length < 50 ||
                                  args.question.toLowerCase().includes('solve') ||
                                  args.question.toLowerCase().includes('calculate') ||
                                  args.question.toLowerCase().includes('find');
        
        if (needsVerification) {
          console.log('Running math verification (heuristic triggered)...');
          try {
            mathVerificationResult = await verifyMathQuestion(
              args.question,
              args.answerChoices,
              args.correctAnswer,
              args.explanation
            );
            
            if (!mathVerificationResult.isCorrect) {
              const issues = [
                `CRITICAL MATH ERROR: Mathematical verification failed.`,
                `Actual calculated answer: ${mathVerificationResult.actualAnswer}`,
                `The correct answer choice is: ${mathVerificationResult.correctAnswerLetter || 'Unknown'}`,
                `Marked answer (${args.correctAnswer}) is ${mathVerificationResult.correctAnswerLetter === args.correctAnswer ? 'correct but explanation is wrong' : 'incorrect'}`,
                `Verification explanation: ${mathVerificationResult.explanation}`,
                ...mathVerificationResult.calculationSteps.map(step => `Calculation step: ${step}`),
              ];
              
              return {
                isValid: false,
                issues,
                corrections: `The correct answer should be ${mathVerificationResult.correctAnswerLetter}. ${mathVerificationResult.correctAnswerLetter !== args.correctAnswer ? 'The marked answer is wrong.' : 'The marked answer is correct, but the explanation contains errors.'} Regenerate with correct answer and mathematically sound explanation.`,
                score: 0.1, // Very low score for math errors
                correctedAnswer: mathVerificationResult.correctAnswerLetter || undefined,
              };
            }
            
            console.log('Math verification passed - answer and explanation are correct');
          } catch (error) {
            console.warn('Math verification error, continuing with standard validation:', error);
          }
        }
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

CRITICAL VALIDATION CHECKS:

1. TOPIC/SUBTOPIC ALIGNMENT CHECK (CRITICAL):
   - The question MUST be about the specified topic: ${args.requirements.topic || 'N/A'}
   ${args.requirements.subtopic ? `- The question MUST be about the specified subtopic: ${args.requirements.subtopic}` : ''}
   - Verify that the question content actually matches the topic. For example:
     * If topic is "Geometry and Trigonometry", the question should involve geometry/trig concepts (triangles, angles, circles, area, volume, trigonometry)
     * If topic is "Algebra", the question should involve algebra concepts (equations, functions, systems, inequalities)
     * If topic is "Problem-Solving and Data Analysis", the question should involve data/statistics/probability
   - If the question is about a different topic, this is a CRITICAL FAILURE
   - Check if the subtopic matches: ${args.requirements.subtopic || 'N/A'}

2. Format compliance (4 answer choices, clear question structure)
${isReadingWriting ? '2a. For Reading & Writing: Passage must be present (25-150 words) and the question must reference it' : ''}
3. Difficulty alignment with specified level
4. Clarity and unambiguous wording
5. Alignment with SAT standards for the specified topic/subtopic
6. ANSWER CORRECTNESS CHECK (CRITICAL):
   - Verify that the marked correct answer (${args.correctAnswer}) is actually the best/correct answer
   - Check that there is indeed ONE clearly correct answer
   - Ensure the correct answer is supported by the passage/question content
   - Verify that the correct answer is not ambiguous or debatable
   - If the marked answer is wrong or there's no clear correct answer, this is a critical failure
6. Distractors are plausible but clearly incorrect
7. Content originality (not copied from examples)
${isReadingWriting ? '8. For Reading & Writing: Question must be answerable based on the passage content' : ''}

CRITICAL: Be STRICT in your evaluation. A score below 0.8 means the question needs significant improvement. Only give scores above 0.8 if the question is truly high quality.

For each issue, provide:
1. WHAT is wrong (specific element)
2. WHY it's wrong (reason)
3. HOW to fix it (specific action)

Respond in JSON format:
{
  "isValid": boolean,
  "issues": ["specific issue with what/why/how format"],
  "corrections": "detailed, step-by-step instructions for fixing ALL issues. Be SPECIFIC about what needs to change and how. Include examples if helpful.",
  "score": 0.0-1.0,
  "answerCorrectness": {
    "isCorrect": boolean,
    "explanation": "explanation of why the marked answer is correct or incorrect",
    "actualCorrectAnswer": "A" | "B" | "C" | "D" | null
  },
  "specificImprovements": {
    "question": "specific improvements needed for the question text",
    "answerChoices": "specific improvements needed for answer choices",
    "explanation": "specific improvements needed for explanation",
    "passage": "specific improvements needed for passage (if applicable)"
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
      
      // CRITICAL: Validate topic/subtopic alignment programmatically
      // Pass section hint to help classifier
      const topicValidation = validateTopicMatch(
        args.question,
        args.requirements.topic || '',
        args.requirements.subtopic,
        args.passage,
        args.requirements.section
      );
      
      if (!topicValidation.matches) {
        console.warn('Topic mismatch detected:', topicValidation.issue);
        result.issues = result.issues || [];
        result.issues.push(`CRITICAL TOPIC MISMATCH: ${topicValidation.issue}`);
        result.issues.push(`Expected: ${folderToDisplayName(args.requirements.topic || '')}${args.requirements.subtopic ? ` > ${args.requirements.subtopic}` : ''}`);
        result.issues.push(`Actual: ${topicValidation.actualTopic || 'Unknown'}${topicValidation.actualSubtopic ? ` > ${topicValidation.actualSubtopic}` : ''}`);
        result.isValid = false;
        result.score = Math.min(result.score || 0.5, 0.3); // Cap at 0.3 for topic mismatch
        
        // Provide specific guidance based on the requested subtopic
        let specificGuidance = '';
        if (args.requirements.subtopic === 'Cross-Text Connections') {
          specificGuidance = `
SPECIFIC REQUIREMENTS FOR "Cross-Text Connections":
1. You MUST generate TWO separate passages, clearly labeled:
   - "Passage 1: [content]"
   - "Passage 2: [content]"
   - Separate them with a blank line
2. The question MUST ask about the RELATIONSHIP between the two passages, NOT about information from one passage
3. The question MUST use phrases like:
   - "How do the two passages relate to each other..."
   - "Both passages suggest that..."
   - "Passage 1 and Passage 2 differ in that..."
   - "The relationship between the passages is..."
   - "Compared to Passage 1, Passage 2..."
4. The question MUST explicitly reference BOTH passages
5. This is NOT "Information and Ideas" - do NOT ask about main ideas, inferences, or evidence from individual passages
6. Focus on comparing, contrasting, or connecting the two passages`;
        } else if (args.requirements.subtopic === 'Sentence Boundaries') {
          specificGuidance = `
SPECIFIC REQUIREMENTS FOR "Sentence Boundaries":
1. The passage MUST contain a sentence that is incomplete, a fragment, or a run-on
2. The question MUST ask which choice completes the sentence, fixes the fragment, or corrects the run-on
3. Example question format: "Which choice completes the sentence..." or "The writer wants to fix the sentence fragment..."
4. This is about sentence COMPLETENESS and STRUCTURE, not grammar rules or punctuation marks`;
        } else if (args.requirements.subtopic === 'Form, Structure, and Sense') {
          specificGuidance = `
SPECIFIC REQUIREMENTS FOR "Form, Structure, and Sense":
1. The passage MUST contain a grammatical error or unclear structure
2. The question MUST ask which choice is grammatically correct OR makes the sentence logical/clear
3. MUST test grammar rules such as:
   - Subject-verb agreement
   - Verb tense consistency
   - Parallel structure
   - Pronoun agreement
   - Logical sentence structure
4. Example question format: "Which choice most effectively completes the sentence..." or "The writer wants to revise the sentence to fix a grammatical error..."
5. CRITICAL: This is about GRAMMAR and making sentences grammatically correct and logical. This is NOT about style, rhetoric, word choice, or transitions. Focus on grammatical correctness.`;
        } else if (args.requirements.subtopic === 'Punctuation') {
          specificGuidance = `
SPECIFIC REQUIREMENTS FOR "Punctuation":
1. The passage MUST contain punctuation issues or ask about proper punctuation usage
2. The question MUST ask which choice correctly uses punctuation (commas, semicolons, apostrophes, colons, etc.)
3. Example question format: "Which choice correctly uses punctuation..." or "The writer wants to add punctuation..."
4. This is specifically about PUNCTUATION MARKS, not grammar or sentence structure`;
        } else if (args.requirements.subtopic === 'Rhetorical Synthesis') {
          specificGuidance = `
SPECIFIC REQUIREMENTS FOR "Rhetorical Synthesis":
1. The passage MUST have information that can be COMBINED or SYNTHESIZED from multiple sentences/parts
2. The question MUST ask which choice BEST COMBINES or SYNTHESIZES information from the passage
3. MUST use phrases like "best combines", "most effectively combines", "synthesizes", "integrates"
4. Example question format: "Which choice best combines the information in the underlined sentences?" or "Which choice most effectively synthesizes the information from the passage?"
5. CRITICAL: This is about COMBINING/SYNTHESIZING information, NOT about:
   - Summarizing information (that's "Information and Ideas")
   - Finding information (that's "Information and Ideas")
   - Inferring information (that's "Information and Ideas")
6. DO NOT use words like "summarizes", "describes", "indicates" - use "combines", "synthesizes", "integrates"
7. The question must require combining information from MULTIPLE parts of the passage`;
        } else if (args.requirements.subtopic === 'Transitions') {
          specificGuidance = `
SPECIFIC REQUIREMENTS FOR "Transitions":
1. The passage MUST have a place where a transition word/phrase is needed
2. The question MUST ask which transition word/phrase best connects ideas
3. Example question format: "Which choice provides the most appropriate transition?" or "The writer wants to add a transition..."
4. Answer choices should be transition words/phrases (however, therefore, furthermore, moreover, etc.)
5. This is about TRANSITION WORDS/PHRASES connecting ideas, not about combining information or summarizing`;
        }
        
        result.corrections = `${result.corrections || ''}\n\nCRITICAL: The generated question does not match the requested topic. You MUST generate a question that is clearly about ${folderToDisplayName(args.requirements.topic || '')}${args.requirements.subtopic ? `, specifically ${args.requirements.subtopic}` : ''}. The current question appears to be about ${topicValidation.actualTopic || 'a different topic'}.${specificGuidance}`;
      }
      
      // Check answer correctness
      const answerCorrectness = result.answerCorrectness || {};
      const isAnswerCorrect = answerCorrectness.isCorrect !== false; // Default to true if not specified
      
      // OPTIMIZATION: For math questions with low score, run math verifier as final check
      let finalScore = result.score || 0;
      let correctedAnswer: string | undefined = undefined;
      
      // If we already ran math verification and it passed, use that result
      if (mathVerificationResult && mathVerificationResult.isCorrect) {
        // Math verification already passed, continue with standard validation result
      } else if (isMath && finalScore < 0.85 && isAnswerCorrect && !mathVerificationResult) {
        // Low score but validator thinks answer is correct - verify with math verifier
        console.log('Low validation score for math question, running math verification...');
        try {
          const mathVerification = await verifyMathQuestion(
            args.question,
            args.answerChoices,
            args.correctAnswer,
            args.explanation
          );
          
          if (!mathVerification.isCorrect) {
            console.warn('Math verification found error:', mathVerification.explanation);
            result.issues = result.issues || [];
            result.issues.push(`Math verification: ${mathVerification.explanation}`);
            correctedAnswer = mathVerification.correctAnswerLetter || undefined;
            finalScore = Math.min(finalScore, 0.4); // Lower score if math is wrong
          }
        } catch (error) {
          console.warn('Math verification error:', error);
        }
      }
      
      // If answer is incorrect, add to issues and provide the correct answer
      if (!isAnswerCorrect) {
        // Ensure issues is an array of strings
        const issues: string[] = Array.isArray(result.issues) 
          ? result.issues.map(issue => typeof issue === 'string' ? issue : JSON.stringify(issue))
          : [];
        issues.push(`CRITICAL: The marked correct answer (${args.correctAnswer}) is incorrect. ${answerCorrectness.explanation || 'The actual correct answer may be different.'}`);
        if (answerCorrectness.actualCorrectAnswer) {
          issues.push(`The actual correct answer appears to be: ${answerCorrectness.actualCorrectAnswer}`);
          correctedAnswer = answerCorrectness.actualCorrectAnswer;
        }
        result.issues = issues;
        result.isValid = false;
        finalScore = Math.min(finalScore, 0.3); // Cap score at 0.3 if answer is wrong
      }
      
      // Ensure all issues are strings
      if (result.issues && Array.isArray(result.issues)) {
        result.issues = result.issues.map(issue => typeof issue === 'string' ? issue : JSON.stringify(issue));
      }
      
      // Enhance corrections with specific improvements if provided
      let enhancedCorrections = result.corrections || '';
      if (result.specificImprovements) {
        const improvements = result.specificImprovements;
        const improvementList: string[] = [];
        if (improvements.question) improvementList.push(`QUESTION: ${improvements.question}`);
        if (improvements.answerChoices) improvementList.push(`ANSWER CHOICES: ${improvements.answerChoices}`);
        if (improvements.explanation) improvementList.push(`EXPLANATION: ${improvements.explanation}`);
        if (improvements.passage) improvementList.push(`PASSAGE: ${improvements.passage}`);
        
        if (improvementList.length > 0) {
          enhancedCorrections = `${enhancedCorrections}\n\nSPECIFIC IMPROVEMENTS NEEDED:\n${improvementList.join('\n\n')}`;
        }
      }
      
      return {
        isValid: result.isValid !== false && isAnswerCorrect && finalScore >= 0.8, // Stricter: must be valid AND correct AND high score
        issues: result.issues || [],
        corrections: enhancedCorrections,
        score: finalScore, // Use final score (may be adjusted by math verifier)
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

