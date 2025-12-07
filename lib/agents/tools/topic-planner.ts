/**
 * Topic Planner Tool - Plans question structure to ensure topic alignment
 * This is a critical tool to prevent topic mismatches
 */

import { classifyTopic } from '@/lib/utils/topic-classifier';

export interface TopicPlan {
  questionType: string;
  requiredKeywords: string[];
  questionPhrase: string;
  passageRequirements: string;
  answerChoiceStyle: string;
  topicAlignment: string;
}

export const topicPlannerTool = {
  name: 'plan_topic_aligned_question',
  description: 'Plan a question structure that will be correctly classified for the requested topic and subtopic. This ensures the question matches the topic before generation.',
  parameters: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        enum: ['math', 'reading-writing', 'reading-and-writing'],
        description: 'The section (math or reading-writing)',
      },
      topic: {
        type: 'string',
        description: 'The topic (e.g., "standard-english-conventions", "expression-of-ideas")',
      },
      subtopic: {
        type: 'string',
        description: 'The subtopic (e.g., "Punctuation", "Rhetorical Synthesis")',
      },
      difficulty: {
        type: 'string',
        enum: ['easy', 'medium', 'hard'],
        description: 'The difficulty level',
      },
    },
    required: ['section', 'topic', 'subtopic', 'difficulty'],
  },
  execute: async (args: {
    section: string;
    topic: string;
    subtopic: string;
    difficulty: string;
  }): Promise<{ success: boolean; plan: TopicPlan; error?: string }> => {
    try {
      // Generate topic-specific plan based on topic and subtopic
      const plan = generateTopicPlan(args.topic, args.subtopic, args.difficulty);
      
      return {
        success: true,
        plan,
      };
    } catch (error) {
      return {
        success: false,
        plan: {} as TopicPlan,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

function generateTopicPlan(topic: string, subtopic: string, difficulty: string): TopicPlan {
  const topicLower = topic.toLowerCase();
  const subtopicLower = subtopic.toLowerCase();

  // Standard English Conventions
  if (topicLower.includes('standard-english') || topicLower.includes('conventions')) {
    if (subtopicLower.includes('punctuation')) {
      return {
        questionType: 'Punctuation',
        requiredKeywords: ['punctuation', 'comma', 'semicolon', 'apostrophe', 'colon', 'correctly uses punctuation', 'punctuation mark'],
        questionPhrase: 'Which choice correctly uses punctuation',
        passageRequirements: 'Passage must contain a sentence with punctuation issues or ask about proper punctuation usage',
        answerChoiceStyle: 'Answer choices should demonstrate correct vs. incorrect punctuation usage (commas, semicolons, apostrophes, colons, etc.)',
        topicAlignment: 'This question MUST be about punctuation marks, NOT grammar rules, sentence structure, or word meanings',
      };
    } else if (subtopicLower.includes('sentence boundaries') || subtopicLower.includes('boundaries')) {
      return {
        questionType: 'Sentence Boundaries',
        requiredKeywords: ['sentence', 'fragment', 'run-on', 'complete sentence', 'completes the sentence', 'fix the sentence'],
        questionPhrase: 'Which choice completes the sentence',
        passageRequirements: 'Passage must contain an incomplete sentence, fragment, or run-on sentence',
        answerChoiceStyle: 'Answer choices should include options that complete, fix, or properly punctuate the sentence',
        topicAlignment: 'This question MUST be about sentence completeness and structure, NOT grammar rules or punctuation marks',
      };
    } else if (subtopicLower.includes('form') || subtopicLower.includes('structure') || subtopicLower.includes('sense')) {
      return {
        questionType: 'Form, Structure, and Sense',
        requiredKeywords: ['grammar', 'grammatical', 'subject-verb', 'verb tense', 'parallel structure', 'pronoun', 'grammatically correct', 'most effectively completes'],
        questionPhrase: 'Which choice most effectively completes the sentence',
        passageRequirements: 'Passage must contain a grammatical error (subject-verb agreement, verb tense, parallel structure, pronoun agreement, etc.)',
        answerChoiceStyle: 'Answer choices should demonstrate correct vs. incorrect grammar usage',
        topicAlignment: 'This question MUST be about GRAMMAR and making sentences grammatically correct, NOT about style, rhetoric, word choice, or transitions',
      };
    }
  }

  // Expression of Ideas
  if (topicLower.includes('expression') || topicLower.includes('ideas')) {
    if (subtopicLower.includes('rhetorical') || subtopicLower.includes('synthesis')) {
      return {
        questionType: 'Rhetorical Synthesis',
        requiredKeywords: ['best combines', 'most effectively combines', 'synthesizes', 'synthesizing', 'integrates', 'combines the information'],
        questionPhrase: 'Which choice best combines the information',
        passageRequirements: 'Passage must have information that can be COMBINED or SYNTHESIZED from multiple sentences/parts',
        answerChoiceStyle: 'Answer choices should be different ways of COMBINING the same information, NOT summaries of different information',
        topicAlignment: 'CRITICAL: This is about COMBINING/SYNTHESIZING information, NOT summarizing. DO NOT use "summarizes", "describes", "indicates" - use "combines", "synthesizes", "integrates"',
      };
    } else if (subtopicLower.includes('transition')) {
      return {
        questionType: 'Transitions',
        requiredKeywords: ['transition', 'however', 'therefore', 'furthermore', 'most appropriate transition', 'best connects'],
        questionPhrase: 'Which choice provides the most appropriate transition',
        passageRequirements: 'Passage must have a place where a transition word/phrase is needed to connect ideas',
        answerChoiceStyle: 'Answer choices should be transition words/phrases (however, therefore, furthermore, moreover, etc.)',
        topicAlignment: 'This question MUST be about TRANSITION WORDS/PHRASES connecting ideas, NOT about combining information or summarizing',
      };
    }
  }

  // Information and Ideas
  if (topicLower.includes('information') || topicLower.includes('ideas')) {
    if (subtopicLower.includes('evidence') && subtopicLower.includes('textual')) {
      return {
        questionType: 'Command of Evidence (Textual)',
        requiredKeywords: ['quotation', 'statement from the passage', 'text from the passage', 'best supports', 'most clearly supports'],
        questionPhrase: 'Which quotation from the passage best supports',
        passageRequirements: 'Passage must contain text that can be quoted to support a claim',
        answerChoiceStyle: 'Answer choices should be direct quotes or references to specific text from the passage',
        topicAlignment: 'This question MUST ask about TEXT/QUOTATIONS, NOT data/statistics or word meanings',
      };
    } else if (subtopicLower.includes('evidence') && subtopicLower.includes('quantitative')) {
      return {
        questionType: 'Command of Evidence (Quantitative)',
        requiredKeywords: ['data', 'statistic', 'chart', 'graph', 'table', 'numerical', 'percentage', 'according to the data'],
        questionPhrase: 'Which data from the passage best supports',
        passageRequirements: 'Passage MUST include quantitative information (numbers, statistics, data, charts, graphs)',
        answerChoiceStyle: 'Answer choices should reference specific data points, statistics, or visual elements',
        topicAlignment: 'This question MUST ask about QUANTITATIVE evidence (data/statistics), NOT text quotes or word meanings',
      };
    }
  }

  // Craft and Structure
  if (topicLower.includes('craft') || topicLower.includes('structure')) {
    if (subtopicLower.includes('cross-text') || subtopicLower.includes('connections')) {
      return {
        questionType: 'Cross-Text Connections',
        requiredKeywords: ['passage 1', 'passage 2', 'both passages', 'relate', 'relationship', 'differ', 'compare', 'contrast', 'between the passages'],
        questionPhrase: 'How do the two passages relate to each other',
        passageRequirements: 'MUST have EXACTLY TWO passages, clearly labeled "Passage 1:" and "Passage 2:" with clear separation',
        answerChoiceStyle: 'Answer choices MUST reference the relationship between passages, not just one passage',
        topicAlignment: 'CRITICAL: This is about the CONNECTION between two passages, NOT about finding information in one passage. The question MUST reference BOTH passages explicitly',
      };
    }
  }

  // Default fallback
  return {
    questionType: subtopic,
    requiredKeywords: [],
    questionPhrase: 'Which choice',
    passageRequirements: 'Passage should be appropriate for the topic and subtopic',
    answerChoiceStyle: 'Answer choices should be clear and appropriate',
    topicAlignment: `This question MUST clearly belong to "${topic}" > "${subtopic}"`,
  };
}

