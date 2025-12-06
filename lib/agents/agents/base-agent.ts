import OpenAI from 'openai';
import { fileReaderTool } from '../tools/file-reader';
import { exampleRetrieverTool, listTopicsTool } from '../tools/example-retriever';
import { questionValidatorTool } from '../tools/question-validator';
import { visualValidatorTool } from '../tools/visual-validator';

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
    toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: tools || this.tools.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      tool_choice: toolChoice || 'auto',
      temperature: 0.7,
    });

    return response;
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

