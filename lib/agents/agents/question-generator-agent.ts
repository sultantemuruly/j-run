import { BaseAgent } from './base-agent';
import { RetrievedContext } from '@/lib/rag/retriever';
import { questionValidatorTool, ValidationResult } from '../tools/question-validator';
import { extractJSON } from '@/lib/utils/json-extractor';

export interface GeneratedQuestion {
  passage?: string; // Required for Reading & Writing questions
  question: string;
  answerChoices: string[];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  needsVisual: boolean;
  visualDescription?: string;
  visualData?: any; // Structured data for the visual if generated
}

export interface QuestionGenerationOptions {
  section: string;
  topic: string;
  subtopic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  context: RetrievedContext;
  maxIterations?: number;
  externalValidation?: ValidationResult; // Validation feedback from orchestrator
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
    // Start with external validation if provided (from orchestrator)
    let lastValidation: ValidationResult | null = options.externalValidation || null;

    while (iteration < maxIterations) {
      const prompt = this.buildGenerationPrompt(options, lastValidation, iteration);

      // Retry logic for JSON parsing
      let parseAttempts = 0;
      const maxParseAttempts = 3; // Increased to 3 attempts
      let generatedQuestion: GeneratedQuestion | null = null;
      let lastError: Error | null = null;
      let lastContent: string | null = null;

      while (parseAttempts < maxParseAttempts && !generatedQuestion) {
        try {
          // Try with json_object format first, then fallback to regular format if needed
          const useJsonFormat = parseAttempts < 2; // Use JSON format for first 2 attempts
          
          let response = await this.chatCompletion(
            [
              {
                role: 'system',
                content: 'You are an expert SAT question writer. Generate high-quality, SAT-standard questions. You MUST respond with valid JSON only, no markdown, no code blocks, just the raw JSON object.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            [], // Always disable tools to avoid conflicts with JSON responses
            'none', // Explicitly disable tool calls
            useJsonFormat ? { type: 'json_object' } : undefined
          );

          // Check if response has content
          if (!response.choices || response.choices.length === 0) {
            throw new Error('No choices in response from OpenAI');
          }

          // Handle tool calls if they occur (shouldn't happen with tool_choice: 'none', but handle it anyway)
          if (response.choices[0].message.tool_calls && response.choices[0].message.tool_calls.length > 0) {
            console.warn(`Attempt ${parseAttempts + 1}: Model attempted to use tools despite tool_choice: 'none'. Handling tool calls...`);
            const toolMessages = await this.handleToolCalls(response.choices[0].message.tool_calls);
            // Retry with tool results, but still request JSON
            response = await this.chatCompletion(
              [
                {
                  role: 'system',
                  content: 'You are an expert SAT question writer. Generate high-quality, SAT-standard questions. You MUST respond with valid JSON only, no markdown, no code blocks, just the raw JSON object.',
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
              [], // Still disable tools
              'none', // Still disable tool calls
              useJsonFormat ? { type: 'json_object' } : undefined
            );
          }

          const content = response.choices[0].message.content;
          if (!content) {
            // Log the full response for debugging
            console.error(`Attempt ${parseAttempts + 1}: Empty content in response. Response structure:`, {
              hasChoices: !!response.choices,
              choicesLength: response.choices?.length,
              messageRole: response.choices?.[0]?.message?.role,
              hasToolCalls: !!response.choices?.[0]?.message?.tool_calls,
              toolCallsCount: response.choices?.[0]?.message?.tool_calls?.length || 0,
            });
            throw new Error('No response content from Question Generator Agent');
          }

          lastContent = content;

          // Extract JSON from response (handles markdown code blocks)
          const parsed = extractJSON(content);
          
          // Validate required fields
          if (!parsed.question || !parsed.answerChoices || !parsed.correctAnswer) {
            throw new Error('Missing required fields in generated question');
          }
          
          // Normalize correctAnswer to ensure it's uppercase and valid
          let normalizedCorrectAnswer = parsed.correctAnswer;
          if (typeof normalizedCorrectAnswer === 'string') {
            normalizedCorrectAnswer = normalizedCorrectAnswer.toUpperCase().trim();
            if (!['A', 'B', 'C', 'D'].includes(normalizedCorrectAnswer)) {
              throw new Error(`Invalid correctAnswer: ${normalizedCorrectAnswer}. Must be A, B, C, or D`);
            }
          } else {
            throw new Error(`correctAnswer must be a string, got: ${typeof normalizedCorrectAnswer}`);
          }
          
          generatedQuestion = {
            passage: parsed.passage, // May be undefined for Math questions
            question: parsed.question,
            answerChoices: Array.isArray(parsed.answerChoices) ? parsed.answerChoices : [],
            correctAnswer: normalizedCorrectAnswer as 'A' | 'B' | 'C' | 'D',
            explanation: parsed.explanation,
            needsVisual: parsed.needsVisual || false,
            visualDescription: parsed.visualDescription,
            visualData: parsed.visualData,
          };
          
          // Validate that correctAnswer index is within bounds
          if (generatedQuestion.answerChoices.length !== 4) {
            throw new Error(`Must have exactly 4 answer choices, got ${generatedQuestion.answerChoices.length}`);
          }
          
          const answerIndex = generatedQuestion.correctAnswer.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
          if (answerIndex < 0 || answerIndex >= generatedQuestion.answerChoices.length) {
            throw new Error(`correctAnswer ${generatedQuestion.correctAnswer} is out of bounds for ${generatedQuestion.answerChoices.length} choices`);
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          parseAttempts++;
          if (parseAttempts >= maxParseAttempts) {
            // Log the content for debugging
            console.error('Failed to parse question after retries. Content preview:', lastContent?.substring(0, 300));
            throw new Error(`Failed to parse question: ${lastError.message}`);
          }
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!generatedQuestion) {
        throw new Error(`Failed to generate question after parse attempts: ${lastError?.message || 'Unknown error'}`);
      }

      // Validate the question
      const validation = await questionValidatorTool.execute({
        question: generatedQuestion.question,
        passage: generatedQuestion.passage,
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
    const isReadingWriting = section === 'reading-writing' || section === 'reading-and-writing';

    let prompt = `You are generating a SAT-style question. Your task is to ANALYZE the patterns, structure, and style from the provided examples and SAT rules, then generate NEW content that follows those patterns.

Section: ${section}
Topic: ${topic}
${subtopic ? `Subtopic: ${subtopic}` : ''}
Difficulty: ${difficulty}

STEP 1: ANALYZE THE SAT RULES AND GUIDELINES
${context.rules}

${context.instructions ? `Additional Instructions:\n${context.instructions}\n` : ''}

STEP 2: ANALYZE THE PATTERNS FROM EXAMPLES
Study these examples carefully and identify patterns:

${context.examples.map((ex, i) => {
  let exampleText = `Example ${i + 1}:\n`;
  if (ex.passage) exampleText += `PASSAGE PATTERN:\n${ex.passage}\n\n`;
  exampleText += `QUESTION PATTERN: ${ex.question}\nANSWER PATTERN: ${ex.answer}`;
  return exampleText;
}).join('\n\n---\n\n')}

ANALYZE THESE STRUCTURAL PATTERNS (NOT THE TOPICS/CONTENT):
1. Passage structure: How are passages structured? What's the typical length, style, and content organization? (IGNORE the actual topic - focus on structure)
2. Question phrasing: How are questions worded? What language patterns do they use? (IGNORE what the question asks about - focus on HOW it's asked)
3. Answer choice style: How are distractors constructed? What makes them plausible but incorrect? (IGNORE the actual answers - focus on the STYLE of answer choices)
4. Format and organization: How is information organized? What's the flow and structure?
5. Difficulty indicators: What makes a question easy/medium/hard in these examples? (Focus on complexity indicators, not the topics)

STEP 3: GENERATE BASED ON STRUCTURAL PATTERNS WITH RANDOMIZED TOPICS
Using the STRUCTURAL patterns you identified from the examples and the SAT rules, generate a NEW question that:
- Follows the STRUCTURAL patterns you observed (format, organization, style, phrasing)
- Matches the STYLE patterns from the examples (how things are worded, how information flows)
- Uses ANY TOPIC/CONTENT you choose (NOT limited to topics from examples - be creative and varied)
- Adheres to the SAT rules and guidelines
- Creates COMPLETELY ORIGINAL content with RANDOMIZED topics that follows these structural patterns
- Does NOT copy topics, content, or specific ideas from examples - only use their structural and stylistic patterns
- Vary the topics widely to create diverse, randomized questions while maintaining structural consistency

${isReadingWriting ? `
CRITICAL FOR READING & WRITING QUESTIONS:
Based on the STRUCTURAL patterns you analyzed from the examples (NOT the topics):
- Generate a COMPLETELY ORIGINAL reading passage (25-150 words) following the STRUCTURAL patterns you observed
- Match the style, tone, and organization patterns from the examples (not the content/topics)
- Choose ANY topic/content for your passage (be creative and varied - don't copy topics from examples)
- The passage should be appropriate for the specified topic/subtopic category, but use varied, randomized content
- The passage should match the difficulty level patterns you identified
- The question should directly reference the passage (following the question-reference patterns from examples)
- For "Words in Context": Follow the pattern of how words are embedded in passages in the examples, but use different words/topics
- For "Command of Evidence": Follow the pattern of how evidence is presented in the example passages, but with different content
- For "Cross-Text Connections": Generate TWO separate passages labeled "Passage 1:" and "Passage 2:" following the pattern of how multiple passages are structured in examples, but with varied topics
` : `
FOR MATH QUESTIONS:
Based on the STRUCTURAL patterns you analyzed from the examples (NOT the specific math problems):
- Follow the structural patterns of how math questions are worded in the examples
- Match the style of how information is presented
- Include all necessary information following the pattern from examples
- Use ANY math scenario/problem you choose (be creative and varied - don't copy specific problems from examples)
- CRITICAL FOR EXPLANATIONS: When writing the explanation, you MUST:
  * Actually solve the problem step by step with REAL calculations
  * Show actual mathematical work - do NOT make up or hallucinate numbers
  * Verify all arithmetic is correct before writing the explanation
  * Do NOT say "this simplifies to X" unless it actually simplifies to X
  * Do NOT make up intermediate steps or results
  * The explanation must be mathematically sound and lead to the correct answer
- If the question needs a visual (graph, table, diagram), set needsVisual to true
- Provide a detailed visualDescription following the pattern of how visuals are described in examples
`}

Generate a question that:
1. Follows the STRUCTURAL patterns you identified from the examples (format, organization, style)
2. Matches the difficulty level patterns you observed in the examples
3. Tests the specified topic/subtopic but with ANY CONTENT/TOPIC you choose (be creative and varied - don't limit yourself to topics from examples)
4. Uses the STYLISTIC patterns from examples (wording, phrasing, tone) while discussing your chosen topic
5. Has one clearly correct answer (following the answer correctness patterns from examples)
6. Has distractors that follow the distractor patterns you identified (plausible but clearly incorrect)
${isReadingWriting ? '7. Includes a passage that follows the passage structure patterns from examples, but about ANY topic you choose (be creative and varied)' : '7. Includes all necessary information following the information-presentation patterns from examples, but with varied topics'}

${context.visualExamples && context.visualExamples.length > 0 ? `
VISUAL EXAMPLES AVAILABLE:
You have ${context.visualExamples.length} visual example(s) from actual SAT materials. 
${isReadingWriting ? 'If the question involves interpreting charts/tables/graphs mentioned in the passage, set needsVisual to true and describe the visual needed.' : 'Use these as reference for visual style and format if your question needs a visual.'}
` : ''}

${lastValidation && !lastValidation.isValid ? `\nPrevious attempt had issues:\n${lastValidation.issues.join('\n')}\n\nCorrections needed:\n${lastValidation.corrections || 'Please address the issues above.'}\n\nGenerate an improved version:` : ''}

Respond in JSON format:
{
  ${isReadingWriting ? `"passage": "the reading passage(s). For single passage: just the passage text. For Cross-Text Connections: format as 'Passage 1: [text]\\n\\nPassage 2: [text]' with clear separation",\n  ` : ''}"question": "the question text${isReadingWriting ? ' (which references the passage)' : ''}",
  "answerChoices": ["choice text without letter prefix", "choice text without letter prefix", "choice text without letter prefix", "choice text without letter prefix"],
  "correctAnswer": "A" | "B" | "C" | "D",
  "explanation": "brief explanation of why the correct answer is correct${isReadingWriting ? ' (reference the passage)' : ''}. ${!isReadingWriting ? 'For MATH questions: The explanation MUST show the actual mathematical steps and calculations. Do NOT make up or hallucinate calculations. Show real math work that leads to the answer. Verify all arithmetic is correct.' : 'MUST verify that the marked correctAnswer is actually correct.'}",
  "needsVisual": boolean,
  "visualDescription": "description of visual needed (if needsVisual is true). ${isReadingWriting ? 'For Reading & Writing, this might be a chart/table/graph referenced in the passage.' : 'For Math, describe the graph/table/diagram needed.'}"
}

IMPORTANT: 
1. In answerChoices, provide ONLY the choice text WITHOUT any letter prefix (no "A)", "B)", "C)", "D)" or "A.", "B.", etc.). The letters will be added automatically by the display system.
2. For correctAnswer, you MUST verify that the letter you choose (A, B, C, or D) corresponds to the ACTUALLY CORRECT answer choice. 
3. Double-check: If the correct answer is the first choice, use "A". If it's the second choice, use "B", etc.
4. For math questions especially: Calculate the answer, then find which answer choice contains that answer, then set correctAnswer to the corresponding letter (A, B, C, or D).
5. The correctAnswer MUST be a single uppercase letter: "A", "B", "C", or "D" - nothing else.`;

    return prompt;
  }
}

