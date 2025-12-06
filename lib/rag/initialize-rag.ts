import { processAllDocuments } from './document-processor';
import { vectorStore } from './vector-store';
import { imageStorage } from '@/lib/utils/image-storage';
import path from 'path';

/**
 * Initialize the RAG system by processing all documents and generating embeddings
 * Run this once to set up the vector store
 */
export async function initializeRAG(dataPath: string = './data'): Promise<void> {
  console.log('Initializing RAG system...');
  console.log(`Data path: ${path.resolve(dataPath)}`);

  // Try to load from cache first
  const cacheLoaded = await vectorStore.loadCache();
  await imageStorage.loadIndex();
  
  if (cacheLoaded) {
    console.log('Loaded embeddings from cache. Skipping processing.');
    const imageCount = imageStorage.getImageCount();
    if (imageCount > 0) {
      console.log(`Loaded ${imageCount} images from cache.`);
    }
    return;
  }

  // Process all documents
  console.log('Processing documents...');
  const chunks = await processAllDocuments(dataPath);
  console.log(`Processed ${chunks.length} chunks`);

  // Generate embeddings and add to vector store
  console.log('Generating embeddings...');
  await vectorStore.addChunks(chunks);

  // Save to cache
  await vectorStore.saveCache();
  
  // Save image index
  await imageStorage.saveIndex();
  console.log(`Stored ${imageStorage.getImageCount()} images`);

  console.log('RAG system initialized successfully!');
}

// Run if called directly
if (require.main === module) {
  initializeRAG()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error initializing RAG:', error);
      process.exit(1);
    });
}

