import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PracticeTestOrchestrator, PracticeTestSession } from '@/lib/agents/orchestration/practice-test-orchestrator';

// In-memory session store (in production, use Redis or database)
const sessions = new Map<string, PracticeTestSession>();

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const orchestrator = new PracticeTestOrchestrator();

    switch (action) {
      case 'initialize': {
        const session = await orchestrator.initializeSession(user.id);
        sessions.set(session.id, session);
        return NextResponse.json({
          success: true,
          session: {
            id: session.id,
            state: session.state,
            startTime: session.startTime,
          },
        });
      }

      case 'get-next-question': {
        const { sessionId } = body;
        if (!sessionId) {
          return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }

        const session = sessions.get(sessionId);
        if (!session) {
          return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const { selection, question } = await orchestrator.getNextQuestion(session);
        sessions.set(sessionId, session);

        return NextResponse.json({
          success: true,
          selection,
          question,
          sessionState: session.state,
        });
      }

      case 'submit-answer': {
        const { sessionId, questionIndex, userAnswer, timeSpent } = body;
        if (!sessionId || questionIndex === undefined || !userAnswer) {
          return NextResponse.json(
            { error: 'sessionId, questionIndex, and userAnswer required' },
            { status: 400 }
          );
        }

        const session = sessions.get(sessionId);
        if (!session) {
          return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        orchestrator.submitAnswer(session, questionIndex, userAnswer, timeSpent || 0);
        sessions.set(sessionId, session);

        return NextResponse.json({
          success: true,
          isCorrect: session.questions[questionIndex].isCorrect,
          sessionState: session.state,
        });
      }

      case 'get-session': {
        const { sessionId } = body;
        if (!sessionId) {
          return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }

        const session = sessions.get(sessionId);
        if (!session) {
          return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          session: {
            id: session.id,
            state: session.state,
            questions: session.questions.map(q => ({
              selection: q.selection,
              userAnswer: q.userAnswer,
              isCorrect: q.isCorrect,
              timeSpent: q.timeSpent,
            })),
            startTime: session.startTime,
            remainingTime: orchestrator.getRemainingTime(session),
            isComplete: orchestrator.isComplete(session),
          },
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in practice test API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

