import OpenAI from 'openai';
import { fileReaderTool } from '../tools/file-reader';
import { exampleRetrieverTool, listTopicsTool } from '../tools/example-retriever';
import { questionValidatorTool } from '../tools/question-validator';
import { visualValidatorTool } from '../tools/visual-validator';
import { topicPlannerTool } from '../tools/topic-planner';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Base agent class for all SAT question generation agents
 */
export abstract class BaseAgent {
  protected client: OpenAI;
  protected model: string;
  protected tools: any[];

  constructor(model: string = 'gpt-4o-mini') {
    this.client = openai;
    this.model = model;
    this.tools = [
      fileReaderTool,
      exampleRetrieverTool,
      listTopicsTool,
      questionValidatorTool,
      visualValidatorTool,
      topicPlannerTool,
    ];
  }

  /**
   * Execute the agent with a prompt and context
   */
  abstract execute(prompt: string, context?: any): Promise<any>;

  /**
   * Call a tool by name
   */
  protected async callTool(toolName: string, args: any): Promise<any> {
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }
    return tool.execute(args);
  }

  /**
   * Make a chat completion with tool support
   */
  protected async chatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools?: any[],
    toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } },
    responseFormat?: { type: 'json_object' }
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    // If tools is explicitly provided (even if empty array), use it
    // Otherwise, use default tools
    const toolsToUse = tools !== undefined 
      ? (tools.length > 0 ? tools.map(t => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })) : undefined)
      : this.tools.map(t => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }));

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        ...(toolsToUse && { tools: toolsToUse }),
        // Only set tool_choice if tools are provided
        ...(toolsToUse && { tool_choice: toolChoice || 'auto' }),
        temperature: 0.7,
        ...(responseFormat && { response_format: responseFormat }),
      });

      return response;
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
   * Handle tool calls in a response
   */
  protected async handleToolCalls(
    toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      try {
        const result = await this.callTool(toolName, args);
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } catch (error) {
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        });
      }
    }

    return toolMessages;
  }
}

