'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import QuestionDisplay, { QuestionLoading, QuestionData } from '@/components/practice/question-display';
import { QuestionChat } from '@/components/practice/question-chat';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function PracticeSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode'); // 'custom' or 'test'
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [questionData, setQuestionData] = useState<QuestionData | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | 'C' | 'D' | undefined>();
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // For custom practice
  const section = searchParams.get('section');
  const topics = searchParams.get('topics')?.split(',') || [];
  // Use pipe (|) as delimiter since subtopics can contain commas (e.g., "Form, Structure, and Sense")
  const subtopics = searchParams.get('subtopics')?.split('|') || [];
  const difficulties = searchParams.get('difficulties')?.split(',') || [];

  useEffect(() => {
    if (mode === 'custom') {
      generateCustomQuestion();
    } else {
      setError('Practice test mode not yet implemented');
      setLoading(false);
    }
  }, []);

  // Map display names to folder names
  const mapTopicToFolder = (topic: string): string => {
    const mapping: Record<string, string> = {
      // Math topics
      'Algebra': 'algebra',
      'Advanced Math': 'advanced-math',
      'Problem-Solving and Data Analysis': 'problem-solving-and-data-analysis',
      'Geometry and Trigonometry': 'geometry-and-trigonometry',
      // Reading & Writing topics
      'Information and Ideas': 'information-and-ideas',
      'Craft and Structure': 'craft-and-structure',
      'Expression of Ideas': 'expression-of-ideas',
      'Standard English Conventions': 'standard-english-conventions',
    };
    return mapping[topic] || topic.toLowerCase().replace(/\s+/g, '-');
  };

  const generateCustomQuestion = async () => {
    if (!section || topics.length === 0 || difficulties.length === 0) {
      setError('Missing required filters');
      setLoading(false);
      return;
    }

    setGenerating(true);
    setError(null);
    setShowResult(false);
    setSelectedAnswer(undefined);

    try {
      // Pick random topic, subtopic, and difficulty from selections
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      const randomSubtopic = subtopics.length > 0 
        ? subtopics[Math.floor(Math.random() * subtopics.length)]
        : undefined;
      const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)].toLowerCase();

      const response = await fetch('/api/questions/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          section: section === 'reading-writing' ? 'reading-and-writing' : section,
          topic: mapTopicToFolder(randomTopic),
          subtopic: randomSubtopic,
          difficulty: randomDifficulty,
        }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          // If response is not JSON, use status text
          throw new Error(`Failed to generate question: ${response.statusText}`);
        }
        throw new Error(errorData.error || errorData.details || 'Failed to generate question');
      }

      const result = await response.json();
      setQuestionData(result.data);
      setLoading(false);
      setGenerating(false);
    } catch (err) {
      console.error('Error generating question:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate question');
      setLoading(false);
      setGenerating(false);
    }
  };

  const handleAnswer = (answer: 'A' | 'B' | 'C' | 'D') => {
    if (showResult) return;
    
    setSelectedAnswer(answer);
    
    // Normalize both values for comparison (uppercase, trim)
    const normalizedAnswer = answer.toUpperCase().trim() as 'A' | 'B' | 'C' | 'D';
    const normalizedCorrect = questionData?.question.correctAnswer?.toUpperCase().trim() as 'A' | 'B' | 'C' | 'D' | undefined;
    
    // Debug logging for math questions
    if (questionData?.metadata.section === 'math') {
      console.log('Math Answer Check:', {
        userAnswer: normalizedAnswer,
        correctAnswer: normalizedCorrect,
        answerChoices: questionData.question.answerChoices,
        match: normalizedAnswer === normalizedCorrect
      });
    }
    
    const correct = normalizedAnswer === normalizedCorrect;
    setIsCorrect(correct);
    setShowResult(true);
  };

  const handleNext = () => {
    generateCustomQuestion();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <QuestionLoading />
        </div>
      </div>
    );
  }

  if (error) {
    const isQuotaError = error.toLowerCase().includes('quota') || error.toLowerCase().includes('billing');
    const isRateLimitError = error.toLowerCase().includes('rate limit');
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 md:p-8">
            <h2 className="text-xl font-bold text-red-900 mb-4">
              {isQuotaError ? 'API Quota Exceeded' : isRateLimitError ? 'Rate Limit Exceeded' : 'Error'}
            </h2>
            <p className="text-red-700 mb-4">{error}</p>
            
            {isQuotaError && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-900 mb-2">
                  <strong>What this means:</strong> The system uses OpenAI's API to generate questions and retrieve context from your documents. Your OpenAI account has run out of credits.
                </p>
                <p className="text-sm text-yellow-900 mb-3">
                  <strong>How to fix:</strong>
                </p>
                <ul className="text-sm text-yellow-900 list-disc list-inside space-y-1 mb-3">
                  <li>Go to <a href="https://platform.openai.com/account/billing" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI Billing</a> and add credits to your account</li>
                  <li>Or upgrade your OpenAI plan to get more credits</li>
                </ul>
                <p className="text-sm text-yellow-900">
                  Once you've added credits, you can try generating questions again.
                </p>
              </div>
            )}
            
            {isRateLimitError && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900">
                  The API is temporarily rate-limited. Please wait a few moments and try again.
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
              {isQuotaError && (
                <Button 
                  onClick={() => window.open('https://platform.openai.com/account/billing', '_blank')}
                  variant="outline"
                >
                  Open OpenAI Billing
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link href="/practice" className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity">
              <Image 
                src="/logo-grey.png" 
                alt="J-Run SAT" 
                width={200}
                height={53}
                className="h-14 w-auto"
              />
              <span className="text-4xl font-bold text-gray-900 pt-2">J-Run</span>
            </Link>
            <Link 
              href="/practice" 
              className="inline-flex items-center text-gray-800 hover:text-gray-900 font-medium text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Practice
            </Link>
          </div>
          <div className="border-b border-gray-200"></div>
        </div>

        {/* Question Display */}
        {generating ? (
          <QuestionLoading />
        ) : questionData ? (
          <>
            <QuestionDisplay
              questionData={questionData}
              onAnswer={handleAnswer}
              selectedAnswer={selectedAnswer}
              showResult={showResult}
              isCorrect={isCorrect}
              onOpenChat={() => setIsChatOpen(true)}
            />
            
            <QuestionChat
              questionData={questionData}
              isOpen={isChatOpen}
              onClose={() => setIsChatOpen(false)}
            />

            {/* Navigation */}
            {showResult && (
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleNext}
                  size="lg"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold"
                >
                  Next Question
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

