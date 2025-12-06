import { RetrieverAgent } from '../agents/retriever-agent';
import { QuestionGeneratorAgent, GeneratedQuestion } from '../agents/question-generator-agent';
import { VisualGeneratorAgent, GeneratedVisual } from '../agents/visual-generator-agent';
import { CheckingAgent } from '../agents/checking-agent';
import { VisualCheckingAgent } from '../agents/visual-checking-agent';

export interface QuestionGenerationRequest {
  section: 'math' | 'reading-and-writing';
  topic: string;
  subtopic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  customContext?: string;
}

export interface GeneratedQuestionResult {
  question: GeneratedQuestion;
  visual?: GeneratedVisual;
  metadata: {
    section: string;
    topic: string;
    subtopic?: string;
    difficulty: string;
    generationTime: number;
    iterations: number;
  };
}

/**
 * Orchestrator for custom practice question generation
 * Handles agent coordination and feedback loops
 */
export class QuestionOrchestrator {
  private retrieverAgent: RetrieverAgent;
  private questionGeneratorAgent: QuestionGeneratorAgent;
  private visualGeneratorAgent: VisualGeneratorAgent;
  private checkingAgent: CheckingAgent;
  private visualCheckingAgent: VisualCheckingAgent;

  constructor() {
    this.retrieverAgent = new RetrieverAgent();
    this.questionGeneratorAgent = new QuestionGeneratorAgent();
    this.visualGeneratorAgent = new VisualGeneratorAgent();
    this.checkingAgent = new CheckingAgent();
    this.visualCheckingAgent = new VisualCheckingAgent();
  }

  async generateQuestion(request: QuestionGenerationRequest): Promise<GeneratedQuestionResult> {
    const startTime = Date.now();
    let iterations = 0;
    const maxIterations = 5;

    try {
      // Step 1: Retriever Agent - Get context and examples
      console.log('Step 1: Retrieving context...');
      const context = await this.retrieverAgent.execute(
        request.customContext || `Generate a ${request.difficulty} ${request.section} question about ${request.topic}${request.subtopic ? `, specifically ${request.subtopic}` : ''}`,
        {
          section: request.section,
          topic: request.topic,
          subtopic: request.subtopic,
          difficulty: request.difficulty,
          maxExamples: 5,
        }
      );

      // Step 2: Question Generator Agent - Generate question
      console.log('Step 2: Generating question...');
      let generatedQuestion: GeneratedQuestion;
      let questionValid = false;
      let questionIterations = 0;

      while (!questionValid && questionIterations < maxIterations) {
        questionIterations++;
        iterations++;

        generatedQuestion = await this.questionGeneratorAgent.execute({
          section: request.section,
          topic: request.topic,
          subtopic: request.subtopic,
          difficulty: request.difficulty,
          context,
          maxIterations: 3,
        });

        // Step 3: Checking Agent - Validate question
        console.log('Step 3: Validating question...');
        const validation = await this.checkingAgent.execute(
          generatedQuestion,
          {
            section: request.section,
            topic: request.topic,
            subtopic: request.subtopic,
            difficulty: request.difficulty,
          },
          context.rules
        );

        if (validation.isValid && validation.score >= 0.8) {
          questionValid = true;
        } else if (validation.shouldRegenerate && questionIterations < maxIterations) {
          console.log(`Question validation failed (score: ${validation.score}). Regenerating...`);
          // The question generator will use the validation feedback in its next iteration
          continue;
        } else {
          // Accept the question even if not perfect (after max iterations)
          console.warn(`Question validation score: ${validation.score}. Accepting after ${questionIterations} iterations.`);
          questionValid = true;
        }
      }

      if (!generatedQuestion!) {
        throw new Error('Failed to generate question');
      }

      // Step 4: Visual Generator Agent (if needed)
      let generatedVisual: GeneratedVisual | undefined;
      if (generatedQuestion.needsVisual && generatedQuestion.visualDescription) {
        console.log('Step 4: Generating visual...');
        let visualValid = false;
        let visualIterations = 0;

        while (!visualValid && visualIterations < maxIterations) {
          visualIterations++;
          iterations++;

          // Use enhanced execute method if visual examples are available
          if (context.visualExamples && context.visualExamples.length > 0) {
            generatedVisual = await (this.visualGeneratorAgent as any).executeWithVision?.({
              question: generatedQuestion.question,
              visualDescription: generatedQuestion.visualDescription!,
              context,
              requirements: {
                section: request.section,
                topic: request.topic,
                subtopic: request.subtopic,
              },
              maxIterations: 3,
            }) || await this.visualGeneratorAgent.execute({
              question: generatedQuestion.question,
              visualDescription: generatedQuestion.visualDescription!,
              context,
              requirements: {
                section: request.section,
                topic: request.topic,
                subtopic: request.subtopic,
              },
              maxIterations: 3,
            });
          } else {
          generatedVisual = await this.visualGeneratorAgent.execute({
            question: generatedQuestion.question,
            visualDescription: generatedQuestion.visualDescription!,
            context,
            requirements: {
              section: request.section,
              topic: request.topic,
              subtopic: request.subtopic,
            },
            maxIterations: 3,
          });
          }

          // Step 5: Visual Checking Agent - Validate visual
          console.log('Step 5: Validating visual...');
          const visualValidation = await this.visualCheckingAgent.execute(
            generatedVisual,
            generatedQuestion.question,
            {
              section: request.section,
              topic: request.topic,
              subtopic: request.subtopic,
            }
          );

          if (visualValidation.isValid && visualValidation.score >= 0.8) {
            visualValid = true;
          } else if (visualValidation.shouldRegenerate && visualIterations < maxIterations) {
            console.log(`Visual validation failed (score: ${visualValidation.score}). Regenerating...`);
            continue;
          } else {
            console.warn(`Visual validation score: ${visualValidation.score}. Accepting after ${visualIterations} iterations.`);
            visualValid = true;
          }
        }
      }

      const generationTime = Date.now() - startTime;

      return {
        question: generatedQuestion,
        visual: generatedVisual,
        metadata: {
          section: request.section,
          topic: request.topic,
          subtopic: request.subtopic,
          difficulty: request.difficulty,
          generationTime,
          iterations,
        },
      };
    } catch (error) {
      console.error('Error in question orchestration:', error);
      throw error;
    }
  }
}

