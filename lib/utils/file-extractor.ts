// Import polyfill FIRST before pdf-parse
import './pdf-polyfill';

import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import sharp from 'sharp';

// pdf-parse is a CommonJS module, use dynamic import
let pdfParse: any = null;
let pdfParseInitialized = false;

async function getPdfParse() {
  if (pdfParseInitialized) {
    return pdfParse;
  }
  
  pdfParseInitialized = true;
  
  try {
    // Try dynamic import (works in ES modules)
    const pdfParseModule = await import('pdf-parse');
    
    // pdf-parse can export in different ways depending on the module system
    // Try common patterns
    if (typeof pdfParseModule === 'function') {
      pdfParse = pdfParseModule;
    } else if (typeof pdfParseModule.default === 'function') {
      pdfParse = pdfParseModule.default;
    } else if (typeof pdfParseModule === 'object' && pdfParseModule !== null) {
      // Look for the function in the module object
      for (const key in pdfParseModule) {
        const value = (pdfParseModule as any)[key];
        if (typeof value === 'function') {
          pdfParse = value;
          break;
        }
      }
    }
    
    if (typeof pdfParse !== 'function') {
      console.error('pdf-parse module structure:', Object.keys(pdfParseModule || {}));
      pdfParse = null;
    }
  } catch (error) {
    console.error('Failed to import pdf-parse:', error);
    pdfParse = null;
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
    if (!pdfParseFn || typeof pdfParseFn !== 'function') {
      // If pdf-parse isn't working, return empty content instead of crashing
      console.warn(`pdf-parse not available for ${filePath}. PDF parsing is currently disabled.`);
      console.warn('This is expected if pdf-parse failed to load. PDF files will be skipped.');
      return {
        text: '',
        images: [],
        metadata: {
          filename: path.basename(filePath),
          fileType: 'pdf',
        },
      };
    }
    
    // Call pdf-parse with the buffer
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to parse PDF ${filePath}:`, errorMessage);
    // Return empty content so the system can continue
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

