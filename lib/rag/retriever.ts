import { vectorStore } from './vector-store';
import { DocumentChunk } from './document-processor';
import { imageStorage } from '@/lib/utils/image-storage';
import { searchFilesDirectly } from '@/lib/utils/file-search';
import path from 'path';
import fs from 'fs/promises';

export interface RetrievedContext {
  rules: string;
  explanations: string;
  instructions: string;
  examples: Array<{
    question: string;
    answer: string;
    explanation?: string;
    imagePath?: string;
    imageId?: string;
    imageBase64?: string; // Base64 encoded image for API responses
  }>;
  sourceChunks: DocumentChunk[];
  visualExamples: Array<{
    imageId: string;
    imageBase64: string;
    description: string;
    metadata: {
      section?: string;
      topic?: string;
      difficulty?: string;
    };
  }>;
}

/**
 * Retrieve relevant context for question generation
 */
export async function retrieveContext(
  query: string,
  options: {
    section?: string;
    topic?: string;
    subtopic?: string;
    difficulty?: string;
    maxExamples?: number;
  } = {}
): Promise<RetrievedContext> {
  const { section, topic, subtopic, difficulty, maxExamples = 5 } = options;
  
  // OPTIMIZATION: Try direct file search first (much cheaper - no embeddings)
  if (section && topic && difficulty) {
    const fileSearchResult = await searchFilesDirectly(section, topic, difficulty, subtopic, maxExamples);
    
    if (fileSearchResult.success && fileSearchResult.examples.length > 0) {
      console.log(`Using direct file search for ${section}/${topic}/${difficulty} (${fileSearchResult.examples.length} examples found)`);
      
      // Still get rules from RAG (only need embeddings for structure docs)
      let rules = 'Follow standard SAT question format and difficulty guidelines.';
      let explanations = 'Ensure questions test the specified skills appropriately.';
      
      try {
        // Only search for structure/rules documents (cheaper - smaller embedding set)
        const structureSearch = await vectorStore.search('SAT structure rules format guidelines', {
          limit: 10,
          minSimilarity: 0.6,
          filter: (chunk: any) => 
            chunk.metadata.section === 'structure' || 
            chunk.source.includes('sat_info') ||
            chunk.source.includes('digital_sat_structure'),
        });
        
        const structureChunks = structureSearch.map(r => r.chunk);
        rules = structureChunks.map(c => c.text).join('\n\n') || rules;
        explanations = structureChunks
          .filter(c => c.text.toLowerCase().includes('explain') || c.text.toLowerCase().includes('note'))
          .map(c => c.text)
          .join('\n\n') || explanations;
      } catch (error: any) {
        // If RAG fails, use default rules (still have examples from file search)
        console.warn('RAG structure search failed, using default rules:', error?.message);
      }
      
      return {
        rules,
        explanations,
        instructions: buildInstructions(section, topic, subtopic, difficulty),
        examples: fileSearchResult.examples,
        sourceChunks: [], // Not needed when using file search
        visualExamples: fileSearchResult.visualExamples,
      };
    }
  }
  
  // Fallback to RAG if file search fails or not enough info
  console.log('Falling back to RAG search...');
  
  // Build filter function
  const filter = (chunk: any) => {
    if (section && chunk.metadata.section !== section) return false;
    if (topic && chunk.metadata.topic !== topic) return false;
    if (difficulty && chunk.metadata.difficulty !== difficulty) return false;
    return true;
  };
  
  // Search for relevant chunks
  let searchResults;
  try {
    searchResults = await vectorStore.search(query, {
      limit: 10, // Reduced from 20 to save costs
      minSimilarity: 0.7,
      filter,
    });
  } catch (error: any) {
    // If embedding generation fails (e.g., quota exceeded), return minimal context
    if (error?.name === 'QuotaExceededError' || error?.name === 'RateLimitError') {
      console.warn('RAG retrieval failed due to API quota/rate limit. Returning minimal context.');
      return {
        rules: 'Follow standard SAT question format and difficulty guidelines.',
        explanations: 'Ensure questions test the specified skills appropriately.',
        instructions: buildInstructions(section, topic, subtopic, difficulty),
        examples: [],
        sourceChunks: [],
        visualExamples: [],
      };
    }
    throw error;
  }
  
  // Separate structure/rules from examples
  const structureChunks = searchResults
    .filter(r => r.chunk.metadata.section === 'structure' || 
                 r.chunk.source.includes('sat_info') ||
                 r.chunk.source.includes('digital_sat_structure'))
    .map(r => r.chunk);
  
  const exampleChunks = searchResults
    .filter(r => r.chunk.metadata.section !== 'structure' &&
                 !r.chunk.source.includes('sat_info') &&
                 !r.chunk.source.includes('digital_sat_structure'))
    .slice(0, maxExamples)
    .map(r => r.chunk);
  
  // Extract rules and explanations from structure chunks
  const rules = structureChunks
    .map(c => c.text)
    .join('\n\n');
  
  const explanations = structureChunks
    .filter(c => c.text.toLowerCase().includes('explain') || 
                 c.text.toLowerCase().includes('note'))
    .map(c => c.text)
    .join('\n\n');
  
  // Extract examples from sample chunks
  const examples = await extractExamplesFromChunks(exampleChunks, maxExamples);
  
  // Extract visual examples (images) from relevant chunks
  const visualExamples = await extractVisualExamples(searchResults.map(r => r.chunk), {
    section,
    topic,
    difficulty,
  });
  
  return {
    rules: rules || 'Follow standard SAT question format and difficulty guidelines.',
    explanations: explanations || 'Ensure questions test the specified skills appropriately.',
    instructions: buildInstructions(section, topic, subtopic, difficulty),
    examples,
    sourceChunks: searchResults.map(r => r.chunk),
    visualExamples,
  };
}

