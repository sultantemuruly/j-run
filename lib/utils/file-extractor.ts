// Import polyfill FIRST before pdf-parse
import './pdf-polyfill';

import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import sharp from 'sharp';

// pdf-parse is a CommonJS module, use dynamic import
let pdfParse: any;
async function getPdfParse() {
  if (!pdfParse) {
    try {
      const pdfParseModule = await import('pdf-parse');
      // Try different ways to access the function
      pdfParse = pdfParseModule.default || pdfParseModule;
      
      // If still not a function, check if it's wrapped
      if (typeof pdfParse !== 'function') {
        // Check if default has a default (double-wrapped)
        if (pdfParseModule.default && typeof pdfParseModule.default === 'object') {
          pdfParse = pdfParseModule.default.default || pdfParseModule.default;
        }
        // If still not a function, try accessing the actual export
        if (typeof pdfParse !== 'function' && 'default' in pdfParseModule) {
          const defaultExport = (pdfParseModule as any).default;
          if (typeof defaultExport === 'function') {
            pdfParse = defaultExport;
          } else if (defaultExport && typeof defaultExport === 'object' && 'default' in defaultExport) {
            pdfParse = defaultExport.default;
          }
        }
      }
    } catch (error) {
      console.error('Failed to import pdf-parse:', error);
      throw error;
    }
  }
  return pdfParse;
}

export interface ExtractedContent {
  text: string;
  images: Array<{
    data: Buffer;
    format: string;
    filename: string;
  }>;
  metadata: {
    filename: string;
    fileType: 'pdf' | 'docx';
    pageCount?: number;
  };
}

/**
 * Extract text and images from PDF files
 */
export async function extractFromPDF(filePath: string): Promise<ExtractedContent> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    // pdf-parse is a CommonJS module, load dynamically
    const pdfParseFn = await getPdfParse();
    
    // Ensure it's a function before calling
    if (typeof pdfParseFn !== 'function') {
      // If pdf-parse isn't working, return empty content instead of crashing
      console.warn(`pdf-parse not available for ${filePath}. PDF parsing is currently disabled.`);
      return {
        text: '',
        images: [],
        metadata: {
          filename: path.basename(filePath),
          fileType: 'pdf',
        },
      };
    }
    
    const pdfData = await pdfParseFn(fileBuffer);
    
    // Extract images from PDF (basic implementation)
    // Note: pdf-parse doesn't extract images directly, you may need pdf-lib or pdfjs-dist for advanced image extraction
    const images: ExtractedContent['images'] = [];
    
    return {
      text: pdfData.text || '',
      images,
      metadata: {
        filename: path.basename(filePath),
        fileType: 'pdf',
        pageCount: pdfData.numpages,
      },
    };
  } catch (error) {
    // Gracefully handle PDF parsing errors
    console.warn(`Failed to parse PDF ${filePath}:`, error instanceof Error ? error.message : error);
    return {
      text: '',
      images: [],
      metadata: {
        filename: path.basename(filePath),
        fileType: 'pdf',
      },
    };
  }
}

/**
 * Extract text and images from DOCX files
 * Note: Image extraction from DOCX requires unzipping the file structure
 * For now, we extract text only. Images can be added later using docx library.
 */
export async function extractFromDOCX(filePath: string): Promise<ExtractedContent> {
  const fileBuffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  
  // TODO: Extract images from DOCX
  // DOCX files are ZIP archives. To extract images, we need to:
  // 1. Unzip the DOCX file
  // 2. Read images from word/media/ folder
  // 3. Process and store them
  // For now, we'll extract text only
  const images: ExtractedContent['images'] = [];
  
  // Try to extract images using mammoth's convertToHtml and parse HTML
  try {
    const htmlResult = await mammoth.convertToHtml({ buffer: fileBuffer });
    // Images in HTML are referenced but not extracted
    // We'll need a different approach (like unzipping) to get actual image data
    // For now, skip image extraction from DOCX
  } catch (error) {
    console.warn(`Could not extract images from ${filePath}:`, error);
  }
  
  return {
    text: result.value,
    images, // Empty for now
    metadata: {
      filename: path.basename(filePath),
      fileType: 'docx',
    },
  };
}

/**
 * Extract content from a file (auto-detects type)
 */
export async function extractFileContent(filePath: string): Promise<ExtractedContent> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.pdf') {
    return extractFromPDF(filePath);
  } else if (ext === '.docx') {
    return extractFromDOCX(filePath);
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }
}

/**
 * Get all files in a directory recursively
 */
export async function getAllFiles(dirPath: string, extensions: string[] = ['.pdf', '.docx']): Promise<string[]> {
  const files: string[] = [];
  
  async function walkDir(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.length === 0 || extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  await walkDir(dirPath);
  return files;
}

