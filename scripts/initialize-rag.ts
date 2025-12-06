#!/usr/bin/env tsx

/**
 * Script to initialize the RAG system
 * Run this once to process all documents and generate embeddings
 * 
 * Usage: npm run initialize-rag
 * or: tsx scripts/initialize-rag.ts
 */

// Load environment variables from .env.local first
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local first, then fallback to .env
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

// CRITICAL: Polyfill must be loaded BEFORE any pdf-parse imports
import '../lib/utils/pdf-polyfill';

import { initializeRAG } from '../lib/rag/initialize-rag';

initializeRAG()
  .then(() => {
    console.log('✅ RAG system initialized successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error initializing RAG:', error);
    process.exit(1);
  });

