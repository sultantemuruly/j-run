'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Send, Lightbulb, MessageCircle, Loader2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Image from 'next/image';
import { QuestionData } from './question-display';
import { LatexRenderer } from './latex-renderer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'explain' | 'hint' | 'message';
  timestamp: Date;
}

interface QuestionChatProps {
  questionData: QuestionData;
  isOpen: boolean;
  onClose: () => void;
}

export function QuestionChat({ questionData, isOpen, onClose }: QuestionChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingContent, setTypingContent] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-slot="scroll-area-viewport"]');
        if (viewport) {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: 'smooth',
          });
        }
      }
    };
    
    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, typingContent]);

  // Typing animation effect
  useEffect(() => {
    if (!isTyping || !typingContent) return;

    let currentIndex = 0;
    const fullText = typingContent;
    const typingId = `typing-${Date.now()}`;

    // Remove any existing typing messages
    setMessages(prev => prev.filter(msg => msg.id !== 'typing' && !msg.id.startsWith('typing-')));

    const interval = setInterval(() => {
      if (currentIndex < fullText.length) {
        const partialText = fullText.slice(0, currentIndex + 1);
        setMessages(prev => {
          const existingTyping = prev.find(msg => msg.id === typingId);
          if (existingTyping) {
            return prev.map(msg => 
              msg.id === typingId 
                ? { ...msg, content: partialText }
                : msg
            );
          }
          return [...prev, {
            id: typingId,
            role: 'assistant' as const,
            content: partialText,
            type: 'message' as const,
            timestamp: new Date(),
          }];
        });
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
        setTypingContent('');
        // Finalize the message with a proper ID
        setMessages(prev => prev.map(msg => 
          msg.id === typingId 
            ? { ...msg, id: Date.now().toString() }
            : msg
        ));
      }
    }, 15); // Adjust speed here (lower = faster, 15ms = smooth typing)

    return () => clearInterval(interval);
  }, [isTyping, typingContent]);

  const sendMessage = async (message: string, type: 'explain' | 'hint' | 'message' = 'message') => {
    if (!message.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      type,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history including all previous messages
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionData,
          userMessage: message,
          type: type === 'message' ? 'explain' : type,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const result = await response.json();
      
      // Start typing animation
      setIsLoading(false);
      setIsTyping(true);
      setTypingContent(result.response);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: error instanceof Error 
          ? `Sorry, I encountered an error: ${error.message}` 
          : 'Sorry, I encountered an error. Please try again.',
        type: 'message',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  const handleQuickHint = () => {
    sendMessage('Can you give me a hint?', 'hint');
  };

  const handleExplain = () => {
    sendMessage('Can you explain this question?', 'explain');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input, 'message');
    }
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onMouseDown={(e) => {
        // Prevent any interaction with background
        e.stopPropagation();
      }}
    >
      <Card 
        className="w-full max-w-2xl h-[85vh] md:h-[80vh] flex flex-col bg-white shadow-2xl m-2 md:m-4 animate-in slide-in-from-bottom-4 duration-300 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-500 to-cyan-500 text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Question Helper</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-b bg-gray-50 flex gap-2 flex-wrap flex-shrink-0">
          <Button
            onClick={handleQuickHint}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Lightbulb className="w-4 h-4" />
            Get Hint
          </Button>
          <Button
            onClick={handleExplain}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Explain Question
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Ask me anything about this question!</p>
                <p className="text-xs text-gray-400 mt-2">
                  Try "Get Hint" for guidance or "Explain Question" for a full explanation.
                </p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                } animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                {message.role === 'assistant' && (
                  <Avatar className="h-8 w-8 bg-gradient-to-br from-blue-500 to-cyan-500 ring-2 ring-blue-400/50">
                    <AvatarImage src="/logo-white.png" alt="AI Assistant" className="p-1.5" />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <Image 
                        src="/logo-white.png" 
                        alt="AI" 
                        width={20} 
                        height={20} 
                        className="object-contain"
                      />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className={`text-sm leading-relaxed ${message.role === 'user' ? 'text-white' : 'text-gray-900'}`}>
                    {message.role === 'assistant' ? (
                      <div className="markdown-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            // Headings
                            h1: ({ children }) => (
                              <h1 className={`text-lg font-bold mt-3 mb-2 first:mt-0 ${message.role === 'user' ? 'text-white' : 'text-gray-900'}`}>
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className={`text-base font-bold mt-3 mb-2 first:mt-0 ${message.role === 'user' ? 'text-white' : 'text-gray-900'}`}>
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className={`text-sm font-bold mt-2 mb-1 first:mt-0 ${message.role === 'user' ? 'text-white' : 'text-gray-900'}`}>
                                {children}
                              </h3>
                            ),
                            // Paragraphs
                            p: ({ children }) => (
                              <p className={`mb-2 last:mb-0 ${message.role === 'user' ? 'text-white' : 'text-gray-900'}`}>
                                {children}
                              </p>
                            ),
                            // Lists
                            ul: ({ children }) => (
                              <ul className={`list-disc list-inside space-y-1 my-2 ml-2 ${message.role === 'user' ? 'text-white' : 'text-gray-900'}`}>
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className={`list-decimal list-inside space-y-1 my-2 ml-2 ${message.role === 'user' ? 'text-white' : 'text-gray-900'}`}>
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className={`mb-1 ${message.role === 'user' ? 'text-white' : 'text-gray-900'}`}>
                                {children}
                              </li>
                            ),
                            // Strong/Bold
                            strong: ({ children }) => (
                              <strong className={`font-semibold ${message.role === 'user' ? 'text-white' : 'text-gray-900'}`}>
                                {children}
                              </strong>
                            ),
                            // Code
                            code: ({ inline, children, ...props }) => {
                              if (inline) {
                                return (
                                  <code className={`bg-gray-200 dark:bg-gray-700 rounded px-1.5 py-0.5 text-xs font-mono ${message.role === 'user' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-900'}`} {...props}>
                                    {children}
                                  </code>
                                );
                              }
                              return (
                                <code className={`block bg-gray-200 dark:bg-gray-700 rounded p-2 text-xs font-mono my-2 overflow-x-auto ${message.role === 'user' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-900'}`} {...props}>
                                  {children}
                                </code>
                              );
                            },
                            // Text nodes - handle LaTeX
                            text: ({ children }) => {
                              const text = String(children);
                              if (/\$|\\\(|\\\[/.test(text)) {
                                return <LatexRenderer text={text} />;
                              }
                              return <>{children}</>;
                            },
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <LatexRenderer text={message.content} />
                    )}
                  </div>
                  <div className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-white/70' : 'text-gray-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>

                {message.role === 'user' && (
                  <Avatar className="h-8 w-8 bg-gray-300">
                    <AvatarFallback className="text-gray-600 text-xs">You</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 justify-start animate-in fade-in">
                <Avatar className="h-8 w-8 bg-gradient-to-br from-blue-500 to-cyan-500 ring-2 ring-blue-400/50">
                  <AvatarImage src="/logo-white.png" alt="AI Assistant" className="p-1.5" />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Image 
                      src="/logo-white.png" 
                      alt="AI" 
                      width={20} 
                      height={20} 
                      className="object-contain"
                    />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} className="h-1" />
            </div>
          </ScrollArea>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t bg-gray-50 flex-shrink-0">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

