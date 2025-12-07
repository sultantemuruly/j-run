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

CRITICAL VALIDATION CHECKS:
1. COMPLETENESS CHECK:
   - Extract ALL numerical values, angles, measurements, and relationships mentioned in the question
   - Verify that the visual description includes ALL of these elements
   - For geometry problems: Check that all angles (especially 90°, 60°, 30°, etc.) are mentioned
   - For algebra problems: Check that all equations, variables, and constraints are represented
   - If any critical information is missing, this is a CRITICAL FAILURE

2. NO DUPLICATE DESCRIPTIONS:
   - Check if the visual description repeats the same information multiple times
   - The description should be concise and not redundant
   - If duplicates found, flag this issue

3. CLARITY AND READABILITY:
   - Visual should be large enough to read clearly (minimum 400x400px for diagrams)
   - All labels should be clearly spaced (no overlapping text)
   - Numbers and labels should be readable
   - For SVG: Ensure proper spacing between elements, use font-size of at least 14px

4. QUESTION SOLVABILITY:
   - Verify that the visual contains ALL information needed to solve the question
   - If the question mentions specific angles, measurements, or relationships, they MUST be in the visual
   - If solving requires information not in the visual, this is a CRITICAL FAILURE

5. ACCURACY:
   - All measurements, angles, and labels must match what's stated in the question
   - No contradictions between question and visual

6. APPROPRIATE COMPLEXITY:
   - Should match SAT level standards
   - Not too simple, not overly complex

Respond in JSON format:
{
  "isValid": boolean,
  "issues": ["list of issues if any"],
  "corrections": "specific instructions for corrections if needed",
  "score": 0.0-1.0,
  "missingInformation": ["list of critical information missing from visual"],
  "hasDuplicates": boolean
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
      
      // Add missing information to issues if present
      const issues = result.issues || [];
      if (result.missingInformation && result.missingInformation.length > 0) {
        issues.push(`CRITICAL: Missing information: ${result.missingInformation.join(', ')}`);
      }
      if (result.hasDuplicates) {
        issues.push('Visual description contains duplicate/redundant information');
      }
      
      // Lower score if critical information is missing
      let score = result.score || 0;
      if (result.missingInformation && result.missingInformation.length > 0) {
        score = Math.min(score, 0.4); // Cap at 0.4 if critical info missing
      }
      if (result.hasDuplicates) {
        score = Math.min(score, 0.6); // Cap at 0.6 if duplicates
      }
      
      return {
        isValid: result.isValid !== false && (!result.missingInformation || result.missingInformation.length === 0) && !result.hasDuplicates,
        issues,
        corrections: result.corrections,
        score,
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

