/**
 * Topic and Subtopic Classification System
 * Ensures generated questions match the requested topic/subtopic
 */

export interface TopicMapping {
  displayName: string;
  folderName: string;
  subtopics: string[];
}

// Complete topic and subtopic mappings
export const TOPIC_MAPPINGS: Record<string, TopicMapping> = {
  // Math topics
  'algebra': {
    displayName: 'Algebra',
    folderName: 'algebra',
    subtopics: [
      'Linear equations in 1 variable',
      'Linear equations in 2 variables',
      'Linear functions',
      'Systems of 2 linear equations in 2 variables',
      'Linear inequalities in 1 or 2 variables',
    ],
  },
  'advanced-math': {
    displayName: 'Advanced Math',
    folderName: 'advanced-math',
    subtopics: [
      'Equivalent expressions',
      'Nonlinear equations in 1 variable',
      'Systems of equations in 2 variables',
      'Nonlinear functions',
    ],
  },
  'problem-solving-and-data-analysis': {
    displayName: 'Problem-Solving and Data Analysis',
    folderName: 'problem-solving-and-data-analysis',
    subtopics: [
      'Ratios, rates, proportional relationships, and units',
      'Percentages',
      'One-variable data: distributions and measures of center and spread',
      'Two-variable data: models and scatterplots',
      'Probability and conditional probability',
      'Inference from sample statistics and margin of error',
      'Evaluating statistical claims: observational studies and experiments',
    ],
  },
  'geometry-and-trigonometry': {
    displayName: 'Geometry and Trigonometry',
    folderName: 'geometry-and-trigonometry',
    subtopics: [
      'Area and volume formulas',
      'Lines, angles, and triangles',
      'Right triangles and trigonometry',
      'Circles',
    ],
  },
  // Reading & Writing topics
  'information-and-ideas': {
    displayName: 'Information and Ideas',
    folderName: 'information-and-ideas',
    subtopics: [
      'Central Ideas and Details',
      'Inferences',
      'Command of Evidence (Textual)',
      'Command of Evidence (Quantitative)',
    ],
  },
  'craft-and-structure': {
    displayName: 'Craft and Structure',
    folderName: 'craft-and-structure',
    subtopics: [
      'Words in Context',
      'Text Structure and Purpose',
      'Cross-Text Connections',
    ],
  },
  'expression-of-ideas': {
    displayName: 'Expression of Ideas',
    folderName: 'expression-of-ideas',
    subtopics: [
      'Rhetorical Synthesis',
      'Transitions',
    ],
  },
  'standard-english-conventions': {
    displayName: 'Standard English Conventions',
    folderName: 'standard-english-conventions',
    subtopics: [
      'Sentence Boundaries',
      'Form, Structure, and Sense',
      'Punctuation',
    ],
  },
};

/**
 * Map folder name to display name
 */
export function folderToDisplayName(folderName: string): string {
  const normalized = folderName.toLowerCase().replace(/\s+/g, '-');
  return TOPIC_MAPPINGS[normalized]?.displayName || folderName;
}

/**
 * Map display name to folder name
 */
