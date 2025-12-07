import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Unified LLM Client - Supports both OpenAI and Google Gemini
 * Allows easy switching between providers for cost optimization
 */

export type LLMProvider = 'openai' | 'gemini';
export type LLMModel = 
  | 'gpt-4o' 
  | 'gpt-4o-mini' 
  | 'gemini-2.0-flash-exp' 
  | 'gemini-1.5-flash'
  | 'gemini-1.5-flash-latest';

export interface LLMCompletionOptions {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  responseFormat?: { type: 'json_object' };
  maxTokens?: number;
}

export interface LLMCompletionResult {
  content: string;
  model: string;
  provider: LLMProvider;
}

/**
 * Unified LLM Client that routes to appropriate provider
 */
export class UnifiedLLMClient {
  private openai: OpenAI;
  private gemini: GoogleGenerativeAI;
  
  constructor() {
    const openaiKey = process.env.OPENAI_API_KEY;
    const googleKey = process.env.GOOGLE_API_KEY;
    
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    
    this.openai = new OpenAI({ apiKey: openaiKey });
    
    if (googleKey) {
      this.gemini = new GoogleGenerativeAI(googleKey);
    } else {
      console.warn('GOOGLE_API_KEY not set. Gemini models will not be available.');
    }
  }
  
  /**
   * Get provider and model name from model string
   */
  private parseModel(model: LLMModel): { provider: LLMProvider; modelName: string } {
    if (model.startsWith('gemini-')) {
      if (!this.gemini) {
        throw new Error('Gemini API key not configured. Falling back to OpenAI.');
      }
      return { provider: 'gemini', modelName: model };
    }
    return { provider: 'openai', modelName: model };
  }
  
  /**
   * Convert messages to Gemini format
   */
  private convertMessagesForGemini(
    messages: LLMCompletionOptions['messages']
  ): string {
    // Gemini uses a single string prompt, combine system and user messages
    const parts: string[] = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        parts.push(`System: ${msg.content}`);
      } else if (msg.role === 'user') {
        parts.push(`User: ${msg.content}`);
      } else if (msg.role === 'assistant') {
        parts.push(`Assistant: ${msg.content}`);
      }
    }
    
    return parts.join('\n\n');
  }
  
  /**
   * Make a completion call using the appropriate provider
   */
  async complete(
    model: LLMModel,
    options: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const { provider, modelName } = this.parseModel(model);
    
    try {
      if (provider === 'gemini') {
        try {
          return await this.completeWithGemini(modelName, options);
        } catch (geminiError: any) {
          // If specific model fails, try gemini-pro as fallback
          if (geminiError?.message?.includes('404') || geminiError?.message?.includes('not found')) {
            console.warn(`Gemini model ${modelName} not found, trying gemini-pro...`);
            try {
              return await this.completeWithGemini('gemini-pro', options);
            } catch (proError) {
              // If gemini-pro also fails, fallback to OpenAI
              console.warn('Gemini-pro also failed, falling back to OpenAI:', proError);
              return await this.completeWithOpenAI('gpt-4o-mini', options);
            }
          }
          // For other errors, fallback to OpenAI
          console.warn('Gemini request failed, falling back to OpenAI:', geminiError);
          return await this.completeWithOpenAI('gpt-4o-mini', options);
        }
      } else {
        return await this.completeWithOpenAI(modelName, options);
      }
    } catch (error) {
      // Final fallback
      if (provider === 'gemini') {
        console.warn('Gemini request failed, falling back to OpenAI:', error);
        return await this.completeWithOpenAI('gpt-4o-mini', options);
      }
      throw error;
    }
  }
  
  /**
   * Complete with OpenAI
   */
  private async completeWithOpenAI(
    model: string,
    options: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = 
      options.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
    
    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        ...(options.responseFormat && { response_format: options.responseFormat }),
        ...(options.maxTokens && { max_tokens: options.maxTokens }),
      });
      
      return {
        content: response.choices[0].message.content || '',
        model,
        provider: 'openai',
      };
    } catch (error: any) {
      // Check error code/message more carefully
      const errorCode = error?.code || error?.error?.code || '';
      const errorMessage = error?.message || error?.error?.message || '';
      const statusCode = error?.status || error?.response?.status || error?.statusCode;
      
      // Handle quota errors specifically - only if explicitly insufficient_quota
      if (errorCode === 'insufficient_quota' || errorMessage?.toLowerCase().includes('insufficient_quota')) {
        const quotaError = new Error(
          'OpenAI API quota exceeded. Please check your OpenAI billing and plan details.'
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
      
      // Re-throw other errors as-is
      throw error;
    }
  }
  
  /**
   * Complete with Gemini
   */
  private async completeWithGemini(
    model: string,
    options: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    // Use gemini-pro as it's the most stable and widely available model
    // gemini-1.5-flash may not be available in all regions/API versions
    const geminiModel = 'gemini-pro';
    
    const genModel = this.gemini.getGenerativeModel({ 
      model: geminiModel,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        ...(options.maxTokens && { maxOutputTokens: options.maxTokens }),
        ...(options.responseFormat?.type === 'json_object' && {
          responseMimeType: 'application/json',
        }),
      },
    });
    
    const prompt = this.convertMessagesForGemini(options.messages);
    
    const result = await genModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Clean up JSON if wrapped in markdown code blocks
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    return {
      content: cleanedText,
      model: geminiModel,
      provider: 'gemini',
    };
  }
}

// Singleton instance
let llmClientInstance: UnifiedLLMClient | null = null;

export function getLLMClient(): UnifiedLLMClient {
  if (!llmClientInstance) {
    llmClientInstance = new UnifiedLLMClient();
  }
  return llmClientInstance;
}