/**
 * Extract example questions from chunks
 */
async function extractExamplesFromChunks(
  chunks: DocumentChunk[],
  maxExamples: number
): Promise<RetrievedContext['examples']> {
  const examples: RetrievedContext['examples'] = [];
  
  // Group chunks by source file
  const chunksBySource = new Map<string, DocumentChunk[]>();
  chunks.forEach(chunk => {
    const source = chunk.metadata.source;
    if (!chunksBySource.has(source)) {
      chunksBySource.set(source, []);
    }
    chunksBySource.get(source)!.push(chunk);
  });
  
  // Process each source file
  for (const [sourcePath, sourceChunks] of chunksBySource.entries()) {
    if (examples.length >= maxExamples) break;
    
    // Try to read the full file to extract complete questions
    try {
      const fullText = sourceChunks.map(c => c.text).join('\n\n');
      const extracted = extractQuestionsFromText(fullText);
      examples.push(...extracted.slice(0, maxExamples - examples.length));
    } catch (error) {
      console.warn(`Failed to extract examples from ${sourcePath}:`, error);
    }
  }
  
  return examples;
}

/**
 * Extract questions from text (heuristic approach)
 * This is a simplified version - you may want to improve this
 */
function extractQuestionsFromText(text: string): RetrievedContext['examples'] {
  const examples: RetrievedContext['examples'] = [];
  
  // Look for question patterns (numbered questions, Q:, etc.)
  const questionPatterns = [
    /(?:^|\n)\s*(\d+)[\.\)]\s*(.+?)(?=\n\s*\d+[\.\)]|\n\s*[A-E][\.\)]|$)/gs,
    /(?:^|\n)\s*Q[:\-]?\s*(.+?)(?=\n\s*[A-E][\.\)]|$)/gs,
  ];
  
  for (const pattern of questionPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (examples.length >= 10) break; // Limit examples
      
      const questionText = match[1] || match[2];
      if (questionText && questionText.length > 20) {
        // Try to extract answer choices
        const answerMatch = text.slice(match.index! + match[0].length)
          .match(/([A-E])[\.\)]\s*(.+?)(?=\n\s*[A-E][\.\)]|$)/s);
        
        examples.push({
          question: questionText.trim(),
          answer: answerMatch ? answerMatch[2].trim() : 'Answer not found',
        });
      }
    }
  }
  
  return examples;
}

/**
 * Build instructions for question generation
 */
function buildInstructions(
  section?: string,
  topic?: string,
  subtopic?: string,
  difficulty?: string
): string {
  const parts: string[] = [];
  
  if (section) {
    parts.push(`Section: ${section}`);
  }
  if (topic) {
    parts.push(`Topic: ${topic}`);
  }
  if (subtopic) {
    parts.push(`Subtopic: ${subtopic}`);
  }
  if (difficulty) {
    parts.push(`Difficulty: ${difficulty}`);
  }
  
  parts.push('Generate a question that follows SAT format and standards.');
  parts.push('Include 4 answer choices (A, B, C, D) with one correct answer.');
  parts.push('Ensure the question tests the specified skills appropriately.');
  
  return parts.join('\n');
}

