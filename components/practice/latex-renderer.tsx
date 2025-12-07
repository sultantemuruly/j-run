'use client';

import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  text: string;
  className?: string;
}

/**
 * Renders text with LaTeX math expressions
 * Supports:
 * - Inline math: $...$ or \(...\)
 * - Block math: $$...$$ or \[...\]
 */
export function LatexRenderer({ text, className = '' }: LatexRendererProps) {
  // Split text by LaTeX delimiters
  const parts: (string | { type: 'inline' | 'block'; content: string })[] = [];
  let currentIndex = 0;
  let textBuffer = '';

  // Patterns for LaTeX delimiters
  const inlinePattern = /\$([^$]+)\$|\\\(([^)]+)\\\)/g;
  const blockPattern = /\$\$([^$]+)\$\$|\\\[([^\]]+)\\]/g;

  // First, find all block math (they take precedence)
  const blockMatches: Array<{ start: number; end: number; content: string }> = [];
  let match;
  
  // Reset regex
  blockPattern.lastIndex = 0;
  while ((match = blockPattern.exec(text)) !== null) {
    blockMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[1] || match[2] || '',
    });
  }

  // Then find inline math, but skip if it's inside a block math
  const inlineMatches: Array<{ start: number; end: number; content: string }> = [];
  inlinePattern.lastIndex = 0;
  while ((match = inlinePattern.exec(text)) !== null) {
    const isInsideBlock = blockMatches.some(
      bm => match.index >= bm.start && match.index < bm.end
    );
    if (!isInsideBlock) {
      inlineMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1] || match[2] || '',
      });
    }
  }

  // Combine and sort all matches
  const allMatches = [
    ...blockMatches.map(m => ({ ...m, type: 'block' as const })),
    ...inlineMatches.map(m => ({ ...m, type: 'inline' as const })),
  ].sort((a, b) => a.start - b.start);

  // Build parts array
  for (const match of allMatches) {
    // Add text before this match
    if (match.start > currentIndex) {
      const textBefore = text.substring(currentIndex, match.start);
      if (textBefore) {
        parts.push(textBefore);
      }
    }

    // Add the math expression
    parts.push({ type: match.type, content: match.content.trim() });

    currentIndex = match.end;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    const remainingText = text.substring(currentIndex);
    if (remainingText) {
      parts.push(remainingText);
    }
  }

  // If no LaTeX found, just return the text
  if (parts.length === 0 || (parts.length === 1 && typeof parts[0] === 'string')) {
    return <span className={className}>{text}</span>;
  }

  // Render parts
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (typeof part === 'string') {
          return <span key={index}>{part}</span>;
        } else if (part.type === 'block') {
          return (
            <div key={index} className="my-2">
              <BlockMath math={part.content} />
            </div>
          );
        } else {
          return <InlineMath key={index} math={part.content} />;
        }
      })}
    </span>
  );
}

