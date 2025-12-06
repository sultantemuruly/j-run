'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  BookOpen, 
  Target, 
  Zap, 
  Filter,
  Play,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';

export default function PracticePage() {
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);

  const sections = [
    { id: 'reading-writing', label: 'Reading & Writing', icon: BookOpen },
    { id: 'math', label: 'Math', icon: Target },
  ];

  const topics = {
    'reading-writing': [
      'Craft and Structure',
      'Information and Ideas',
      'Standard English Conventions',
      'Expression of Ideas',
    ],
    'math': [
      'Algebra',
      'Advanced Math',
      'Problem-Solving and Data Analysis',
      'Geometry and Trigonometry',
    ],
  };

  const subtopics: Record<string, string[]> = {
    // Reading and Writing subtopics
    'Information and Ideas': [
      'Central Ideas and Details',
      'Inferences',
      'Command of Evidence (Textual)',
      'Command of Evidence (Quantitative)',
    ],
    'Craft and Structure': [
      'Words in Context',
      'Text Structure and Purpose',
      'Cross-Text Connections',
    ],
    'Expression of Ideas': [
      'Rhetorical Synthesis',
      'Transitions',
    ],
    'Standard English Conventions': [
      'Sentence Boundaries',
      'Form, Structure, and Sense',
      'Punctuation',
    ],
    // Math subtopics
    'Algebra': [
      'Linear equations in 1 variable',
      'Linear equations in 2 variables',
      'Linear functions',
      'Systems of 2 linear equations in 2 variables',
      'Linear inequalities in 1 or 2 variables',
    ],
    'Advanced Math': [
      'Equivalent expressions',
      'Nonlinear equations in 1 variable',
      'Systems of equations in 2 variables',
      'Nonlinear functions',
    ],
    'Problem-Solving and Data Analysis': [
      'Ratios, rates, proportional relationships, and units',
      'Percentages',
      'One-variable data: distributions and measures of center and spread',
      'Two-variable data: models and scatterplots',
      'Probability and conditional probability',
      'Inference from sample statistics and margin of error',
      'Evaluating statistical claims: observational studies and experiments',
    ],
    'Geometry and Trigonometry': [
      'Area and volume formulas',
      'Lines, angles, and triangles',
      'Right triangles and trigonometry',
      'Circles',
    ],
  };

  const difficulties = ['Easy', 'Medium', 'Hard'];

  const handleStartPractice = () => {
    // Will be implemented later with AI question generation
    console.log('Starting practice with filters:', {
      section: selectedSection,
      topics: selectedTopics,
      subtopics: selectedSubtopics,
      difficulties: selectedDifficulties,
    });
  };

  const handleStartFullTest = () => {
    // Will be implemented later
    console.log('Starting full-length practice test');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/" 
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 text-sm"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">
            Practice
          </h1>
          <p className="text-gray-600 text-lg">
            Customize your practice session or take a full-length adaptive test
          </p>
        </div>

        {/* Full-Length Test Card */}
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="absolute inset-0 bg-black/5" />
            <div className="relative p-8 md:p-10">
              <div className="flex items-start justify-between flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">
                        Full-Length Practice Test
                      </h2>
                      <p className="text-blue-100 text-sm">
                        Complete digital SAT simulation
                      </p>
                    </div>
                  </div>
                  <p className="text-white/90 mb-6 text-lg leading-relaxed">
                    Take a complete 2-hour 14-minute adaptive SAT test with 98 questions. 
                    The test includes 64 minutes for Reading & Writing (54 questions) and 70 minutes for Math (44 questions) with a 10-minute break.
                  </p>
                  <div className="flex flex-wrap gap-4 mb-6">
                    <div className="flex items-center gap-2 text-white/90">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm">2 hours 14 minutes</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/90">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm">98 questions</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/90">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm">Adaptive scoring</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/90">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm">10-minute break</span>
                    </div>
                  </div>
                  <Button
                    onClick={handleStartFullTest}
                    size="lg"
                    className="bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Full-Length Test
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Practice Section */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Filter className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Custom Practice</h2>
              <p className="text-gray-600 text-sm">
                Select specific topics and question types to focus on
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Section Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Section
              </label>
              <div className="grid grid-cols-2 gap-3">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isSelected = selectedSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => {
                        setSelectedSection(section.id);
                        // Pre-select all topics for the selected section
                        const sectionTopics = topics[section.id as keyof typeof topics] || [];
                        setSelectedTopics([...sectionTopics]);
                        // Pre-select all subtopics for all topics in the section
                        const allSubtopics = sectionTopics.flatMap(topic => subtopics[topic] || []);
                        setSelectedSubtopics([...allSubtopics]);
                      }}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-2 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                      <p className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                        {section.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topic Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Topic {selectedSection && <span className="text-gray-400">(Optional)</span>}
              </label>
              <div className="grid grid-cols-1 gap-2">
                {selectedSection && topics[selectedSection as keyof typeof topics] ? (
                  topics[selectedSection as keyof typeof topics].map((topic) => {
                    const isSelected = selectedTopics.includes(topic);
                    return (
                      <button
                        key={topic}
                        onClick={() => {
                          if (isSelected) {
                            // Deselect topic
                            setSelectedTopics(selectedTopics.filter(t => t !== topic));
                            // Remove subtopics that belong to this topic
                            const topicSubtopics = subtopics[topic] || [];
                            setSelectedSubtopics(selectedSubtopics.filter(st => !topicSubtopics.includes(st)));
                          } else {
                            // Select topic
                            setSelectedTopics([...selectedTopics, topic]);
                            // Add all subtopics for this topic
                            const topicSubtopics = subtopics[topic] || [];
                            setSelectedSubtopics([...selectedSubtopics, ...topicSubtopics]);
                          }
                        }}
                        className={`p-3 rounded-lg border text-left transition-all duration-200 ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50 text-purple-900'
                            : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{topic}</p>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 text-center">
                    <p className="text-sm text-gray-500">Select a section first</p>
                  </div>
                )}
              </div>
            </div>

            {/* Difficulty Filter - Bottom Left */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Difficulty <span className="text-gray-400">(Optional)</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {difficulties.map((difficulty) => {
                  const isSelected = selectedDifficulties.includes(difficulty);
                  const getClasses = () => {
                    if (!isSelected) {
                      return {
                        button: 'border-gray-200 hover:border-gray-300 bg-white',
                        icon: 'text-gray-400',
                        text: 'text-gray-700',
                      };
                    }
                    switch (difficulty) {
                      case 'Easy':
                        return {
                          button: 'border-green-500 bg-green-50',
                          icon: 'text-green-600',
                          text: 'text-green-900',
                        };
                      case 'Medium':
                        return {
                          button: 'border-yellow-500 bg-yellow-50',
                          icon: 'text-yellow-600',
                          text: 'text-yellow-900',
                        };
                      case 'Hard':
                        return {
                          button: 'border-red-500 bg-red-50',
                          icon: 'text-red-600',
                          text: 'text-red-900',
                        };
                      default:
                        return {
                          button: 'border-gray-200 bg-white',
                          icon: 'text-gray-400',
                          text: 'text-gray-700',
                        };
                    }
                  };
                  const classes = getClasses();
                  return (
                    <button
                      key={difficulty}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedDifficulties(selectedDifficulties.filter(d => d !== difficulty));
                        } else {
                          setSelectedDifficulties([...selectedDifficulties, difficulty]);
                        }
                      }}
                      className={`p-3 rounded-lg border-2 transition-all duration-200 relative ${classes.button}`}
                    >
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white border-2 border-current flex items-center justify-center">
                          <span className="text-[10px]">✓</span>
                        </div>
                      )}
                      <Zap className={`w-4 h-4 mb-1 mx-auto ${classes.icon}`} />
                      <p className={`text-xs font-medium ${classes.text}`}>
                        {difficulty}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subtopic Filter (for both Reading & Writing and Math sections) - Bottom Right */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Subtopic <span className="text-gray-400">(Optional)</span>
              </label>
              <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {selectedSection && selectedTopics.length > 0 ? (
                  selectedTopics.flatMap(topic => 
                    (subtopics[topic] || []).map(subtopic => {
                      const isSelected = selectedSubtopics.includes(subtopic);
                      return (
                        <button
                          key={`${topic}-${subtopic}`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedSubtopics(selectedSubtopics.filter(st => st !== subtopic));
                            } else {
                              setSelectedSubtopics([...selectedSubtopics, subtopic]);
                            }
                          }}
                          className={`w-full p-3 rounded-lg border text-left transition-all duration-200 ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                              : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">{topic}</p>
                              <p className="text-sm font-medium">{subtopic}</p>
                            </div>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs">✓</span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )
                ) : (
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 text-center min-h-[48px] flex items-center justify-center">
                    <p className="text-sm text-gray-500">
                      {selectedSection ? 'Select a topic first' : 'Select a section first'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Start Practice Button */}
          <div className="pt-6 border-t border-gray-200">
            <Button
              onClick={handleStartPractice}
              size="lg"
              className="w-full md:w-auto bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              disabled={!selectedSection}
            >
              <Play className="w-5 h-5 mr-2" />
              Start Custom Practice
            </Button>
            {!selectedSection && (
              <p className="text-sm text-gray-500 mt-2">
                Please select a section to begin
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}