/**
 * Extract visual examples (images) from chunks
 */
async function extractVisualExamples(
  chunks: DocumentChunk[],
  filter: {
    section?: string;
    topic?: string;
    difficulty?: string;
  }
): Promise<RetrievedContext['visualExamples']> {
  const visualExamples: RetrievedContext['visualExamples'] = [];
  const seenImageIds = new Set<string>();

  // Get images from chunks
  for (const chunk of chunks) {
    if (chunk.metadata.imageIds) {
      for (const imageId of chunk.metadata.imageIds) {
        if (seenImageIds.has(imageId)) continue;
        seenImageIds.add(imageId);

        const image = imageStorage.getImage(imageId);
        if (!image) continue;

        // Apply filter
        if (filter.section && image.metadata.section !== filter.section) continue;
        if (filter.topic && image.metadata.topic !== filter.topic) continue;
        if (filter.difficulty && image.metadata.difficulty !== filter.difficulty) continue;

        try {
          const imageBase64 = await imageStorage.getImageAsBase64(imageId);
          if (imageBase64) {
            visualExamples.push({
              imageId,
              imageBase64,
              description: `Visual from ${path.basename(image.sourceDocument)}`,
              metadata: {
                section: image.metadata.section,
                topic: image.metadata.topic,
                difficulty: image.metadata.difficulty,
              },
            });
          }
        } catch (error) {
          console.warn(`Failed to get image ${imageId}:`, error);
        }
      }
    }
  }

  // Also get images directly by metadata if we don't have enough
  if (visualExamples.length < 3) {
    const directImages = imageStorage.getImagesByMetadata(filter);
    for (const image of directImages.slice(0, 3 - visualExamples.length)) {
      if (seenImageIds.has(image.id)) continue;
      seenImageIds.add(image.id);

      try {
        const imageBase64 = await imageStorage.getImageAsBase64(image.id);
        if (imageBase64) {
          visualExamples.push({
            imageId: image.id,
            imageBase64,
            description: `Visual from ${path.basename(image.sourceDocument)}`,
            metadata: {
              section: image.metadata.section,
              topic: image.metadata.topic,
              difficulty: image.metadata.difficulty,
            },
          });
        }
      } catch (error) {
        console.warn(`Failed to get image ${image.id}:`, error);
      }
    }
  }

  return visualExamples.slice(0, 5); // Limit to 5 visual examples
}

/**
 * Retrieve example questions from samples folder
 */
export async function retrieveExamples(
  section: string,
  topic: string,
  difficulty: string,
  limit: number = 3
): Promise<RetrievedContext['examples']> {
  const samplesPath = path.join(process.cwd(), 'data', 'samples');
  const topicPath = path.join(samplesPath, section, topic);
  
  // Prefer DOCX files (more reliable parsing), fallback to PDF
  const docxFile = path.join(topicPath, `${difficulty}.docx`);
  const pdfFile = path.join(topicPath, `${difficulty}.pdf`);
  
  let difficultyFile: string | null = null;
  
  // Check for DOCX first (preferred - more reliable)
  try {
    await fs.access(docxFile);
    difficultyFile = docxFile;
  } catch {
    // DOCX doesn't exist, try PDF
    try {
      await fs.access(pdfFile);
      difficultyFile = pdfFile;
    } catch {
      // Neither file exists, return empty examples
      return [];
    }
  }
  
  try {
    // Read and extract questions from the file
    const { extractFileContent } = await import('@/lib/utils/file-extractor');
    let content;
    try {
      content = await extractFileContent(difficultyFile);
    } catch (error) {
      // If parsing fails, skip this file and return empty examples
      console.warn(`Failed to extract content from ${difficultyFile}:`, error instanceof Error ? error.message : error);
      return [];
    }
    const examples = extractQuestionsFromText(content.text);
    
    // Try to associate images with examples
    const images = imageStorage.getImagesByMetadata({
      section,
      topic,
      difficulty,
    });
    
    // Associate images with examples (distribute evenly)
    const examplesWithImages = examples.map((ex, index) => {
      if (images.length > 0 && index < images.length) {
        return {
          ...ex,
          imageId: images[index].id,
        };
      }
      return ex;
    });
    
    return examplesWithImages.slice(0, limit);
  } catch (error) {
    console.warn(`Failed to retrieve examples from ${difficultyFile}:`, error);
    return [];
  }
}

