import fs from 'fs/promises';
import path from 'path';
import { extractFileContent } from '@/lib/utils/file-extractor';

/**
 * Tool for reading files from the data directory
 */
export const fileReaderTool = {
  name: 'read_file',
  description: 'Read content from a file in the data directory. Use this to access SAT information documents or structure files.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Relative path to the file from the data directory (e.g., "sat_info.docx" or "digital_sat_structure.docx")',
      },
    },
    required: ['filePath'],
  },
  execute: async (args: { filePath: string }) => {
    try {
      const fullPath = path.join(process.cwd(), 'data', args.filePath);
      const content = await extractFileContent(fullPath);
      
      return {
        success: true,
        text: content.text,
        metadata: content.metadata,
        imageCount: content.images.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