export function displayToFolderName(displayName: string): string {
  for (const [key, mapping] of Object.entries(TOPIC_MAPPINGS)) {
    if (mapping.displayName === displayName) {
      return mapping.folderName;
    }
  }
  // Fallback: convert to folder format
  return displayName.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Get subtopics for a topic (by folder name or display name)
 */
export function getSubtopicsForTopic(topic: string): string[] {
  const normalized = topic.toLowerCase().replace(/\s+/g, '-');
  const mapping = TOPIC_MAPPINGS[normalized];
  if (mapping) {
    return mapping.subtopics;
  }
  
  // Try by display name
  for (const mapping of Object.values(TOPIC_MAPPINGS)) {
    if (mapping.displayName === topic) {
      return mapping.subtopics;
    }
  }
  
  return [];
}

/**
 * Classify which topic a question belongs to based on content
 * @param question - The question text
 * @param passage - Optional passage text (if present, likely Reading & Writing)
 * @param sectionHint - Optional hint about the section (e.g., 'reading-writing', 'math')
 */
export function classifyQuestionTopic(
  question: string,
  passage?: string,
  sectionHint?: string
): { topic: string; subtopic?: string; confidence: number } {
  const fullText = `${passage || ''} ${question}`.toLowerCase();
  
  // If passage exists, prioritize Reading & Writing topics
  const hasPassage = !!passage && passage.trim().length > 0;
  const isLikelyReadingWriting = hasPassage || sectionHint === 'reading-writing' || sectionHint === 'reading-and-writing';
  const isLikelyMath = !hasPassage && (sectionHint === 'math' || question.match(/\$|\\frac|equation|solve|calculate|graph|slope|angle|triangle|circle|area|volume/));
  
  // Math topic classification keywords (only check if likely math)
  const mathTopics: Record<string, { keywords: string[]; subtopics: Record<string, string[]> }> = {
    'algebra': {
      keywords: ['slope', 'linear equation', 'linear function', 'system of equations', 'inequality', 'y = mx + b', 'coordinate', 'graph of line', 'x-intercept', 'y-intercept'],
      subtopics: {
        'Linear equations in 1 variable': ['solve for x', 'linear equation', 'one variable'],
        'Linear equations in 2 variables': ['two variables', 'x and y', 'coordinate'],
        'Linear functions': ['linear function', 'f(x)', 'function'],
        'Systems of 2 linear equations in 2 variables': ['system', 'two equations', 'two variables'],
        'Linear inequalities in 1 or 2 variables': ['inequality', 'greater than', 'less than', '<', '>'],
      },
    },
    'geometry-and-trigonometry': {
      keywords: ['triangle', 'angle', 'circle', 'area', 'volume', 'perimeter', 'radius', 'diameter', 'sine', 'cosine', 'tangent', 'trigonometry', 'geometry', 'degrees', 'right triangle', 'pythagorean'],
      subtopics: {
        'Area and volume formulas': ['area', 'volume', 'surface area', 'formula'],
        'Lines, angles, and triangles': ['line', 'angle', 'triangle', 'parallel', 'perpendicular', 'degrees'],
        'Right triangles and trigonometry': ['right triangle', 'trigonometry', 'sine', 'cosine', 'tangent', 'pythagorean'],
        'Circles': ['circle', 'radius', 'diameter', 'circumference', 'arc'],
      },
    },
    'advanced-math': {
      keywords: ['quadratic', 'polynomial', 'exponential', 'logarithm', 'radical', 'rational', 'complex number', 'imaginary'],
      subtopics: {
        'Equivalent expressions': ['equivalent', 'simplify', 'expression'],
        'Nonlinear equations in 1 variable': ['quadratic', 'polynomial', 'nonlinear'],
        'Systems of equations in 2 variables': ['system', 'nonlinear'],
        'Nonlinear functions': ['quadratic function', 'exponential', 'logarithm'],
      },
    },
    'problem-solving-and-data-analysis': {
      // Make these more specific - avoid matching "data" in Reading & Writing passages
      keywords: ['ratio of', 'percentage of', 'percent increase', 'percent decrease', 'probability that', 'statistical', 'data set', 'data point', 'scatterplot', 'mean of', 'median of', 'mode of', 'standard deviation', 'sample size', 'margin of error'],
      subtopics: {
        'Ratios, rates, proportional relationships, and units': ['ratio', 'rate', 'proportional', 'unit'],
        'Percentages': ['percent', 'percentage'],
        'One-variable data: distributions and measures of center and spread': ['mean', 'median', 'mode', 'distribution', 'spread'],
        'Two-variable data: models and scatterplots': ['scatterplot', 'correlation', 'two variable'],
        'Probability and conditional probability': ['probability', 'chance', 'likely'],
        'Inference from sample statistics and margin of error': ['sample', 'inference', 'margin of error'],
        'Evaluating statistical claims: observational studies and experiments': ['study', 'experiment', 'claim'],
      },
    },
  };
  
  // Reading & Writing topic classification
  const readingWritingTopics: Record<string, { keywords: string[]; subtopics: Record<string, string[]> }> = {
    'information-and-ideas': {
      keywords: [
        'main idea', 'central idea', 'primary purpose', 'infer', 'imply', 'suggest', 'evidence', 'support',
        'summarize', 'summarizes', 'summarizing', 'best summarizes', 'most accurately summarizes',
        'describes', 'indicates', 'suggests that', 'implies that', 'concludes that',
        'according to the passage', 'the passage indicates', 'the passage suggests',
        'what does the passage', 'what is the main', 'what is the primary'
      ],
      subtopics: {
        'Central Ideas and Details': [
          'main idea', 'central idea', 'primary purpose', 'key point', 'primary point',
          'main point', 'central point', 'primary focus', 'main focus'
        ],
        'Inferences': [
          'infer', 'imply', 'suggest', 'likely', 'probably', 'can be inferred',
          'most likely', 'probably means', 'suggests that', 'implies that'
        ],
        'Command of Evidence (Textual)': [
          'quotation from the passage', 'quotation', 'statement from the passage', 'text from the passage',
          'which quote', 'which statement', 'which text', 'passage states', 'author states',
          'word', 'phrase', 'sentence', 'paragraph', 'best supports', 'most clearly supports'
        ],
        'Command of Evidence (Quantitative)': [
          'data from', 'statistic', 'statistics', 'chart', 'graph', 'table', 'data in',
          'which data', 'which statistic', 'numerical', 'percentage', 'percent', 'number',
          'measurement', 'measurements', 'figure', 'figures', 'according to the data',
          'according to the table', 'according to the graph', 'according to the chart'
        ],
      },
    },
    'craft-and-structure': {
      keywords: ['word in context', 'meaning', 'tone', 'purpose', 'structure', 'organization', 'compare', 'contrast'],
      subtopics: {
        'Words in Context': ['word', 'meaning', 'nearly means', 'most closely'],
        'Text Structure and Purpose': ['structure', 'organization', 'purpose', 'tone'],
        'Cross-Text Connections': [
          'passage 1', 'passage 2', 'both passages', 'compare', 'contrast', 
          'two passages', 'first passage', 'second passage', 'relate', 'relationship',
          'differ', 'similar', 'difference', 'similarity', 'agree', 'disagree',
          'perspective', 'viewpoint', 'approach', 'how do the passages', 'passages suggest',
          'passages differ', 'passages agree', 'passages disagree', 'between the passages'
        ],
      },
    },
    'expression-of-ideas': {
      keywords: [
        'transition', 'synthesis', 'combine', 'revise', 'improve', 'revising', 'revise the',
        'rhetorical synthesis', 'synthesize', 'synthesizing', 'best combines', 'most effectively combines',
        'which choice best', 'which choice most effectively', 'revise the underlined portion',
        'writer wants to revise', 'writer is considering', 'writer wants to', 'most effectively',
        'best completes', 'best introduces', 'best transitions', 'most logical', 'most appropriate'
      ],
      subtopics: {
        'Rhetorical Synthesis': [
          'synthesis', 'combine', 'integrate', 'synthesize', 'synthesizing',
          'best combines', 'most effectively combines', 'which choice best combines',
          'which choice most effectively combines', 'combines the information',
          'synthesizes the information', 'integrates the information',
          'writer wants to combine', 'writer wants to synthesize'
        ],
        'Transitions': [
          'transition', 'however', 'therefore', 'furthermore', 'moreover', 'nevertheless',
          'best transitions', 'most appropriate transition', 'which transition',
          'writer wants to add a transition', 'logical transition'
        ],
      },
    },
    'standard-english-conventions': {
      keywords: [
        'grammar', 'punctuation', 'sentence', 'comma', 'semicolon', 'apostrophe',
        'grammatical', 'grammatically', 'correct', 'incorrect', 'error', 'errors',
        'fix', 'revise', 'revising', 'edit', 'editing', 'choose the option',
        'which choice', 'no change', 'most effectively', 'best completes'
      ],
      subtopics: {
        'Sentence Boundaries': ['sentence', 'fragment', 'run-on', 'complete sentence', 'incomplete'],
        'Form, Structure, and Sense': [
          'grammar', 'form', 'structure', 'sense', 'grammatical', 'grammatically',
          'subject-verb', 'agreement', 'tense', 'parallel', 'pronoun', 'verb form',
          'makes sense', 'logical', 'clear meaning'
        ],
        'Punctuation': [
          'punctuation', 'comma', 'semicolon', 'apostrophe', 'colon', 'period',
          'quotation', 'parentheses', 'dash', 'hyphen'
        ],
      },
    },
  };
  
  // Check math topics ONLY if likely math (not Reading & Writing)
  let bestMatch: { topic: string; subtopic?: string; confidence: number } | null = null;
  
  // Only check math topics if we're confident it's a math question
  // Skip math classification entirely if passage exists (definitely Reading & Writing)
  if (!hasPassage && !isLikelyReadingWriting && (isLikelyMath || sectionHint === 'math')) {
    for (const [topic, data] of Object.entries(mathTopics)) {
      let matchCount = 0;
      let matchedSubtopic: string | undefined;
      let subtopicMatchCount = 0;
      
      // Check main keywords - require at least 2 matches for math topics
      for (const keyword of data.keywords) {
        if (fullText.includes(keyword)) {
          matchCount++;
        }
      }
      
      // Check subtopic keywords
      for (const [subtopic, keywords] of Object.entries(data.subtopics)) {
        let subtopicMatches = 0;
        for (const keyword of keywords) {
          if (fullText.includes(keyword)) {
            subtopicMatches++;
          }
        }
        if (subtopicMatches > subtopicMatchCount) {
          subtopicMatchCount = subtopicMatches;
          matchedSubtopic = subtopic;
        }
      }
      
      // Require multiple keyword matches for math (avoid false positives)
      const confidence = matchCount >= 2 ? matchCount / data.keywords.length : 0;
      if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = {
          topic: TOPIC_MAPPINGS[topic]?.displayName || topic,
          subtopic: matchedSubtopic,
          confidence,
        };
      }
    }
  }
  
  // Check reading & writing topics (prioritize if passage exists or section hint suggests R&W)
  // Always check R&W topics, but give higher weight if passage exists
  for (const [topic, data] of Object.entries(readingWritingTopics)) {
    let matchCount = 0;
    let matchedSubtopic: string | undefined;
    let subtopicMatchCount = 0;
    
    for (const keyword of data.keywords) {
      if (fullText.includes(keyword)) {
        matchCount++;
      }
    }
    
    for (const [subtopic, keywords] of Object.entries(data.subtopics)) {
      let subtopicMatches = 0;
      for (const keyword of keywords) {
        if (fullText.includes(keyword)) {
          subtopicMatches++;
        }
      }
      if (subtopicMatches > subtopicMatchCount) {
        subtopicMatchCount = subtopicMatches;
        matchedSubtopic = subtopic;
      }
    }
    
    // Boost confidence if passage exists (Reading & Writing questions have passages)
    let confidence = matchCount / data.keywords.length;
    if (hasPassage && confidence > 0) {
      confidence = Math.min(1.0, confidence * 1.5); // Boost by 50% if passage exists
    }
    
    // Special handling for Cross-Text Connections: boost confidence if multiple passages detected
    if (matchedSubtopic === 'Cross-Text Connections') {
      const hasTwoPassages = (fullText.match(/passage\s*1|passage\s*2|first passage|second passage/gi) || []).length >= 2;
      const hasRelationshipKeywords = fullText.match(/both passages|two passages|relate|relationship|differ|compare|contrast|between the passages/gi);
      if (hasTwoPassages || hasRelationshipKeywords) {
        confidence = Math.max(confidence, 0.7); // Minimum 0.7 if Cross-Text indicators present
        if (hasTwoPassages && hasRelationshipKeywords) {
          confidence = Math.min(1.0, confidence * 1.3); // Boost further if both present
        }
      }
    }
    
    // Special handling for Expression of Ideas vs Information and Ideas distinction
    if (topic === 'expression-of-ideas') {
      // Boost if has synthesis/combine keywords
      const hasSynthesisKeywords = fullText.match(/best combines|most effectively combines|synthesizes|synthesizing|integrates|combines the information/gi);
      if (hasSynthesisKeywords) {
        confidence = Math.max(confidence, 0.8); // Strong indicator
      }
      // Penalize if has "summarizes" or "describes" (those are Information and Ideas)
      if (fullText.match(/best summarizes|most accurately summarizes|summarizes|describes|indicates that|according to the passage/gi)) {
        confidence *= 0.4; // Heavily penalize - likely Information and Ideas
      }
    }
    
    if (topic === 'information-and-ideas') {
      // Penalize if has "combines" or "synthesizes" (those are Expression of Ideas)
      if (fullText.match(/best combines|most effectively combines|synthesizes|synthesizing|integrates|combines the information/gi)) {
        confidence *= 0.3; // Heavily penalize - likely Expression of Ideas
      }
      // Boost if has summarize/describe keywords
      const hasSummarizeKeywords = fullText.match(/best summarizes|most accurately summarizes|summarizes|describes|indicates that/gi);
      if (hasSummarizeKeywords) {
        confidence = Math.max(confidence, 0.7); // Strong indicator
      }
    }
    
    // Penalize if it's clearly not R&W (has math formulas/equations)
    if (fullText.match(/\$|\\frac|equation|solve for|calculate|graph of|slope|angle|triangle|circle|area|volume|perimeter|radius|diameter/)) {
      confidence *= 0.3; // Heavily penalize if has math indicators
    }
    
    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = {
        topic: TOPIC_MAPPINGS[topic]?.displayName || topic,
        subtopic: matchedSubtopic,
        confidence,
      };
    }
  }
  
  // If we have a passage but no good match, default to Reading & Writing
  if (hasPassage && (!bestMatch || bestMatch.confidence < 0.3)) {
    // Try to find the best R&W subtopic match
    for (const [topic, data] of Object.entries(readingWritingTopics)) {
      let matchCount = 0;
      let matchedSubtopic: string | undefined;
      let subtopicMatchCount = 0;
      
      for (const keyword of data.keywords) {
        if (fullText.includes(keyword)) {
          matchCount++;
        }
      }
      
      for (const [subtopic, keywords] of Object.entries(data.subtopics)) {
        let subtopicMatches = 0;
        for (const keyword of keywords) {
          if (fullText.includes(keyword)) {
            subtopicMatches++;
          }
        }
        if (subtopicMatches > subtopicMatchCount) {
          subtopicMatchCount = subtopicMatches;
          matchedSubtopic = subtopic;
        }
      }
      
      const confidence = Math.max(0.4, matchCount / Math.max(1, data.keywords.length));
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          topic: TOPIC_MAPPINGS[topic]?.displayName || topic,
          subtopic: matchedSubtopic,
          confidence,
        };
      }
    }
  }
  
  return bestMatch || { topic: 'Unknown', confidence: 0 };
}

