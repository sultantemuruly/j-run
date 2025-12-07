import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { QuestionOrchestrator, QuestionGenerationRequest } from '@/lib/agents/orchestration/question-orchestrator';

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
      section,
      topic,
      subtopic,
      difficulty,
      customContext,
    } = body;

    // Validate request
    if (!section || !topic || !difficulty) {
      return NextResponse.json(
        { error: 'Missing required fields: section, topic, difficulty' },
        { status: 400 }
      );
    }

    if (!['math', 'reading-and-writing'].includes(section)) {
      return NextResponse.json(
        { error: 'Invalid section. Must be "math" or "reading-and-writing"' },
        { status: 400 }
      );
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return NextResponse.json(
        { error: 'Invalid difficulty. Must be "easy", "medium", or "hard"' },
        { status: 400 }
      );
    }

    // Generate question
    const orchestrator = new QuestionOrchestrator();
    const questionRequest: QuestionGenerationRequest = {
      section,
      topic,
      subtopic,
      difficulty,
      customContext,
    };

    const result = await orchestrator.generateQuestion(questionRequest);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error generating question:', error);
    
    // Provide user-friendly error messages
    let errorMessage = 'Failed to generate question';
    let statusCode = 500;
    
    if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
      errorMessage = 'OpenAI API quota exceeded. Please check your billing and plan details. The system requires API credits to generate questions.';
      statusCode = 503; // Service Unavailable
    } else if (error?.name === 'RateLimitError' || error?.message?.includes('rate limit')) {
      errorMessage = 'OpenAI API rate limit exceeded. Please wait a moment and try again.';
      statusCode = 429; // Too Many Requests
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error?.name || 'UnknownError',
      },
      { status: statusCode }
    );
  }
}

