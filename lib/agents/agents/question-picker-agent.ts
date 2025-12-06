import { BaseAgent } from './base-agent';
import { extractJSON } from '@/lib/utils/json-extractor';
import OpenAI from 'openai';

export interface QuestionSelection {
  section: 'math' | 'reading-and-writing';
  topic: string;
  subtopic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionNumber: number;
  module: 1 | 2; // For adaptive tests
}

export interface PracticeTestState {
  currentSection: 'math' | 'reading-and-writing' | null;
  currentModule: 1 | 2;
  questionsAnswered: number;
  totalQuestions: number;
  previousQuestions: QuestionSelection[];
  performance: {
    correct: number;
    incorrect: number;
  };
}

/**
 * Question Picker Agent - Selects the next question for practice tests
 * Uses SAT structure rules and previous question history
 */
export class QuestionPickerAgent extends BaseAgent {
  constructor() {
    super('gpt-4o-mini');
  }

  async execute(
    state: PracticeTestState,
    satStructureContext?: string
  ): Promise<QuestionSelection> {
    // First, get SAT structure if not provided
    let structureContext = satStructureContext;
    if (!structureContext) {
      const structureResult = await this.callTool('read_file', {
        filePath: 'digital_sat_structure.docx',
      });
      if (structureResult.success) {
        structureContext = structureResult.text;
      }
    }

    const prompt = `You are a Question Picker Agent for SAT practice tests. Your job is to select the next question based on:

1. SAT Structure Rules (from digital_sat_structure.docx):
${structureContext || 'Use standard SAT structure'}

2. Current Test State:
- Current Section: ${state.currentSection || 'Not started'}
- Current Module: ${state.currentModule}
- Questions Answered: ${state.questionsAnswered}/${state.totalQuestions}
- Previous Questions: ${JSON.stringify(state.previousQuestions.slice(-5), null, 2)}
- Performance: ${state.performance.correct} correct, ${state.performance.incorrect} incorrect

3. Rules for Question Selection:
- Follow the SAT adaptive structure: first module has mix of difficulties, second module adapts based on performance
- Ensure balanced coverage of topics within each section
- For Reading & Writing: cover all 4 domains (Information and Ideas, Craft and Structure, Expression of Ideas, Standard English Conventions)
- For Math: cover all 4 categories (Algebra, Advanced Math, Problem-Solving and Data Analysis, Geometry and Trigonometry)
- Questions should be arranged from easiest to hardest within each module
- Don't repeat the same subtopic too frequently

Select the next question and respond in JSON format:
{
  "section": "math" | "reading-and-writing",
  "topic": "string",
  "subtopic": "string (optional)",
  "difficulty": "easy" | "medium" | "hard",
  "questionNumber": number,
  "module": 1 | 2,
  "reasoning": "brief explanation of why this question was selected"
}`;

    const response = await this.chatCompletion(
      [
        {
          role: 'system',
          content: 'You are an expert SAT test structure analyzer. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      undefined,
      { type: 'function', function: { name: 'read_file' } },
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
              content: 'You are an expert SAT test structure analyzer. Always respond with valid JSON.',
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
      throw new Error('No response from Question Picker Agent');
    }

    try {
      const selection = extractJSON(content);
      return {
        section: selection.section,
        topic: selection.topic,
        subtopic: selection.subtopic,
        difficulty: selection.difficulty,
        questionNumber: selection.questionNumber || state.questionsAnswered + 1,
        module: selection.module || state.currentModule,
      };
    } catch (error) {
      // Fallback selection
      return this.getFallbackSelection(state);
    }
  }

  private getFallbackSelection(state: PracticeTestState): QuestionSelection {
    // Simple fallback logic
    const section = state.currentSection || 'reading-and-writing';
    const topics = section === 'math'
      ? ['Algebra', 'Advanced Math', 'Problem-Solving and Data Analysis', 'Geometry and Trigonometry']
      : ['Information and Ideas', 'Craft and Structure', 'Expression of Ideas', 'Standard English Conventions'];
    
    const topic = topics[state.questionsAnswered % topics.length];
    const difficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
    const difficulty = difficulties[state.questionsAnswered % 3] as 'easy' | 'medium' | 'hard';

    return {
      section: section as 'math' | 'reading-and-writing',
      topic,
      difficulty,
      questionNumber: state.questionsAnswered + 1,
      module: state.currentModule,
    };
  }
}

