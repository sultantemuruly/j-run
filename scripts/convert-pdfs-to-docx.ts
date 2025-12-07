/**
 * Convert all PDF files in data/samples to DOCX format
 * This ensures reliable file search since DOCX parsing with mammoth works perfectly
 */

import fs from 'fs/promises';
import path from 'path';
import { Document, Packer, Paragraph, TextRun } from 'docx';

// Import polyfill FIRST before pdf-parse
import '../lib/utils/pdf-polyfill';

/**
 * Extract text from PDF using pdfjs-dist (more reliable than pdf-parse)
 */
async function extractTextFromPDF(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  const uint8Array = new Uint8Array(fileBuffer);
  
  try {
    // Try pdfjs-dist
    let pdfjs: any;
    try {
      pdfjs = await import('pdfjs-dist');
    } catch {
      pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    }
    
    // Set up worker
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version || '3.11.174'}/pdf.worker.min.js`;
    }
    
    const loadingTask = pdfjs.getDocument({ 
      data: uint8Array,
      verbosity: 0,
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
    
    return fullText.trim();
  } catch (error) {
    console.error(`Failed to extract text from ${filePath}:`, error);
    throw error;
  }
}

/**
 * Convert PDF to DOCX
 */
async function convertPDFToDOCX(pdfPath: string, docxPath: string): Promise<void> {
  try {
    console.log(`Converting ${pdfPath} to ${docxPath}...`);
    
    // Extract text from PDF
    const text = await extractTextFromPDF(pdfPath);
    
    if (!text || text.trim().length === 0) {
      console.warn(`No text extracted from ${pdfPath}, skipping...`);
      return;
    }
    
    // Split text into paragraphs (split by double newlines or single newlines for questions)
    const paragraphs = text
      .split(/\n\s*\n/)
      .filter(p => p.trim().length > 0)
      .map(paragraph => 
        new Paragraph({
          children: [new TextRun(paragraph.trim())],
        })
      );
    
    // If no paragraphs found, create one with all text
    if (paragraphs.length === 0) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(text)],
        })
      );
    }
    
    // Create DOCX document
    const doc = new Document({
      sections: [
        {
          children: paragraphs,
        },
      ],
    });
    
    // Save DOCX file
    const buffer = await Packer.toBuffer(doc);
    await fs.writeFile(docxPath, buffer);
    
    console.log(`✅ Successfully converted ${pdfPath} to ${docxPath}`);
  } catch (error) {
    console.error(`❌ Failed to convert ${pdfPath} to ${docxPath}:`, error);
    throw error;
  }
}

/**
 * Find all PDF files recursively
 */
async function findAllPDFs(dirPath: string): Promise<string[]> {
  const pdfs: string[] = [];
  
  async function walkDir(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        pdfs.push(fullPath);
      }
    }
  }
  
  await walkDir(dirPath);
  return pdfs;
}

/**
 * Main conversion function
 */
async function convertAllPDFs() {
  const samplesPath = path.join(process.cwd(), 'data', 'samples');
  
  console.log(`Looking for PDF files in ${samplesPath}...`);
  
  // Find all PDF files
  const pdfFiles = await findAllPDFs(samplesPath);
  
  if (pdfFiles.length === 0) {
    console.log('No PDF files found.');
    return;
  }
  
  console.log(`Found ${pdfFiles.length} PDF file(s). Starting conversion...\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const pdfPath of pdfFiles) {
    try {
      // Create DOCX path (same location, different extension)
      const docxPath = pdfPath.replace(/\.pdf$/i, '.docx');
      
      // Check if DOCX already exists
      try {
        await fs.access(docxPath);
        console.log(`⏭️  ${docxPath} already exists, skipping ${pdfPath}`);
        continue;
      } catch {
        // File doesn't exist, proceed with conversion
      }
      
      await convertPDFToDOCX(pdfPath, docxPath);
      successCount++;
    } catch (error) {
      console.error(`Failed to convert ${pdfPath}:`, error);
      failCount++;
    }
  }
  
  console.log(`\n✅ Conversion complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`\n💡 You can now delete the PDF files if you want, or keep them as backup.`);
  console.log(`   The system will automatically use DOCX files when available.`);
}

// Run if called directly
if (require.main === module) {
  convertAllPDFs().catch(console.error);
}

export { convertAllPDFs, convertPDFToDOCX };

