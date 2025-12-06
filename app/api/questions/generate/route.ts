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
  } catch (error) {
    console.error('Error generating question:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate question',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

