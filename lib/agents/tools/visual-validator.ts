import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface VisualValidationResult {
  isValid: boolean;
  issues: string[];
  corrections?: string;
  score: number;
}

/**
 * Tool for validating generated visual content
 */
export const visualValidatorTool = {
  name: 'validate_visual',
  description: 'Validate generated visual content (graphs, tables, diagrams) to ensure it aligns with the question context and SAT standards.',
  parameters: {
    type: 'object',
    properties: {
      visualDescription: {
        type: 'string',
        description: 'Description of the generated visual content',
      },
      questionContext: {
        type: 'string',
        description: 'The question this visual is for',
      },
      visualType: {
        type: 'string',
        enum: ['graph', 'table', 'diagram', 'chart', 'image'],
        description: 'Type of visual content',
      },
      requirements: {
        type: 'object',
        properties: {
          section: { type: 'string' },
          topic: { type: 'string' },
          subtopic: { type: 'string' },
        },
        description: 'Requirements for the visual',
      },
    },
    required: ['visualDescription', 'questionContext', 'visualType', 'requirements'],
  },
  execute: async (args: {
    visualDescription: string;
    questionContext: string;
    visualType: string;
    requirements: {
      section?: string;
      topic?: string;
      subtopic?: string;
    };
  }): Promise<VisualValidationResult> => {
    try {
      const validationPrompt = `You are an expert SAT visual content validator. Validate the following visual:

Visual Type: ${args.visualType}
Visual Description: ${args.visualDescription}

Question Context: ${args.questionContext}

Requirements:
- Section: ${args.requirements.section || 'N/A'}
- Topic: ${args.requirements.topic || 'N/A'}
- Subtopic: ${args.requirements.subtopic || 'N/A'}

Evaluate this visual on:
1. Relevance to the question
2. Clarity and readability
3. Appropriate complexity for SAT level
4. Accuracy of data/representation
5. Alignment with SAT visual standards

Respond in JSON format:
{
  "isValid": boolean,
  "issues": ["list of issues if any"],
  "corrections": "specific instructions for corrections if needed",
  "score": 0.0-1.0
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert SAT visual content validator. Always respond with valid JSON.',
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
      
      return {
        isValid: result.isValid || false,
        issues: result.issues || [],
        corrections: result.corrections,
        score: result.score || 0,
      };
    } catch (error) {
      console.error('Error validating visual:', error);
      return {
        isValid: false,
        issues: ['Validation error occurred'],
        score: 0,
      };
    }
  },
};

