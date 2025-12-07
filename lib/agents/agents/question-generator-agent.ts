import { BaseAgent } from './base-agent';
import { RetrievedContext } from '@/lib/rag/retriever';
import { questionValidatorTool, ValidationResult } from '../tools/question-validator';
import { extractJSON } from '@/lib/utils/json-extractor';
import { folderToDisplayName, getSubtopicsForTopic } from '@/lib/utils/topic-classifier';

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
    super('gpt-4o-mini'); // OPTIMIZATION: Switched to mini for 33-100x cost reduction
  }

  async execute(options: QuestionGenerationOptions): Promise<GeneratedQuestion> {
    const maxIterations = options.maxIterations || 3;
    let iteration = 0;
    // Start with external validation if provided (from orchestrator)
    let lastValidation: ValidationResult | null = options.externalValidation || null;

    // STEP 0: Get topic plan to ensure topic alignment BEFORE generation
    let topicPlan: any = null;
    if (options.subtopic) {
      try {
        const planResult = await this.callTool('plan_topic_aligned_question', {
          section: options.section,
          topic: options.topic,
          subtopic: options.subtopic,
          difficulty: options.difficulty,
        });
        if (planResult.success) {
          topicPlan = planResult.plan;
          console.log(`Topic plan generated: ${topicPlan.questionType} - Required keywords: ${topicPlan.requiredKeywords.join(', ')}`);
        }
      } catch (error) {
        console.warn('Topic planning failed, continuing without plan:', error);
      }
    }

    while (iteration < maxIterations) {
      const prompt = this.buildGenerationPrompt(options, lastValidation, iteration, topicPlan);

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
    iteration: number,
    topicPlan: any = null
  ): string {
    const { context, section, topic, subtopic, difficulty } = options;
    const isReadingWriting = section === 'reading-writing' || section === 'reading-and-writing';

    // Map folder name to display name for clarity
    const displayTopic = folderToDisplayName(topic);
    const availableSubtopics = getSubtopicsForTopic(topic);
    
    let prompt = `You are generating a SAT-style question. Your task is to ANALYZE the patterns, structure, and style from the provided examples and SAT rules, then generate NEW content that follows those patterns.

CRITICAL TOPIC REQUIREMENT:
Section: ${section}
Topic: ${displayTopic} (folder: ${topic})
${subtopic ? `Subtopic: ${subtopic}` : ''}
${availableSubtopics.length > 0 ? `Available subtopics for this topic: ${availableSubtopics.join(', ')}` : ''}
Difficulty: ${difficulty}

${subtopic === 'Rhetorical Synthesis' ? `
🚨 CRITICAL: You are generating a "Rhetorical Synthesis" question (Expression of Ideas).
   - DO NOT use words like "summarizes", "describes", "indicates" - those are for "Information and Ideas"
   - MUST use words like "combines", "synthesizes", "integrates"
   - The question MUST ask "which choice BEST COMBINES" or "which choice SYNTHESIZES"
   - This is about COMBINING information, NOT summarizing it
` : subtopic === 'Transitions' ? `
🚨 CRITICAL: You are generating a "Transitions" question (Expression of Ideas).
   - MUST ask which transition word/phrase best connects ideas
   - NOT about combining or summarizing information
` : displayTopic === 'Expression of Ideas' ? `
🚨 CRITICAL: You are generating an "Expression of Ideas" question.
   - This is about HOW ideas are expressed (combining, synthesizing, revising, transitions)
   - NOT about finding or summarizing information (that's "Information and Ideas")
   - If subtopic is "Rhetorical Synthesis": use "combines", "synthesizes", NOT "summarizes"
` : ''}

⚠️ TOPIC/SUBTOPIC ALIGNMENT IS MANDATORY - VERIFY BEFORE GENERATING:

CRITICAL: Before generating, you MUST verify you understand the exact requirements:

1. TOPIC REQUIREMENT: "${displayTopic}"
   ${subtopic ? `2. SUBTOPIC REQUIREMENT: "${subtopic}"` : '2. No specific subtopic required'}
   
${subtopic ? `
SUBTOPIC-SPECIFIC REQUIREMENTS FOR "${subtopic}":
${subtopic === 'Command of Evidence (Textual)' ? `
- MUST ask which TEXT from the passage supports a claim/conclusion
- MUST reference specific words, phrases, or sentences from the passage
- MUST NOT ask about data, statistics, charts, graphs, or numbers
- Example question format: "Which quotation from the passage best supports the claim that..."
- Answer choices should be direct quotes or references to specific text
` : subtopic === 'Command of Evidence (Quantitative)' ? `
- MUST ask which DATA, STATISTIC, CHART, GRAPH, or NUMERICAL EVIDENCE supports a claim
- MUST reference specific numbers, percentages, measurements, or visual data
- MUST NOT ask about text quotes or word meanings
- Example question format: "Which data from the passage/table/graph best supports..."
- Answer choices should reference specific data points, statistics, or visual elements
- The passage MUST include quantitative information (numbers, statistics, data)
` : subtopic === 'Words in Context' ? `
- MUST ask about the meaning of a specific word in the passage context
- MUST include the word in the passage
- MUST provide answer choices that are synonyms/definitions
- Example question format: "In the context of the passage, the word 'X' most nearly means..."
` : subtopic === 'Cross-Text Connections' ? `
- MUST require comparing/contrasting TWO passages
- MUST have "Passage 1:" and "Passage 2:" clearly labeled with clear separation
- MUST ask about relationships between the passages (NOT about individual passage content)
- MUST use phrases like "both passages", "two passages", "relate to each other", "differ", "compare", etc.
- Example question format: "How do the two passages relate to each other..." or "Both passages suggest..." or "Passage 1 and Passage 2 differ in that..."
- CRITICAL: This is about the CONNECTION between passages, NOT about finding information in one passage
` : subtopic === 'Text Structure and Purpose' ? `
- MUST ask about how the passage is organized or its purpose
- MUST focus on structure (comparison, cause-effect, chronological, etc.) or author's purpose
- Example question format: "The passage primarily organizes information by..." or "The primary purpose of the passage is..."
` : subtopic === 'Sentence Boundaries' ? `
- MUST ask about sentence completeness, fragments, or run-on sentences
- MUST test whether a sentence is complete or needs to be fixed
- Example question format: "Which choice completes the sentence..." or "The writer wants to fix the sentence..."
` : subtopic === 'Form, Structure, and Sense' ? `
- MUST ask about grammatical correctness, form, or making the sentence make sense
- MUST test grammar rules: subject-verb agreement, verb tense, parallel structure, pronoun usage, etc.
- MUST ask which choice is grammatically correct or makes the sentence logical/clear
- Example question format: "Which choice most effectively completes the sentence..." or "The writer wants to revise the sentence to fix a grammatical error..."
- CRITICAL: This is about GRAMMAR and making sentences grammatically correct and logical, NOT about style or rhetoric
` : subtopic === 'Punctuation' ? `
- MUST ask about punctuation marks: commas, semicolons, apostrophes, colons, periods, etc.
- MUST test proper punctuation usage
- Example question format: "Which choice correctly uses punctuation..." or "The writer wants to add punctuation..."
` : ''}
` : ''}

VERIFICATION CHECKLIST (MUST COMPLETE BEFORE GENERATING):
□ I understand the topic is: "${displayTopic}"
${subtopic ? `□ I understand the subtopic is: "${subtopic}"` : ''}
${subtopic === 'Command of Evidence (Quantitative)' ? `□ I will include quantitative data (numbers, statistics, charts) in the passage` : ''}
${subtopic === 'Command of Evidence (Textual)' ? `□ I will NOT include quantitative data - only text-based evidence` : ''}
${subtopic ? `□ My question will clearly test "${subtopic}" and not a different subtopic` : ''}
□ I will verify the question matches the requirements before finalizing

DO NOT generate if you cannot meet ALL requirements above. The system will reject mismatches.

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

${topicPlan && context.examples.length > 0 ? `
🎯 TOPIC-SPECIFIC ANALYSIS FROM EXAMPLES:
Look at the examples above and identify:
1. How do they use the required keywords: ${topicPlan.requiredKeywords.slice(0, 3).join(', ')}?
2. How do they phrase questions similar to: "${topicPlan.questionPhrase}"?
3. What makes these questions clearly belong to "${displayTopic}" > "${subtopic}"?
4. Study the question structure and wording patterns that ensure correct topic classification.

IMPORTANT: Your generated question MUST follow the same structural and wording patterns from these examples to ensure it's classified correctly.
` : ''}

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
CRITICAL FOR READING & WRITING QUESTIONS - SUBTOPIC-SPECIFIC INSTRUCTIONS:

${subtopic === 'Command of Evidence (Quantitative)' ? `
MANDATORY FOR "Command of Evidence (Quantitative)":
1. The passage MUST include quantitative data:
   - Specific numbers, statistics, percentages, measurements
   - Data tables, charts, graphs (describe them in the passage)
   - Numerical comparisons or trends
   - Example: "According to the study, 75% of participants showed improvement..."
2. The question MUST ask which QUANTITATIVE EVIDENCE supports a claim:
   - "Which data from the passage best supports..."
   - "Which statistic most clearly demonstrates..."
   - "The information in the table/graph supports..."
3. Answer choices MUST reference specific data/numbers:
   - "The 75% improvement rate mentioned in paragraph 2"
   - "The data showing a 30% increase"
   - NOT text quotes or word meanings
4. DO NOT create a "Command of Evidence (Textual)" question - this is QUANTITATIVE only
` : subtopic === 'Command of Evidence (Textual)' ? `
MANDATORY FOR "Command of Evidence (Textual)":
1. The passage should focus on ideas, arguments, claims (may include some numbers but question focuses on TEXT)
2. The question MUST ask which TEXT/QUOTATION supports a claim:
   - "Which quotation from the passage best supports..."
   - "Which statement from the passage most clearly supports..."
3. Answer choices MUST be direct quotes or text references:
   - "The author's statement that '...'"
   - "The passage's claim that..."
   - NOT data or statistics
4. DO NOT create a "Command of Evidence (Quantitative)" question - this is TEXTUAL only
` : subtopic === 'Words in Context' ? `
MANDATORY FOR "Words in Context":
1. Choose a word that has multiple possible meanings
2. Embed the word naturally in the passage context
3. The question MUST ask: "In the context of the passage, the word 'X' most nearly means:"
4. Answer choices MUST be synonyms/definitions, NOT quotes from passage
` : subtopic === 'Cross-Text Connections' ? `
MANDATORY FOR "Cross-Text Connections":
1. Generate EXACTLY TWO passages, clearly labeled:
   - "Passage 1: [content]"
   - "Passage 2: [content]"
   - The passages MUST be separated by a blank line
   - Each passage should be 25-75 words
2. Passages should present different perspectives, viewpoints, or approaches on a related topic
3. The question MUST explicitly ask about the relationship, comparison, or connection between the TWO passages:
   - REQUIRED: Use phrases like "How do the two passages relate to each other...", "Both passages suggest that...", "Passage 1 and Passage 2 differ in that...", "The relationship between the passages is...", "Compared to Passage 1, Passage 2...", etc.
   - The question MUST reference BOTH passages explicitly
   - The question MUST NOT ask about information from just one passage
   - The question MUST focus on comparing, contrasting, or connecting the passages
4. Answer choices MUST reference the relationship between passages, not just one passage
5. CRITICAL: This is NOT "Information and Ideas" - do NOT ask about main ideas, inferences, or evidence from individual passages. This is about the CONNECTION between two passages.
` : subtopic === 'Sentence Boundaries' ? `
MANDATORY FOR "Sentence Boundaries":
1. The passage MUST contain a sentence that is incomplete, a fragment, or a run-on
2. The question MUST ask which choice completes the sentence, fixes the fragment, or corrects the run-on
3. Example question format: "Which choice completes the sentence..." or "The writer wants to fix the sentence fragment..."
4. Answer choices should include options that complete, fix, or properly punctuate the sentence
5. CRITICAL: This is about sentence COMPLETENESS and STRUCTURE, not grammar rules or punctuation marks
` : subtopic === 'Form, Structure, and Sense' ? `
MANDATORY FOR "Form, Structure, and Sense":
1. The passage MUST contain a grammatical error or unclear structure
2. The question MUST ask which choice is grammatically correct OR makes the sentence logical/clear
3. MUST test grammar rules such as:
   - Subject-verb agreement
   - Verb tense consistency
   - Parallel structure
   - Pronoun agreement
   - Logical sentence structure
4. Example question format: "Which choice most effectively completes the sentence..." or "The writer wants to revise the sentence to fix a grammatical error..."
5. Answer choices should include grammatically incorrect options and one correct option
6. CRITICAL: This is about GRAMMAR and making sentences grammatically correct and logical. This is NOT about style, rhetoric, or word choice. Focus on grammatical correctness.
` : subtopic === 'Punctuation' ? `
MANDATORY FOR "Punctuation":
1. The passage MUST contain punctuation issues or ask about proper punctuation usage
2. The question MUST ask which choice correctly uses punctuation (commas, semicolons, apostrophes, colons, etc.)
3. Example question format: "Which choice correctly uses punctuation..." or "The writer wants to add punctuation..."
4. Answer choices should demonstrate correct vs. incorrect punctuation usage
5. CRITICAL: This is specifically about PUNCTUATION MARKS, not grammar or sentence structure
` : subtopic === 'Rhetorical Synthesis' ? `
MANDATORY FOR "Rhetorical Synthesis":
1. The passage MUST have information that can be COMBINED or SYNTHESIZED from multiple sentences/parts
2. The question MUST ask which choice BEST COMBINES or SYNTHESIZES information from the passage
3. MUST use phrases like "best combines", "most effectively combines", "synthesizes", "integrates", "best combines the information"
4. Example question format: "Which choice best combines the information in the underlined sentences?" or "Which choice most effectively synthesizes the information from the passage?"
5. The question MUST require combining information from MULTIPLE parts of the passage, not just summarizing one part
6. CRITICAL: This is about COMBINING/SYNTHESIZING information, NOT about:
   - Summarizing information (that's "Information and Ideas")
   - Finding information (that's "Information and Ideas")
   - Inferring information (that's "Information and Ideas")
   - Just asking "which best summarizes" (that's "Information and Ideas")
7. DO NOT use words like "summarizes", "describes", "indicates" - use "combines", "synthesizes", "integrates"
8. The answer choices should be different ways of COMBINING the same information, not summaries of different information
` : subtopic === 'Transitions' ? `
MANDATORY FOR "Transitions":
1. The passage MUST have a place where a transition word/phrase is needed
2. The question MUST ask which transition word/phrase best connects ideas
3. MUST test logical connections between sentences or paragraphs
4. Example question format: "Which choice provides the most appropriate transition?" or "The writer wants to add a transition..."
5. Answer choices should be transition words/phrases (however, therefore, furthermore, moreover, etc.)
6. CRITICAL: This is about TRANSITION WORDS/PHRASES connecting ideas, not about combining information or summarizing
` : ''}

GENERAL READING & WRITING REQUIREMENTS:
- Generate a COMPLETELY ORIGINAL reading passage (25-150 words) following the STRUCTURAL patterns you observed
- Match the style, tone, and organization patterns from the examples (not the content/topics)
- Choose ANY topic/content for your passage (be creative and varied - don't copy topics from examples)
- The passage should be appropriate for the specified topic/subtopic category
- The passage should match the difficulty level patterns you identified
- The question should directly reference the passage (following the question-reference patterns from examples)
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
  * USE LaTeX FORMAT for ALL mathematical expressions:
    - Inline math: Use $...$ for fractions, variables, operations (e.g., $\\frac{9}{3} = 3$, $x^2$, $y_1 - y_2$)
    - Block math: Use $$...$$ for equations that should be on their own line
    - Examples: 
      * Fractions: $\\frac{a}{b}$ or $\\frac{y_2 - y_1}{x_2 - x_1}$
      * Exponents: $x^2$, $3^n$
      * Subscripts: $x_1$, $y_2$
      * Operations: $\\sqrt{x}$, $\\pm$, $\\times$, $\\div$
      * Equations: $y = mx + b$, $ax^2 + bx + c = 0$
      * Inequalities: $x > 0$, $y \\leq 5$
    - Always use LaTeX for: fractions, divisions, multiplications, exponents, roots, variables, equations, inequalities, and any mathematical notation
- If the question needs a visual (graph, table, diagram), set needsVisual to true
- Provide a detailed visualDescription following the pattern of how visuals are described in examples
`}

FINAL GENERATION CHECKLIST - VERIFY EACH POINT:

Before finalizing your response, verify:
1. ✅ Topic matches: "${displayTopic}"
${subtopic ? `2. ✅ Subtopic matches: "${subtopic}"` : '2. ✅ No specific subtopic required'}
${subtopic === 'Command of Evidence (Quantitative)' ? `3. ✅ Passage includes quantitative data (numbers, statistics)` : ''}
${subtopic === 'Command of Evidence (Quantitative)' ? `4. ✅ Question asks about QUANTITATIVE evidence, not text quotes` : ''}
${subtopic === 'Command of Evidence (Textual)' ? `3. ✅ Question asks about TEXT/QUOTATIONS, not data/statistics` : ''}
${subtopic === 'Cross-Text Connections' ? `3. ✅ TWO passages are included and labeled "Passage 1:" and "Passage 2:" with clear separation` : ''}
${subtopic === 'Cross-Text Connections' ? `4. ✅ Question explicitly asks about the relationship/connection between the TWO passages (not just one passage)` : ''}
${subtopic === 'Cross-Text Connections' ? `5. ✅ Question uses phrases like "both passages", "two passages", "relate", "differ", "compare", etc.` : ''}
${subtopic === 'Sentence Boundaries' ? `3. ✅ Question asks about sentence completeness, fragments, or run-ons` : ''}
${subtopic === 'Sentence Boundaries' ? `4. ✅ Passage contains an incomplete sentence, fragment, or run-on` : ''}
${subtopic === 'Form, Structure, and Sense' ? `3. ✅ Question asks about grammatical correctness or making the sentence logical/clear` : ''}
${subtopic === 'Form, Structure, and Sense' ? `4. ✅ Passage contains a grammatical error (subject-verb, tense, parallel structure, pronoun, etc.)` : ''}
${subtopic === 'Form, Structure, and Sense' ? `5. ✅ Question tests GRAMMAR rules, NOT style or rhetoric` : ''}
${subtopic === 'Punctuation' ? `3. ✅ Question asks about correct punctuation usage (commas, semicolons, apostrophes, etc.)` : ''}
${subtopic === 'Punctuation' ? `4. ✅ Passage contains punctuation issues or asks about punctuation` : ''}
${subtopic === 'Rhetorical Synthesis' ? `3. ✅ Question asks which choice BEST COMBINES or SYNTHESIZES information (NOT summarizes)` : ''}
${subtopic === 'Rhetorical Synthesis' ? `4. ✅ Question uses phrases like "best combines", "synthesizes", "integrates" (NOT "summarizes")` : ''}
${subtopic === 'Rhetorical Synthesis' ? `5. ✅ Question requires combining information from MULTIPLE parts of the passage` : ''}
${subtopic === 'Transitions' ? `3. ✅ Question asks which transition word/phrase best connects ideas` : ''}
${subtopic === 'Transitions' ? `4. ✅ Passage has a place where a transition is needed` : ''}
${topicPlan ? `5. ✅ Question includes at least 2 of the required keywords: ${topicPlan.requiredKeywords.slice(0, 3).join(', ')}` : ''}
${topicPlan ? `6. ✅ Question uses the required phrase or close variation: "${topicPlan.questionPhrase}"` : ''}
${topicPlan ? `7. ✅ Question follows the topic alignment plan: ${topicPlan.topicAlignment}` : ''}
${!topicPlan ? '5. ✅ Follows the STRUCTURAL patterns from examples (format, organization, style)' : '8. ✅ Follows the STRUCTURAL patterns from examples (format, organization, style)'}
${!topicPlan ? '6. ✅ Matches the difficulty level patterns observed' : '9. ✅ Matches the difficulty level patterns observed'}
7. ✅ Has one clearly correct answer
8. ✅ Has plausible but clearly incorrect distractors
${isReadingWriting ? '9. ✅ Passage is 25-150 words and appropriate for the subtopic' : '9. ✅ Includes all necessary information'}

CHAIN-OF-THOUGHT VERIFICATION:
Before outputting JSON, think through:
1. "What topic am I generating for?" → "${displayTopic}"
${subtopic ? `2. "What subtopic am I generating for?" → "${subtopic}"` : ''}
${topicPlan ? `3. "Do I have the required keywords in my question?" → Check: ${topicPlan.requiredKeywords.slice(0, 3).join(', ')}` : ''}
${topicPlan ? `4. "Am I using the required question phrase?" → "${topicPlan.questionPhrase}"` : ''}
${topicPlan ? `5. "Will my question be classified as ${displayTopic} > ${subtopic}?" → Verify using the topic alignment plan above` : ''}
${subtopic === 'Command of Evidence (Quantitative)' ? `3. "Does my passage include numbers/data/statistics?" → YES` : ''}
${subtopic === 'Command of Evidence (Quantitative)' ? `4. "Does my question ask about quantitative evidence?" → YES` : ''}
${subtopic === 'Command of Evidence (Textual)' ? `3. "Does my question ask about text/quotes?" → YES` : ''}
${subtopic === 'Command of Evidence (Textual)' ? `4. "Am I NOT asking about data/statistics?" → YES` : ''}
${subtopic === 'Cross-Text Connections' ? `3. "Do I have TWO passages labeled 'Passage 1:' and 'Passage 2:'?" → YES` : ''}
${subtopic === 'Cross-Text Connections' ? `4. "Does my question ask about the RELATIONSHIP between the two passages?" → YES` : ''}
${subtopic === 'Cross-Text Connections' ? `5. "Does my question use phrases like 'both passages', 'two passages', 'relate', 'differ', 'compare'?" → YES` : ''}
${subtopic === 'Cross-Text Connections' ? `6. "Am I NOT asking about information from just one passage?" → YES` : ''}
${subtopic === 'Sentence Boundaries' ? `3. "Does my question ask about sentence completeness, fragments, or run-ons?" → YES` : ''}
${subtopic === 'Sentence Boundaries' ? `4. "Does my passage contain an incomplete sentence, fragment, or run-on?" → YES` : ''}
${subtopic === 'Form, Structure, and Sense' ? `3. "Does my question ask about grammatical correctness or making the sentence logical?" → YES` : ''}
${subtopic === 'Form, Structure, and Sense' ? `4. "Does my passage contain a grammatical error?" → YES` : ''}
${subtopic === 'Form, Structure, and Sense' ? `5. "Am I testing GRAMMAR rules, NOT style or rhetoric?" → YES` : ''}
${subtopic === 'Punctuation' ? `3. "Does my question ask about correct punctuation usage?" → YES` : ''}
${subtopic === 'Punctuation' ? `4. "Does my passage contain punctuation issues?" → YES` : ''}
${subtopic === 'Rhetorical Synthesis' ? `3. "Does my question ask which choice BEST COMBINES or SYNTHESIZES information?" → YES` : ''}
${subtopic === 'Rhetorical Synthesis' ? `4. "Am I using words like 'combines', 'synthesizes', 'integrates' (NOT 'summarizes')?" → YES` : ''}
${subtopic === 'Rhetorical Synthesis' ? `5. "Does my question require combining information from MULTIPLE parts?" → YES` : ''}
${subtopic === 'Rhetorical Synthesis' ? `6. "Am I NOT asking 'which best summarizes'?" → YES` : ''}
${subtopic === 'Transitions' ? `3. "Does my question ask which transition word/phrase best connects ideas?" → YES` : ''}
${subtopic === 'Transitions' ? `4. "Does my passage have a place where a transition is needed?" → YES` : ''}
5. "Will this question be classified as ${subtopic || displayTopic}?" → YES

ONLY output JSON if ALL verifications pass.

${context.visualExamples && context.visualExamples.length > 0 ? `
VISUAL EXAMPLES AVAILABLE:
You have ${context.visualExamples.length} visual example(s) from actual SAT materials. 
${isReadingWriting ? 'If the question involves interpreting charts/tables/graphs mentioned in the passage, set needsVisual to true and describe the visual needed.' : 'Use these as reference for visual style and format if your question needs a visual.'}
` : ''}

${lastValidation && (!lastValidation.isValid || lastValidation.score < 0.8) ? `
CRITICAL: Previous attempt FAILED validation. You MUST fix ALL issues before generating a new question.

VALIDATION SCORE: ${lastValidation.score}/1.0 (Target: 0.8+)
${lastValidation.score < 0.8 ? '⚠️ SCORE TOO LOW - Question needs significant improvement' : ''}

ISSUES FOUND:
${lastValidation.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

DETAILED CORRECTIONS REQUIRED:
${lastValidation.corrections || 'Please address all issues listed above.'}

CRITICAL INSTRUCTIONS FOR REGENERATION:
1. Read EACH issue carefully and understand what went wrong
2. Address EVERY issue listed above - do not skip any
3. Follow the corrections EXACTLY as specified
4. If the correct answer was wrong, use the corrected answer: ${lastValidation.correctedAnswer || 'N/A'}
5. Make sure your new question addresses ALL the problems from the previous attempt
6. Double-check that your new question would NOT have the same issues

IMPORTANT: This is attempt ${iteration + 1}. The previous attempt had ${lastValidation.issues.length} issue(s). Your new question MUST be significantly improved. Do not make the same mistakes.

Generate a COMPLETELY REVISED question that fixes ALL the issues above:
` : ''}
${lastValidation && lastValidation.isValid && lastValidation.score >= 0.8 ? `\n✅ Previous attempt passed validation (score: ${lastValidation.score}). Continue with this quality level.\n` : ''}

Respond in JSON format:
{
  ${isReadingWriting ? `"passage": "the reading passage(s). For single passage: just the passage text. For Cross-Text Connections: format as 'Passage 1: [text]\\n\\nPassage 2: [text]' with clear separation",\n  ` : ''}"question": "the question text${isReadingWriting ? ' (which references the passage)' : ''}${!isReadingWriting ? '. For MATH: Use LaTeX format ($...$ for inline math) for all mathematical expressions in the question.' : ''}",
  "answerChoices": ["choice text without letter prefix", "choice text without letter prefix", "choice text without letter prefix", "choice text without letter prefix"]${!isReadingWriting ? '. For MATH: Use LaTeX format ($...$ for inline math) for all mathematical expressions in answer choices.' : ''},
  "correctAnswer": "A" | "B" | "C" | "D",
  "explanation": "brief explanation of why the correct answer is correct${isReadingWriting ? ' (reference the passage)' : ''}. ${!isReadingWriting ? 'For MATH questions: The explanation MUST show the actual mathematical steps and calculations. Do NOT make up or hallucinate calculations. Show real math work that leads to the answer. Verify all arithmetic is correct. Use LaTeX format ($...$ for inline math) for ALL mathematical expressions: fractions ($\\frac{a}{b}$), operations, variables, equations, etc.' : 'MUST verify that the marked correctAnswer is actually correct.'}",
  "needsVisual": boolean,
  "visualDescription": "description of visual needed (if needsVisual is true). ${isReadingWriting ? 'For Reading & Writing, this might be a chart/table/graph referenced in the passage.' : 'For Math: Describe ALL elements needed - include ALL angles (especially 90°, 60°, 30°), ALL measurements, ALL relationships. Be specific and complete. The visual must contain ALL information needed to solve the problem.'}"
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

