// Import polyfill FIRST before pdf-parse
import './pdf-polyfill';

import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import { PDFDocument } from 'pdf-lib';

/**
 * Enhanced PDF image extraction using pdf-lib
 * This is a fallback - pdf-parse doesn't extract images well
 */
export async function extractImagesFromPDF(filePath: string): Promise<Array<{
  data: Buffer;
  format: string;
  filename: string;
}>> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(fileBuffer);
    const images: Array<{ data: Buffer; format: string; filename: string }> = [];
    
    const pages = pdfDoc.getPages();
    let imageIndex = 0;
    
    for (let i = 0; i < pages.length; i++) {
      // Note: pdf-lib doesn't directly extract images from pages
      // For now, we'll rely on the text extraction and mark images in text
      // A more advanced solution would use pdfjs-dist or pdf2pic
    }
    
    // For now, return empty array - images in PDFs are complex to extract
    // The text extraction will still work, and we can identify image references
    return images;
  } catch (error) {
    console.warn(`Failed to extract images from PDF ${filePath}:`, error);
    return [];
  }
}

/**
 * Check if PDF text mentions images/charts/tables
 */
export function hasVisualReferences(text: string): boolean {
  const visualKeywords = [
    'graph', 'chart', 'table', 'diagram', 'figure',
    'image', 'illustration', 'plot', 'scatter',
    'bar chart', 'line graph', 'pie chart'
  ];
  
  const lowerText = text.toLowerCase();
  return visualKeywords.some(keyword => lowerText.includes(keyword));
}

