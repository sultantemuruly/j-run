import { BaseAgent } from './base-agent';
import { retrieveContext, RetrievedContext } from '@/lib/rag/retriever';

/**
 * Retriever Agent - Retrieves relevant context and examples from RAG system
 */
export class RetrieverAgent extends BaseAgent {
  constructor() {
    super('gpt-4o-mini');
  }

  async execute(
    query: string,
    options: {
      section?: string;
      topic?: string;
      subtopic?: string;
      difficulty?: string;
      maxExamples?: number;
    } = {}
  ): Promise<RetrievedContext> {
    // Use the RAG retriever to get context
    const context = await retrieveContext(query, options);

    // Enhance with additional examples if needed
    if (context.examples.length < (options.maxExamples || 3) && options.section && options.topic && options.difficulty) {
      const additionalExamples = await this.callTool('retrieve_examples', {
        section: options.section,
        topic: options.topic,
        difficulty: options.difficulty,
        limit: (options.maxExamples || 3) - context.examples.length,
      });

      if (additionalExamples.success && additionalExamples.examples) {
        context.examples.push(...additionalExamples.examples);
      }
    }

    return context;
  }
}

