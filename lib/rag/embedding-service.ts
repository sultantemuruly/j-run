import OpenAI from 'openai';

// Lazy-load OpenAI client to ensure env vars are loaded first
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set. Please add it to your .env.local file.');
    }
    openai = new OpenAI({
      apiKey,
    });
  }
  return openai;
}

/**
 * Generate embeddings for text chunks
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const client = getOpenAIClient();
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small', // or 'text-embedding-ada-002'
      input: texts,
    });
    
    return response.data.map(item => item.embedding);
  } catch (error: any) {
    console.error('Error generating embeddings:', error);
    
    // Check error code/message more carefully
    const errorCode = error?.code || error?.error?.code || '';
    const errorMessage = error?.message || error?.error?.message || '';
    const statusCode = error?.status || error?.response?.status || error?.statusCode;
    
    // Handle quota errors specifically - only if explicitly insufficient_quota
    if (errorCode === 'insufficient_quota' || errorMessage?.toLowerCase().includes('insufficient_quota')) {
      const quotaError = new Error(
        'OpenAI API quota exceeded. Please check your OpenAI billing and plan details. ' +
        'The RAG system requires embeddings to retrieve context from your documents. ' +
        'Please add credits to your OpenAI account or upgrade your plan.'
      );
      quotaError.name = 'QuotaExceededError';
      throw quotaError;
    }
    
    // Handle rate limit errors (429 but NOT insufficient_quota)
    if (statusCode === 429 && errorCode !== 'insufficient_quota' && !errorMessage?.toLowerCase().includes('insufficient_quota')) {
      const rateLimitError = new Error(
        'OpenAI API rate limit exceeded. Please wait a moment and try again.'
      );
      rateLimitError.name = 'RateLimitError';
      throw rateLimitError;
    }
    
    throw error;
  }
}

/**
 * Generate a single embedding
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([text]);
  return embeddings[0];
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

