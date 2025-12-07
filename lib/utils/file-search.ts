import fs from 'fs/promises';
import path from 'path';
import { extractFileContent } from './file-extractor';
import { imageStorage } from './image-storage';

export interface FileSearchResult {
  examples: Array<{
    question: string;
    answer: string;
    explanation?: string;
    imagePath?: string;
    imageId?: string;
    imageBase64?: string;
  }>;
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
  success: boolean;
}

/**
 * Direct file search for structured data in data/samples folder
 * This is much cheaper than embeddings - just file I/O
 */
export async function searchFilesDirectly(
  section: string,
  topic: string,
  difficulty: string,
  subtopic?: string,
  maxExamples: number = 5
): Promise<FileSearchResult> {
  try {
    // Map section names
    const sectionFolder = section === 'reading-and-writing' ? 'reading-and-writing' : 'math';
    
    // Map topic to folder name (handle spaces and special chars)
    const topicFolder = topic
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    const samplesPath = path.join(process.cwd(), 'data', 'samples', sectionFolder, topicFolder);
    
    // Prefer DOCX files (more reliable parsing), fallback to PDF
    const docxFile = path.join(samplesPath, `${difficulty}.docx`);
    const pdfFile = path.join(samplesPath, `${difficulty}.pdf`);
    
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
        // Neither file exists, return empty result
        return {
          examples: [],
          visualExamples: [],
          success: false,
        };
      }
    }
    
    // Extract content from file
    const content = await extractFileContent(difficultyFile);
    
    // If extraction failed (empty text), file search didn't work
    if (!content.text || content.text.trim().length === 0) {
      console.warn(`File search failed: File extraction returned empty text for ${difficultyFile}`);
      return {
        examples: [],
        visualExamples: [],
        success: false,
      };
    }
    
    // Extract questions from text
    const examples = extractQuestionsFromText(content.text).slice(0, maxExamples);
    
    // If no examples extracted, file search didn't work
    if (examples.length === 0) {
      console.warn(`File search failed: No questions extracted from ${difficultyFile}`);
      return {
        examples: [],
        visualExamples: [],
        success: false,
      };
    }
    
    // Get associated images
    const images = imageStorage.getImagesByMetadata({
      section,
      topic,
      difficulty,
    });
    
    // Associate images with examples
    const examplesWithImages = examples.map((ex, index) => {
      if (images.length > 0 && index < images.length) {
        return {
          ...ex,
          imageId: images[index].id,
        };
      }
      return ex;
    });
    
    // Get visual examples
    const visualExamples: FileSearchResult['visualExamples'] = [];
    const seenImageIds = new Set<string>();
    
    for (const image of images.slice(0, 5)) {
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
    
    return {
      examples: examplesWithImages,
      visualExamples,
      success: true,
    };
  } catch (error) {
    console.warn('File search failed:', error);
    return {
      examples: [],
      visualExamples: [],
      success: false,
    };
  }
}

/**
 * Extract questions from text (heuristic approach)
 */
function extractQuestionsFromText(text: string): FileSearchResult['examples'] {
  const examples: FileSearchResult['examples'] = [];
  
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

