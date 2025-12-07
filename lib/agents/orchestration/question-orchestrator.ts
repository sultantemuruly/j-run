import { RetrieverAgent } from '../agents/retriever-agent';
import { QuestionGeneratorAgent, GeneratedQuestion } from '../agents/question-generator-agent';
import { VisualGeneratorAgent, GeneratedVisual } from '../agents/visual-generator-agent';
import { CheckingAgent } from '../agents/checking-agent';
import { VisualCheckingAgent } from '../agents/visual-checking-agent';
import { ValidationResult } from '../tools/question-validator';
import { folderToDisplayName, classifyQuestionTopic } from '@/lib/utils/topic-classifier';

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
    const maxIterations = 3; // OPTIMIZATION: Reduced from 5 to 3 to save costs

    try {
      // Step 1: Retriever Agent - Get context and examples
      console.log('Step 1: Retrieving context...');
      let context;
      try {
        context = await this.retrieverAgent.execute(
          request.customContext || `Generate a ${request.difficulty} ${request.section} question about ${request.topic}${request.subtopic ? `, specifically ${request.subtopic}` : ''}`,
          {
            section: request.section,
            topic: request.topic,
            subtopic: request.subtopic,
            difficulty: request.difficulty,
            maxExamples: 5,
          }
        );
      } catch (error: any) {
        // If RAG retrieval fails (e.g., quota exceeded), continue with minimal context
        if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
          console.warn('RAG system unavailable due to API quota. Continuing with minimal context.');
          context = {
            rules: 'Follow standard SAT question format and difficulty guidelines.',
            explanations: 'Ensure questions test the specified skills appropriately.',
            instructions: `Generate a ${request.difficulty} ${request.section} question about ${request.topic}${request.subtopic ? `, specifically ${request.subtopic}` : ''}. Follow SAT format and standards.`,
            examples: [],
            sourceChunks: [],
            visualExamples: [],
          };
        } else {
          throw error;
        }
      }

      // Step 2: Question Generator Agent - Generate question
      console.log('Step 2: Generating question...');
      let generatedQuestion: GeneratedQuestion;
      let questionValid = false;
      let questionIterations = 0;
      let lastValidation: ValidationResult | null = null;
      let topicMismatchCount = 0; // Track consecutive topic mismatches

      while (!questionValid && questionIterations < maxIterations) {
        questionIterations++;
        iterations++;

        // If we've had multiple topic mismatches, enhance the validation feedback
        let enhancedValidation = lastValidation;
        if (lastValidation && topicMismatchCount > 0) {
          // Add extra emphasis on topic requirements
          const topicMismatchIssues = lastValidation.issues.filter(issue => 
            typeof issue === 'string' && issue.includes('TOPIC MISMATCH')
          );
          if (topicMismatchIssues.length > 0) {
            enhancedValidation = {
              ...lastValidation,
              corrections: `${lastValidation.corrections || ''}\n\n⚠️ REPEATED TOPIC MISMATCH DETECTED (attempt ${questionIterations}). You MUST generate a question that matches the requested topic "${request.topic}"${request.subtopic ? `, subtopic "${request.subtopic}"` : ''}. Review the topic requirements carefully and ensure your question clearly belongs to this topic category.`,
            };
          }
        }

        // Pass the last validation feedback to the generator so it can improve
        generatedQuestion = await this.questionGeneratorAgent.execute({
          section: request.section,
          topic: request.topic,
          subtopic: request.subtopic,
          difficulty: request.difficulty,
          context,
          maxIterations: 2, // Reduced since orchestrator handles the loop
          externalValidation: enhancedValidation, // Pass feedback from previous iteration
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

        // Track topic mismatches
        const hasTopicMismatch = validation.issues.some(issue => 
          typeof issue === 'string' && issue.includes('TOPIC MISMATCH')
        );
        if (hasTopicMismatch) {
          topicMismatchCount++;
          
          // If we have multiple topic mismatches, enhance the validation feedback with stronger guidance
          if (topicMismatchCount >= 2) {
            const topicMismatchIssues = validation.issues.filter(issue => 
              typeof issue === 'string' && issue.includes('TOPIC MISMATCH')
            );
            
            // Extract what topic it's being classified as
            const actualTopicMatch = validation.issues.find(issue => 
              typeof issue === 'string' && issue.includes('Actual:')
            );
            
            // Add very explicit guidance
            validation.corrections = `${validation.corrections || ''}\n\n🚨 CRITICAL TOPIC MISMATCH (Attempt ${questionIterations}):\nThe question is being classified as a DIFFERENT topic than requested.\n\n${actualTopicMatch || 'The question does not match the requested topic.'}\n\nYou MUST completely change your approach:\n1. STOP using words/phrases that match "${validation.issues.find((i: any) => typeof i === 'string' && i.includes('Actual:'))?.split('Actual:')[1]?.trim() || 'the wrong topic'}"\n2. START using words/phrases that clearly match "${request.topic}${request.subtopic ? ` > ${request.subtopic}` : ''}"\n3. Review the topic-specific requirements carefully\n4. Generate a COMPLETELY DIFFERENT question that clearly belongs to the requested topic\n\nThis is attempt ${questionIterations}. You MUST fix the topic mismatch NOW.`;
          }
        } else {
          topicMismatchCount = 0; // Reset if topic matches
        }

        // If validator found the correct answer was wrong, fix it
        if (validation.correctedAnswer && validation.correctedAnswer !== generatedQuestion.correctAnswer) {
          console.log(`Correcting answer from ${generatedQuestion.correctAnswer} to ${validation.correctedAnswer}`);
          generatedQuestion.correctAnswer = validation.correctedAnswer as 'A' | 'B' | 'C' | 'D';
          // Re-validate with corrected answer
          const revalidation = await this.checkingAgent.execute(
            generatedQuestion,
            {
              section: request.section,
              topic: request.topic,
              subtopic: request.subtopic,
              difficulty: request.difficulty,
            },
            context.rules
          );
          lastValidation = revalidation;
        } else {
          lastValidation = validation;
        }

        // Stricter validation: must be valid, correct answer, AND score >= 0.8
        const isHighQuality = lastValidation.isValid && lastValidation.score >= 0.8;
        
        if (isHighQuality) {
          console.log(`✅ Question passed validation with score: ${lastValidation.score}`);
          questionValid = true;
        } else if (questionIterations < maxIterations) {
          console.log(`❌ Question validation failed (score: ${lastValidation.score}, valid: ${lastValidation.isValid})`);
          console.log(`Issues found: ${lastValidation.issues.length}`);
          lastValidation.issues.forEach((issue, i) => {
            console.log(`  ${i + 1}. ${issue}`);
          });
          console.log(`\nCorrections needed:\n${lastValidation.corrections || 'Please address the issues above'}\n`);
          console.log(`🔄 Regenerating with feedback (attempt ${questionIterations + 1}/${maxIterations})...`);
          // Continue loop - validation feedback will be passed to generator in next iteration
          continue;
        } else {
          // After max iterations, only accept if score is at least 0.7
          if (lastValidation.score >= 0.7) {
            console.warn(`⚠️ Question validation score: ${lastValidation.score} (below 0.8 target). Accepting after ${questionIterations} iterations.`);
            questionValid = true;
          } else {
            console.error(`❌ Question validation score too low: ${lastValidation.score}. Rejecting after ${questionIterations} iterations.`);
            // Stringify issues properly to avoid [object Object]
            const issuesString = lastValidation.issues
              .map(issue => typeof issue === 'string' ? issue : JSON.stringify(issue))
              .join('; ');
            throw new Error(`Failed to generate valid question after ${maxIterations} iterations. Final score: ${lastValidation.score}, Issues: ${issuesString}`);
          }
        }
      }

      if (!generatedQuestion!) {
        throw new Error('Failed to generate question');
      }

      // Step 4: Visual Generator Agent (if needed)
      let generatedVisual: GeneratedVisual | undefined;
      if (generatedQuestion.needsVisual && generatedQuestion.visualDescription) {
        console.log('Step 4: Generating visual...');
        
        // Pre-validate visual description to ensure it contains all necessary information
        const visualDescCheck = await this.validateVisualDescription(
          generatedQuestion.visualDescription,
          generatedQuestion.question
        );
        
        if (!visualDescCheck.isComplete) {
          console.warn('Visual description missing critical information:', visualDescCheck.missingInfo);
          // Try to enhance the visual description
          generatedQuestion.visualDescription = await this.enhanceVisualDescription(
            generatedQuestion.visualDescription,
            generatedQuestion.question
          );
        }
        
        let visualValid = false;
        let visualIterations = 0;

        while (!visualValid && visualIterations < maxIterations) {
          visualIterations++;
          iterations++;

          // Generate visual (executeWithVision will use enhanced method if available, otherwise falls back to execute)
          try {
            if (context.visualExamples && context.visualExamples.length > 0) {
              // Try enhanced method first if available
              const enhancedMethod = (this.visualGeneratorAgent as any).executeWithVision;
              if (enhancedMethod && typeof enhancedMethod === 'function') {
                generatedVisual = await enhancedMethod({
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
                // Fallback to regular execute
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
          } catch (error) {
            console.error('Error generating visual:', error);
            // If visual generation fails, mark as needing regeneration but continue
            generatedVisual = {
              type: 'graph',
              description: generatedQuestion.visualDescription || 'Visual generation failed',
              needsRegeneration: true,
            };
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

          // Stricter validation: must be valid AND score >= 0.8
          const isHighQuality = visualValidation.isValid && visualValidation.score >= 0.8;
          
          if (isHighQuality) {
            console.log(`✅ Visual passed validation with score: ${visualValidation.score}`);
            visualValid = true;
          } else if (visualIterations < maxIterations) {
            console.log(`❌ Visual validation failed (score: ${visualValidation.score}, valid: ${visualValidation.isValid})`);
            console.log(`Issues found: ${visualValidation.issues.length}`);
            visualValidation.issues.forEach((issue, i) => {
              console.log(`  ${i + 1}. ${issue}`);
            });
            console.log(`\nCorrections needed:\n${visualValidation.corrections || 'Please address the issues above'}\n`);
            console.log(`🔄 Regenerating visual with feedback (attempt ${visualIterations + 1}/${maxIterations})...`);
            continue;
          } else {
            // After max iterations, only accept if score is at least 0.7
            if (visualValidation.score >= 0.7) {
              console.warn(`⚠️ Visual validation score: ${visualValidation.score} (below 0.8 target). Accepting after ${visualIterations} iterations.`);
              visualValid = true;
            } else {
              console.error(`❌ Visual validation score too low: ${visualValidation.score}. Marking as needing regeneration.`);
              if (generatedVisual) {
                generatedVisual.needsRegeneration = true;
              }
              visualValid = true; // Accept but mark for regeneration
            }
          }
        }
      }

      const generationTime = Date.now() - startTime;

      // Map folder names to display names for metadata
      const displayTopic = folderToDisplayName(request.topic);
      
      // Use the actual subtopic from request (already in display format)
      // If subtopic was provided, use it; otherwise try to extract from question
      let displaySubtopic = request.subtopic;
      if (!displaySubtopic && generatedQuestion.question) {
        const classification = classifyQuestionTopic(generatedQuestion.question, generatedQuestion.passage);
        displaySubtopic = classification.subtopic;
      }

      return {
        question: generatedQuestion,
        visual: generatedVisual,
        metadata: {
          section: request.section === 'reading-and-writing' ? 'reading-writing' : request.section,
          topic: displayTopic, // Use display name, not folder name
          subtopic: displaySubtopic, // Use actual subtopic
          difficulty: request.difficulty.charAt(0).toUpperCase() + request.difficulty.slice(1), // Capitalize
          generationTime,
          iterations,
        },
      };
    } catch (error) {
      console.error('Error in question orchestration:', error);
      throw error;
    }
  }

  /**
   * Validate that visual description contains all necessary information from the question
   */
  private async validateVisualDescription(
    visualDescription: string,
    question: string
  ): Promise<{ isComplete: boolean; missingInfo: string[] }> {
    const missingInfo: string[] = [];
    
    // Extract critical information from question
    const angleMatches = question.match(/\d+\s*(?:degrees?|°)/gi);
    const angles = angleMatches || [];
    
    // Check if all angles are mentioned in visual description
    for (const angle of angles) {
      if (!visualDescription.toLowerCase().includes(angle.toLowerCase())) {
        missingInfo.push(`Angle ${angle} not mentioned in visual description`);
      }
    }
    
    // Check for common geometry relationships
    if (question.match(/triangle|right|90|perpendicular/gi) && !visualDescription.match(/90|right|perpendicular/gi)) {
      missingInfo.push('Right angle (90°) not mentioned - critical for triangle problems');
    }
    
    // Check for measurements
    const measurementPatterns = ['x', '2x', '3x', 'length', 'width', 'height', 'side'];
    const hasMeasurements = measurementPatterns.some(pattern => 
      question.toLowerCase().includes(pattern) && !visualDescription.toLowerCase().includes(pattern)
    );
    
    if (hasMeasurements) {
      missingInfo.push('Some measurements from question not included in visual description');
    }
    
    return {
      isComplete: missingInfo.length === 0,
      missingInfo,
    };
  }

  /**
   * Enhance visual description with missing critical information
   */
  private async enhanceVisualDescription(
    visualDescription: string,
    question: string
  ): Promise<string> {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `The following visual description is missing some critical information from the question. Enhance it to include ALL necessary information.

Question: ${question}

Current Visual Description: ${visualDescription}

Extract ALL angles, measurements, relationships, and constraints from the question and ensure they are ALL included in the enhanced description.

Enhanced visual description should:
1. Include ALL angles mentioned (especially 90°, 60°, 30°, etc.)
2. Include ALL measurements and variables (x, 2x, etc.)
3. Include ALL relationships (twice as long, half of, etc.)
4. Be concise and NOT duplicate the question text
5. Only describe what the visual SHOWS, not what the question asks

Respond with ONLY the enhanced visual description, nothing else.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating visual descriptions for educational content. Always include all necessary information.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      return response.choices[0].message.content?.trim() || visualDescription;
    } catch (error) {
      console.error('Error enhancing visual description:', error);
      return visualDescription; // Return original if enhancement fails
    }
  }
}

