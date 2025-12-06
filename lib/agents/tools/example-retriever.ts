import { retrieveExamples } from '@/lib/rag/retriever';
import path from 'path';
import fs from 'fs/promises';

/**
 * Tool for retrieving example questions from the samples folder
 */
export const exampleRetrieverTool = {
  name: 'retrieve_examples',
  description: 'Retrieve example questions from the samples folder based on section, topic, and difficulty. Use this to get reference questions for generating new ones.',
  parameters: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        enum: ['math', 'reading-and-writing'],
        description: 'The section (math or reading-and-writing)',
      },
      topic: {
        type: 'string',
        description: 'The topic (e.g., "algebra", "information-and-ideas")',
      },
      difficulty: {
        type: 'string',
        enum: ['easy', 'medium', 'hard'],
        description: 'The difficulty level',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of examples to retrieve (default: 3)',
        default: 3,
      },
    },
    required: ['section', 'topic', 'difficulty'],
  },
  execute: async (args: {
    section: string;
    topic: string;
    difficulty: string;
    limit?: number;
  }) => {
    try {
      const examples = await retrieveExamples(
        args.section,
        args.topic,
        args.difficulty,
        args.limit || 3
      );
      
      return {
        success: true,
        examples,
        count: examples.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        examples: [],
      };
    }
  },
};

/**
 * Tool for listing available topics and difficulties
 */
export const listTopicsTool = {
  name: 'list_topics',
  description: 'List all available topics and difficulties in the samples folder for a given section.',
  parameters: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        enum: ['math', 'reading-and-writing'],
        description: 'The section to list topics for',
      },
    },
    required: ['section'],
  },
  execute: async (args: { section: string }) => {
    try {
      const samplesPath = path.join(process.cwd(), 'data', 'samples', args.section);
      const topics: string[] = [];
      
      const entries = await fs.readdir(samplesPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          topics.push(entry.name);
        }
      }
      
      return {
        success: true,
        section: args.section,
        topics,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        topics: [],
      };
    }
  },
};

