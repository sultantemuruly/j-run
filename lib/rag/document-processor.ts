import { extractFileContent, getAllFiles } from '@/lib/utils/file-extractor';
import { imageStorage } from '@/lib/utils/image-storage';
import path from 'path';

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    source: string;
    section?: string;
    topic?: string;
    subtopic?: string;
    difficulty?: string;
    pageNumber?: number;
    chunkIndex: number;
    imageIds?: string[]; // IDs of images associated with this chunk
  };
}

/**
 * Split text into chunks with overlap for better context
 */
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);
    
    // Try to break at sentence boundaries
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > chunkSize * 0.5) {
        chunk = chunk.slice(0, breakPoint + 1);
        start += breakPoint + 1 - overlap;
      } else {
        start = end - overlap;
      }
    } else {
      start = end;
    }
    
    chunks.push(chunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Extract metadata from file path for samples
 * Example: data/samples/math/algebra/easy.pdf
 */
export function extractMetadataFromPath(filePath: string): {
  section?: string;
  topic?: string;
  difficulty?: string;
} {
  const parts = filePath.split(path.sep);
  const metadata: { section?: string; topic?: string; difficulty?: string } = {};
  
  // Find samples folder index
  const samplesIndex = parts.findIndex(part => part === 'samples');
  if (samplesIndex !== -1) {
    // Section is after samples (math or reading-and-writing)
    if (parts[samplesIndex + 1]) {
      metadata.section = parts[samplesIndex + 1];
    }
    // Topic is after section
    if (parts[samplesIndex + 2]) {
      metadata.topic = parts[samplesIndex + 2];
    }
    // Difficulty is the filename without extension
    const filename = parts[parts.length - 1];
    const difficulty = filename.replace(/\.(pdf|docx)$/i, '');
    if (['easy', 'medium', 'hard'].includes(difficulty.toLowerCase())) {
      metadata.difficulty = difficulty.toLowerCase();
    }
  }
  
  return metadata;
}

/**
 * Process a single document and return chunks
 */
export async function processDocument(filePath: string): Promise<DocumentChunk[]> {
  const content = await extractFileContent(filePath);
  const chunks = chunkText(content.text);
  const baseMetadata = extractMetadataFromPath(filePath);
  
  // Store images and link them to chunks
  const imageIds: string[] = [];
  if (content.images && content.images.length > 0) {
    for (let i = 0; i < content.images.length; i++) {
      const image = content.images[i];
      try {
        const imageId = await imageStorage.storeImage(
          image.data,
          image.filename,
          filePath,
          {
            ...baseMetadata,
            imageIndex: i,
          }
        );
        imageIds.push(imageId);
      } catch (error) {
        console.warn(`Failed to store image ${i} from ${filePath}:`, error);
      }
    }
  }
  
  // Distribute images across chunks (associate each image with nearest chunk)
  const chunksPerImage = imageIds.length > 0 ? Math.ceil(chunks.length / imageIds.length) : Infinity;
  
  return chunks.map((chunk, index) => {
    // Associate images with chunks (distribute evenly)
    const chunkImageIds: string[] = [];
    if (imageIds.length > 0) {
      const startImageIndex = Math.floor(index / chunksPerImage);
      const endImageIndex = Math.min(startImageIndex + 1, imageIds.length);
      for (let imgIdx = startImageIndex; imgIdx < endImageIndex; imgIdx++) {
        if (imageIds[imgIdx]) {
          chunkImageIds.push(imageIds[imgIdx]);
        }
      }
    }
    
    return {
    id: `${path.basename(filePath)}_chunk_${index}`,
    text: chunk,
    metadata: {
      source: filePath,
      ...baseMetadata,
      chunkIndex: index,
        imageIds: chunkImageIds.length > 0 ? chunkImageIds : undefined,
    },
    };
  });
}

/**
 * Process all documents in the data folder
 */
export async function processAllDocuments(dataPath: string = './data'): Promise<DocumentChunk[]> {
  const allChunks: DocumentChunk[] = [];
  
  // Process SAT info documents
  const satInfoPath = path.join(dataPath, 'sat_info.docx');
  const satStructurePath = path.join(dataPath, 'digital_sat_structure.docx');
  
  try {
    const satInfoChunks = await processDocument(satInfoPath);
    allChunks.push(...satInfoChunks);
  } catch (error) {
    console.warn(`Failed to process ${satInfoPath}:`, error);
  }
  
  try {
    const satStructureChunks = await processDocument(satStructurePath);
    // Mark these chunks as structure-related
    satStructureChunks.forEach(chunk => {
      chunk.metadata.section = 'structure';
    });
    allChunks.push(...satStructureChunks);
  } catch (error) {
    console.warn(`Failed to process ${satStructurePath}:`, error);
  }
  
  // Process sample questions
  const samplesPath = path.join(dataPath, 'samples');
  try {
    const sampleFiles = await getAllFiles(samplesPath);
    
    for (const file of sampleFiles) {
      try {
        const chunks = await processDocument(file);
        allChunks.push(...chunks);
      } catch (error) {
        console.warn(`Failed to process ${file}:`, error);
      }
    }
  } catch (error) {
    console.warn(`Failed to read samples directory:`, error);
  }
  
  return allChunks;
}

/**
 * Extract subtopic from question text based on headings
 * This is a heuristic - you may want to improve this with NLP
 */
export function extractSubtopicFromQuestion(questionText: string, topic: string): string | undefined {
  // Common subtopic patterns in SAT questions
  const subtopicPatterns: Record<string, string[]> = {
    'Information and Ideas': [
      'Central Ideas and Details',
      'Inferences',
      'Command of Evidence',
    ],
    'Craft and Structure': [
      'Words in Context',
      'Text Structure and Purpose',
      'Cross-Text Connections',
    ],
    'Expression of Ideas': [
      'Rhetorical Synthesis',
      'Transitions',
    ],
    'Standard English Conventions': [
      'Sentence Boundaries',
      'Form, Structure, and Sense',
      'Punctuation',
    ],
    'Algebra': [
      'Linear equations',
      'Linear functions',
      'Systems of equations',
      'Linear inequalities',
    ],
    'Advanced Math': [
      'Equivalent expressions',
      'Nonlinear equations',
      'Nonlinear functions',
    ],
    'Problem-Solving and Data Analysis': [
      'Ratios',
      'Percentages',
      'Probability',
      'Data analysis',
    ],
    'Geometry and Trigonometry': [
      'Area and volume',
      'Triangles',
      'Trigonometry',
      'Circles',
    ],
  };
  
  const patterns = subtopicPatterns[topic] || [];
  const lowerText = questionText.toLowerCase();
  
  for (const pattern of patterns) {
    if (lowerText.includes(pattern.toLowerCase())) {
      return pattern;
    }
  }
  
  return undefined;
}

