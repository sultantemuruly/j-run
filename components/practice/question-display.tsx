'use client';

import { Loader2, CheckCircle2, XCircle, MessageCircle } from 'lucide-react';
import { LatexRenderer } from './latex-renderer';
import { Button } from '@/components/ui/button';

export interface QuestionData {
  question: {
    passage?: string; // Reading passage for Reading & Writing questions
    question: string;
    answerChoices: string[];
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    explanation?: string;
    needsVisual: boolean;
    visualDescription?: string;
  };
  visual?: {
    type: string;
    description: string;
    data?: {
      headers?: string[];
      rows?: unknown[][];
    };
    svg?: string;
  };
  metadata: {
    section: string;
    topic: string;
    subtopic?: string;
    difficulty: string;
    generationTime: number;
    iterations: number;
  };
}

interface QuestionDisplayProps {
  questionData: QuestionData;
  onAnswer: (answer: 'A' | 'B' | 'C' | 'D') => void;
  selectedAnswer?: 'A' | 'B' | 'C' | 'D';
  showResult?: boolean;
  onOpenChat?: () => void;
}

export default function QuestionDisplay({
      questionData,
  onAnswer,
  selectedAnswer,
  showResult,
  onOpenChat,
}: QuestionDisplayProps) {
  const { question, visual, metadata } = questionData;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
      {/* Header with Chat Button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-wrap gap-2 text-sm">
        <span className="px-3 py-1 bg-blue-100 text-blue-900 rounded-full font-semibold">
          {metadata.section}
        </span>
        <span className="px-3 py-1 bg-purple-100 text-purple-900 rounded-full font-semibold">
          {metadata.topic}
        </span>
        {metadata.subtopic && (
          <span className="px-3 py-1 bg-indigo-100 text-indigo-900 rounded-full font-semibold">
            {metadata.subtopic}
          </span>
        )}
        <span className="px-3 py-1 bg-gray-100 text-gray-900 rounded-full font-semibold">
          {metadata.difficulty}
        </span>
        </div>
        {onOpenChat && (
          <Button
            onClick={onOpenChat}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Get Help</span>
          </Button>
        )}
      </div>

      {/* Passage (for Reading & Writing questions) */}
      {question.passage && (() => {
        // Detect multiple passages (Passage 1, Passage 2, etc.)
        const passageText = question.passage;
        const passageRegex = /(?:^|\n)\s*Passage\s+(\d+):\s*(.+?)(?=\n\s*Passage\s+\d+:|$)/gi;
        const matches: RegExpMatchArray[] = [];
        let match;
        while ((match = passageRegex.exec(passageText)) !== null) {
          matches.push(match);
        }
        
        if (matches.length > 1) {
          // Multiple passages detected
          return (
            <div className="mb-6 space-y-4">
              {matches.map((match, index) => (
                <div key={index} className="p-5 bg-gray-50 rounded-lg border border-gray-300">
                  <p className="text-sm text-gray-800 mb-3 font-bold uppercase tracking-wide">
                    Passage {match[1]}
                  </p>
                  <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">{match[2].trim()}</p>
                </div>
              ))}
            </div>
          );
        } else {
          // Single passage
          return (
            <div className="mb-6 p-5 bg-gray-50 rounded-lg border border-gray-300">
              <p className="text-sm text-gray-800 mb-3 font-bold uppercase tracking-wide">Reading Passage</p>
              <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">{passageText}</p>
            </div>
          );
        }
      })()}

      {/* Visual (if present) */}
      {visual && (
        <div className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-300">
          <p className="text-sm text-gray-900 mb-4 font-bold uppercase tracking-wide">
            {visual.type === 'table' ? 'Table' : 
             visual.type === 'graph' || visual.type === 'chart' ? 'Graph' : 
             visual.type === 'diagram' ? 'Diagram' : 
             'Visual Content'}
          </p>
          {visual.svg && (
            <div 
              className="mt-4 overflow-x-auto flex justify-center items-center min-h-[400px] bg-white rounded-lg p-4"
              dangerouslySetInnerHTML={{ __html: visual.svg }}
            />
          )}
          {visual.data && typeof visual.data === 'object' && (
            <div className="mt-4">
              {visual.type === 'table' && Array.isArray(visual.data.rows) ? (
                <table className="min-w-full border border-gray-400">
                  <thead>
                    {visual.data.headers && (
                      <tr>
                        {(visual.data.headers as string[]).map((header: string, i: number) => (
                          <th key={i} className="border border-gray-400 px-4 py-2 bg-gray-200 text-gray-900 font-bold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {(visual.data.rows as unknown[][]).map((row: unknown[], i: number) => (
                      <tr key={i}>
                        {row.map((cell: unknown, j: number) => (
                          <td key={j} className="border border-gray-400 px-4 py-2 text-gray-900">
                            {String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-900 font-medium">{visual.description}</p>
              )}
            </div>
          )}
          {!visual.svg && !visual.data && (
            <p className="text-sm text-gray-900 font-medium">{visual.description}</p>
          )}
        </div>
      )}

      {/* Question */}
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 leading-tight">
          <LatexRenderer text={question.question} />
        </h2>
        
        {/* Answer Choices */}
        <div className="space-y-3">
          {question.answerChoices.map((choice, index) => {
            const letter = String.fromCharCode(65 + index) as 'A' | 'B' | 'C' | 'D';
            // Normalize for comparison
            const normalizedLetter = letter.toUpperCase().trim();
            const normalizedCorrect = question.correctAnswer?.toUpperCase().trim();
            const normalizedSelected = selectedAnswer?.toUpperCase().trim();
            
            const isSelected = normalizedSelected === normalizedLetter;
            const isCorrectAnswer = normalizedLetter === normalizedCorrect;
            const showCorrect = showResult && isCorrectAnswer;
            const showIncorrect = showResult && isSelected && !isCorrectAnswer;

            return (
              <button
                key={index}
                onClick={() => !showResult && onAnswer(letter)}
                disabled={showResult}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  showCorrect
                    ? 'border-green-500 bg-green-50'
                    : showIncorrect
                    ? 'border-red-500 bg-red-50'
                    : isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                } ${showResult ? 'cursor-default' : 'cursor-pointer hover:shadow-md'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900 text-lg">{letter}.</span>
                    <span className="text-gray-900 font-medium">
                      <LatexRenderer text={choice.replace(/^[A-D][\.\)]\s*/i, '').trim()} />
                    </span>
                  </div>
                  {showResult && (
                    <>
                      {showCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      )}
                      {showIncorrect && (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanation */}
      {showResult && question.explanation && (
        <div className="mt-6 p-5 bg-blue-50 rounded-lg border-2 border-blue-300">
          <p className="text-sm font-bold text-blue-900 mb-2 uppercase tracking-wide">Explanation:</p>
          <div className="text-base text-blue-900 leading-relaxed">
            <LatexRenderer text={question.explanation} />
          </div>
        </div>
      )}
    </div>
  );
}

export function QuestionLoading() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-900 font-medium">Generating question...</p>
        <p className="text-sm text-gray-700 mt-2">This may take a few moments</p>
      </div>
    </div>
  );
}