/**
 * Validate that a question matches the requested topic
 */
export function validateTopicMatch(
  question: string,
  requestedTopic: string,
  requestedSubtopic?: string,
  passage?: string,
  sectionHint?: string
): { matches: boolean; actualTopic?: string; actualSubtopic?: string; confidence: number; issue?: string } {
  const classification = classifyQuestionTopic(question, passage, sectionHint);
  const requestedDisplayName = folderToDisplayName(requestedTopic);
  
  // Normalize for comparison
  const actualTopicNormalized = classification.topic.toLowerCase();
  const requestedTopicNormalized = requestedDisplayName.toLowerCase();
  
  const topicMatches = actualTopicNormalized === requestedTopicNormalized;
  
  // Check subtopic if provided
  let subtopicMatches = true;
  if (requestedSubtopic && classification.subtopic) {
    subtopicMatches = classification.subtopic.toLowerCase() === requestedSubtopic.toLowerCase();
  }
  
  const matches = topicMatches && subtopicMatches && classification.confidence > 0.3;
  
  let issue: string | undefined;
  if (!topicMatches) {
    issue = `Question is classified as "${classification.topic}" but requested topic is "${requestedDisplayName}". This is a CRITICAL mismatch.`;
  } else if (requestedSubtopic && !subtopicMatches && classification.subtopic) {
    issue = `Question subtopic "${classification.subtopic}" does not match requested subtopic "${requestedSubtopic}".`;
  } else if (classification.confidence <= 0.3) {
    issue = `Low confidence (${classification.confidence}) in topic classification. Question may not clearly belong to "${requestedDisplayName}".`;
  }
  
  return {
    matches,
    actualTopic: classification.topic,
    actualSubtopic: classification.subtopic,
    confidence: classification.confidence,
    issue,
  };
}

