import { QuestionPickerAgent, QuestionSelection, PracticeTestState } from '../agents/question-picker-agent';
import { QuestionOrchestrator, QuestionGenerationRequest } from './question-orchestrator';
import { GeneratedQuestionResult } from './question-orchestrator';

export interface PracticeTestSession {
  id: string;
  userId: string;
  state: PracticeTestState;
  questions: Array<{
    selection: QuestionSelection;
    question?: GeneratedQuestionResult;
    userAnswer?: string;
    isCorrect?: boolean;
    timeSpent?: number;
  }>;
  startTime: Date;
  currentModuleStartTime?: Date;
  breakStartTime?: Date;
}

/**
 * Orchestrator for full-length practice tests
 * Handles timing, question picking, and session management
 */
export class PracticeTestOrchestrator {
  private questionPickerAgent: QuestionPickerAgent;
  private questionOrchestrator: QuestionOrchestrator;
  private satStructureContext: string | null = null;

  constructor() {
    this.questionPickerAgent = new QuestionPickerAgent();
    this.questionOrchestrator = new QuestionOrchestrator();
  }

  /**
   * Initialize a new practice test session
   */
  async initializeSession(userId: string): Promise<PracticeTestSession> {
    // Load SAT structure context
    const { fileReaderTool } = await import('../tools/file-reader');
    const structureResult = await fileReaderTool.execute({
      filePath: 'digital_sat_structure.docx',
    });

    if (structureResult.success) {
      this.satStructureContext = structureResult.text;
    }

    const session: PracticeTestSession = {
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      state: {
        currentSection: null,
        currentModule: 1,
        questionsAnswered: 0,
        totalQuestions: 98, // Full SAT has 98 questions
        previousQuestions: [],
        performance: {
          correct: 0,
          incorrect: 0,
        },
      },
      questions: [],
      startTime: new Date(),
    };

    return session;
  }

  /**
   * Get the next question for the practice test
   */
  async getNextQuestion(session: PracticeTestSession): Promise<{
    selection: QuestionSelection;
    question: GeneratedQuestionResult;
  }> {
    // Step 1: Question Picker Agent - Select next question
    console.log('Step 1: Picking next question...');
    const selection = await this.questionPickerAgent.execute(
      session.state,
      this.satStructureContext || undefined
    );

    // Update state
    if (!session.state.currentSection) {
      session.state.currentSection = selection.section;
    }

    // Step 2: Generate the question using Question Orchestrator
    console.log('Step 2: Generating question...');
    const questionRequest: QuestionGenerationRequest = {
      section: selection.section,
      topic: selection.topic,
      subtopic: selection.subtopic,
      difficulty: selection.difficulty,
    };

    const question = await this.questionOrchestrator.generateQuestion(questionRequest);

    // Store in session
    session.questions.push({
      selection,
      question,
    });

    // Update state
    session.state.questionsAnswered++;
    session.state.previousQuestions.push(selection);

    return {
      selection,
      question,
    };
  }

  /**
   * Submit an answer and update session state
   */
  submitAnswer(
    session: PracticeTestSession,
    questionIndex: number,
    userAnswer: string,
    timeSpent: number
  ): void {
    const questionData = session.questions[questionIndex];
    if (!questionData || !questionData.question) {
      throw new Error('Question not found');
    }

    const isCorrect = userAnswer === questionData.question.question.correctAnswer;
    questionData.userAnswer = userAnswer;
    questionData.isCorrect = isCorrect;
    questionData.timeSpent = timeSpent;

    if (isCorrect) {
      session.state.performance.correct++;
    } else {
      session.state.performance.incorrect++;
    }
  }

  /**
   * Check if it's time for a break
   */
  shouldTakeBreak(session: PracticeTestSession): boolean {
    // Break after Reading & Writing section (54 questions)
    return session.state.questionsAnswered === 54 && !session.breakStartTime;
  }

  /**
   * Start the break
   */
  startBreak(session: PracticeTestSession): void {
    session.breakStartTime = new Date();
  }

  /**
   * End the break and start Math section
   */
  endBreak(session: PracticeTestSession): void {
    session.breakStartTime = undefined;
    session.state.currentSection = 'math';
    session.state.currentModule = 1;
    session.currentModuleStartTime = new Date();
  }

  /**
   * Check if module 1 is complete and should move to module 2
   */
  shouldStartModule2(section: 'math' | 'reading-and-writing', questionsAnswered: number): boolean {
    if (section === 'reading-and-writing') {
      // Reading & Writing: 27 questions per module
      return questionsAnswered === 27;
    } else {
      // Math: 22 questions per module
      return questionsAnswered === 54 + 22; // After break + module 1 math
    }
  }

  /**
   * Start module 2 (adaptive based on performance)
   */
  startModule2(session: PracticeTestSession): void {
    session.state.currentModule = 2;
    session.currentModuleStartTime = new Date();
    
    // Determine difficulty for module 2 based on module 1 performance
    const module1Questions = session.questions.slice(
      session.state.currentSection === 'math' ? 54 : 0,
      session.state.currentSection === 'math' ? 54 + 22 : 27
    );
    const module1Correct = module1Questions.filter(q => q.isCorrect).length;
    const module1Accuracy = module1Correct / module1Questions.length;

    // If accuracy > 70%, module 2 should be harder
    // If accuracy < 50%, module 2 should be easier
    // This is a simplified version - real SAT uses more complex algorithms
    console.log(`Module 1 accuracy: ${(module1Accuracy * 100).toFixed(1)}%`);
  }

  /**
   * Get remaining time for current section
   */
  getRemainingTime(session: PracticeTestSession): number {
    const section = session.state.currentSection;
    if (!section) return 0;

    const sectionTimes = {
      'reading-and-writing': 64 * 60 * 1000, // 64 minutes
      'math': 70 * 60 * 1000, // 70 minutes
    };

    const totalTime = sectionTimes[section];
    const elapsed = session.currentModuleStartTime
      ? Date.now() - session.currentModuleStartTime.getTime()
      : Date.now() - session.startTime.getTime();

    return Math.max(0, totalTime - elapsed);
  }

  /**
   * Check if test is complete
   */
  isComplete(session: PracticeTestSession): boolean {
    return session.state.questionsAnswered >= session.state.totalQuestions;
  }
}

