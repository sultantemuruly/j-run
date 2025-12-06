'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

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
    data?: any;
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
  isCorrect?: boolean;
}

export default function QuestionDisplay({
  questionData,
  onAnswer,
  selectedAnswer,
  showResult,
  isCorrect,
}: QuestionDisplayProps) {
  const { question, visual, metadata } = questionData;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
      {/* Metadata */}
      <div className="flex flex-wrap gap-2 mb-6 text-sm">
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
          {metadata.section}
        </span>
        <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full font-medium">
          {metadata.topic}
        </span>
        {metadata.subtopic && (
          <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full font-medium">
            {metadata.subtopic}
          </span>
        )}
        <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full font-medium">
          {metadata.difficulty}
        </span>
      </div>

      {/* Passage (for Reading & Writing questions) */}
      {question.passage && (() => {
        // Detect multiple passages (Passage 1, Passage 2, etc.)
        const passageText = question.passage;
        const passageRegex = /(?:^|\n)\s*Passage\s+(\d+):\s*(.+?)(?=\n\s*Passage\s+\d+:|$)/gis;
        const matches = Array.from(passageText.matchAll(passageRegex));
        
        if (matches.length > 1) {
          // Multiple passages detected
          return (
            <div className="mb-6 space-y-4">
              {matches.map((match, index) => (
                <div key={index} className="p-5 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-3 font-semibold uppercase tracking-wide">
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
            <div className="mb-6 p-5 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600 mb-3 font-semibold uppercase tracking-wide">Reading Passage</p>
              <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">{passageText}</p>
            </div>
          );
        }
      })()}

      {/* Visual (if present) */}
      {visual && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-2 font-medium">
            {visual.type === 'table' ? 'Table' : 
             visual.type === 'graph' || visual.type === 'chart' ? 'Graph' : 
             visual.type === 'diagram' ? 'Diagram' : 
             'Visual Content'}
          </p>
          {visual.svg && (
            <div 
              className="mt-4 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: visual.svg }}
            />
          )}
          {visual.data && typeof visual.data === 'object' && (
            <div className="mt-4">
              {visual.type === 'table' && Array.isArray(visual.data.rows) ? (
                <table className="min-w-full border border-gray-300">
                  <thead>
                    {visual.data.headers && (
                      <tr>
                        {visual.data.headers.map((header: string, i: number) => (
                          <th key={i} className="border border-gray-300 px-4 py-2 bg-gray-100 font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {visual.data.rows.map((row: any[], i: number) => (
                      <tr key={i}>
                        {row.map((cell: any, j: number) => (
                          <td key={j} className="border border-gray-300 px-4 py-2">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-700">{visual.description}</p>
              )}
            </div>
          )}
          {!visual.svg && !visual.data && (
            <p className="text-sm text-gray-700">{visual.description}</p>
          )}
        </div>
      )}

      {/* Question */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{question.question}</h2>
        
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
                    <span className="font-semibold text-gray-700">{letter}.</span>
                    <span className="text-gray-900">
                      {choice.replace(/^[A-D][\.\)]\s*/i, '').trim()}
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
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-semibold text-blue-900 mb-2">Explanation:</p>
          <p className="text-sm text-blue-800">{question.explanation}</p>
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
        <p className="text-gray-600">Generating question...</p>
        <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
      </div>
    </div>
  );
}

