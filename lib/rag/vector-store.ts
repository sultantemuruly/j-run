import { DocumentChunk } from './document-processor';
import { generateEmbedding, cosineSimilarity } from './embedding-service';
import fs from 'fs/promises';
import path from 'path';

interface StoredChunk extends DocumentChunk {
  embedding: number[];
}

/**
 * Simple in-memory vector store for development
 * In production, consider using Supabase pgvector or Pinecone
 */
class VectorStore {
  private chunks: StoredChunk[] = [];
  private cachePath: string;

  constructor(cachePath: string = './.cache/embeddings.json') {
    this.cachePath = cachePath;
  }

  /**
   * Add chunks with embeddings to the store
   */
  async addChunks(chunks: DocumentChunk[]): Promise<void> {
    console.log(`Generating embeddings for ${chunks.length} chunks...`);
    
    // Generate embeddings in batches to avoid rate limits
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(chunk => chunk.text);
      
      try {
        const embeddings = await Promise.all(
          texts.map(text => generateEmbedding(text))
        );
        
        batch.forEach((chunk, index) => {
          this.chunks.push({
            ...chunk,
            embedding: embeddings[index],
          });
        });
        
        console.log(`Processed ${Math.min(i + batchSize, chunks.length)}/${chunks.length} chunks`);
      } catch (error) {
        console.error(`Error processing batch ${i}-${i + batchSize}:`, error);
        throw error;
      }
    }
  }

  /**
   * Search for similar chunks
   */
  async search(
    query: string,
    options: {
      limit?: number;
      minSimilarity?: number;
      filter?: (chunk: StoredChunk) => boolean;
    } = {}
  ): Promise<Array<{ chunk: StoredChunk; similarity: number }>> {
    const { limit = 10, minSimilarity = 0.7, filter } = options;
    
    const queryEmbedding = await generateEmbedding(query);
    
    const results = this.chunks
      .filter(chunk => !filter || filter(chunk))
      .map(chunk => ({
        chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .filter(result => result.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    return results;
  }

  /**
   * Get chunks by metadata
   */
  getChunksByMetadata(metadata: Partial<DocumentChunk['metadata']>): StoredChunk[] {
    return this.chunks.filter(chunk => {
      return Object.entries(metadata).every(([key, value]) => {
        return chunk.metadata[key as keyof typeof chunk.metadata] === value;
      });
    });
  }

  /**
   * Save embeddings to cache
   */
  async saveCache(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.cachePath), { recursive: true });
      await fs.writeFile(
        this.cachePath,
        JSON.stringify(this.chunks, null, 2)
      );
      console.log(`Saved ${this.chunks.length} chunks to cache`);
    } catch (error) {
      console.error('Error saving cache:', error);
    }
  }

  /**
   * Load embeddings from cache
   */
  async loadCache(): Promise<boolean> {
    try {
      const data = await fs.readFile(this.cachePath, 'utf-8');
      this.chunks = JSON.parse(data);
      console.log(`Loaded ${this.chunks.length} chunks from cache`);
      return true;
    } catch (error) {
      console.log('No cache found, will generate embeddings');
      return false;
    }
  }

  /**
   * Get all chunks
   */
  getAllChunks(): StoredChunk[] {
    return this.chunks;
  }

  /**
   * Clear the store
   */
  clear(): void {
    this.chunks = [];
  }
}

// Singleton instance
export const vectorStore = new VectorStore();

