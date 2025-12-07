import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLLMClient } from '@/lib/utils/llm-client';

export async function POST(request: Request) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      questionData, 
      userMessage, 
      type, // 'explain' or 'hint'
      conversationHistory = []
    } = body;

    if (!questionData || !userMessage || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: questionData, userMessage, type' },
        { status: 400 }
      );
    }

    if (!['explain', 'hint'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "explain" or "hint"' },
        { status: 400 }
      );
    }

    const llmClient = getLLMClient();
    
    // Build the system prompt based on type
    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'hint') {
      systemPrompt = `You are a helpful SAT tutor. Your role is to provide hints that guide students toward the correct answer WITHOUT revealing it directly. 

Guidelines:
- Give progressive hints (start subtle, can get more specific if asked again)
- Never directly state the correct answer choice (A, B, C, or D)
- Focus on the reasoning process and key concepts
- Encourage the student to think through the problem
- If the student asks multiple times, you can provide more specific guidance, but still avoid giving the answer directly
- Use encouraging language`;

      userPrompt = `Question Context:
Section: ${questionData.metadata.section}
Topic: ${questionData.metadata.topic}
${questionData.metadata.subtopic ? `Subtopic: ${questionData.metadata.subtopic}` : ''}
Difficulty: ${questionData.metadata.difficulty}

${questionData.question.passage ? `Passage:\n${questionData.question.passage}\n\n` : ''}
Question: ${questionData.question.question}

Answer Choices:
${questionData.question.answerChoices.map((choice: string, idx: number) => 
  `${String.fromCharCode(65 + idx)}. ${choice}`
).join('\n')}

Student's question: ${userMessage}

Provide a helpful hint that guides the student without revealing the answer.`;
    } else {
      // explain
      systemPrompt = `You are a helpful SAT tutor. Your role is to explain SAT questions clearly and comprehensively.

Guidelines:
- Explain the correct answer and why it's correct
- Explain why other answer choices are incorrect
- Break down complex concepts into understandable parts
- Use clear, educational language
- Reference specific parts of the passage or question when relevant`;

      userPrompt = `Question Context:
Section: ${questionData.metadata.section}
Topic: ${questionData.metadata.topic}
${questionData.metadata.subtopic ? `Subtopic: ${questionData.metadata.subtopic}` : ''}
Difficulty: ${questionData.metadata.difficulty}

${questionData.question.passage ? `Passage:\n${questionData.question.passage}\n\n` : ''}
Question: ${questionData.question.question}

Answer Choices:
${questionData.question.answerChoices.map((choice: string, idx: number) => 
  `${String.fromCharCode(65 + idx)}. ${choice}`
).join('\n')}

Correct Answer: ${questionData.question.correctAnswer}

${questionData.question.explanation ? `Original Explanation: ${questionData.question.explanation}\n\n` : ''}
Student's question: ${userMessage}

Provide a clear, comprehensive explanation.`;
    }

    // Build conversation history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (last 10 messages to keep good context)
    // Include all messages to maintain full conversation flow
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: userPrompt });

    // Use Gemini for chat (cheaper and good for educational content)
    const result = await llmClient.complete('gemini-1.5-flash', {
      messages,
      temperature: 0.7,
      maxTokens: 1000,
    });

    return NextResponse.json({
      success: true,
      response: result.content,
      model: result.model,
      provider: result.provider,
    });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    
    let errorMessage = 'Failed to generate response';
    let statusCode = 500;
    
    if (error?.message?.includes('GOOGLE_API_KEY')) {
      errorMessage = 'Google API key not configured. Please set GOOGLE_API_KEY in environment variables.';
      statusCode = 503;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: statusCode }
    );
  }
}

