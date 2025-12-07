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
 * Extract text from PDF using pdfjs-dist (fallback method)
 * This is optional - if pdfjs-dist isn't available, it will throw
 */
async function extractFromPDFWithPdfJs(fileBuffer: Buffer): Promise<{ text: string; pageCount: number }> {
  // Convert Buffer to Uint8Array (required by pdfjs-dist)
  const uint8Array = new Uint8Array(fileBuffer);
  
  // Try to use pdfjs-dist as fallback
  // pdfjs-dist requires canvas for Node.js, but we can try without it for text extraction
  let pdfjs: any;
  try {
    // Try the standard import
    pdfjs = await import('pdfjs-dist');
  } catch (importError) {
    // Try legacy build
    try {
      pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    } catch (legacyError) {
      throw new Error(`pdfjs-dist not available: ${importError instanceof Error ? importError.message : importError}`);
    }
  }
  
  // Set up worker (required for pdfjs-dist)
  // For Node.js, we can use a local worker or skip it for text extraction
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
    // Try to use a CDN worker (works in Node.js with fetch)
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version || '3.11.174'}/pdf.worker.min.js`;
    } catch {
      // If that fails, try to disable worker (may work for text extraction)
      pdfjs.GlobalWorkerOptions.workerSrc = false;
    }
  }
  
  const loadingTask = pdfjs.getDocument({ 
    data: uint8Array, // Use Uint8Array instead of Buffer
    verbosity: 0, // Suppress warnings
    useSystemFonts: true, // Better compatibility
  });
  const pdfDocument = await loadingTask.promise;
  const pageCount = pdfDocument.numPages;
  
  let fullText = '';
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str || '')
      .join(' ');
    fullText += pageText + '\n';
  }
  
  return { text: fullText.trim(), pageCount };
}

/**
 * Extract text and images from PDF files
 * Tries pdf-parse first, falls back to pdfjs-dist if needed
 */
export async function extractFromPDF(filePath: string): Promise<ExtractedContent> {
  const fileBuffer = await fs.readFile(filePath);
  let pdfData: any = null;
  let usedFallback = false;
  
  // Try pdf-parse first
  try {
    const pdfParseFn = await getPdfParse();
    
    if (pdfParseFn && typeof pdfParseFn === 'function') {
      // Call pdf-parse with the buffer
      // Wrap in try-catch to handle AbortException specifically
      try {
        pdfData = await pdfParseFn(fileBuffer);
      } catch (parseError: any) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        
        // If it's AbortException, try fallback
        if (errorMessage.includes('AbortException') || 
            errorMessage.includes('cannot be invoked without') ||
            errorMessage.includes('Aborted')) {
          console.warn(`pdf-parse failed with AbortException for ${filePath}, trying fallback parser...`);
          try {
            usedFallback = true;
            // Try fallback
            const fallbackResult = await extractFromPDFWithPdfJs(fileBuffer);
            pdfData = {
              text: fallbackResult.text,
              numpages: fallbackResult.pageCount,
            };
            console.log(`Successfully used pdfjs-dist fallback for ${filePath}`);
          } catch (fallbackError) {
            console.warn(`Fallback parser also failed for ${filePath}:`, fallbackError instanceof Error ? fallbackError.message : fallbackError);
            throw parseError; // Throw original error
          }
        } else {
          throw parseError;
        }
      }
    } else {
      // pdf-parse not available, try fallback
      console.warn(`pdf-parse not available for ${filePath}, trying fallback parser...`);
      usedFallback = true;
      const fallbackResult = await extractFromPDFWithPdfJs(fileBuffer);
      pdfData = {
        text: fallbackResult.text,
        numpages: fallbackResult.pageCount,
      };
    }
    
    // Extract images from PDF (basic implementation)
    const images: ExtractedContent['images'] = [];
    
    if (usedFallback) {
      console.log(`Successfully parsed PDF ${filePath} using fallback parser`);
    }
    
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
    // All parsing methods failed
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`All PDF parsing methods failed for ${filePath}:`, errorMessage);
    console.warn(`PDF parsing failed. File search will not work for this file. Falling back to RAG search.`);
    
    // Return empty content so the system can continue with RAG search
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

