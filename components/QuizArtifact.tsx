"use client";

import { useState, useEffect } from 'react';
import { Lightbulb, Check, X, ChevronRight } from 'lucide-react';

export interface QuizOption {
  id: number;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  type: 'single' | 'multiple';
  options: QuizOption[];
  hint?: string;
}

export interface QuizArtifactType {
  type: 'quiz';
  title: string;
  subtitle?: string;
  questions: QuizQuestion[];
}

interface QuizArtifactProps {
  artifact: QuizArtifactType;
  isLoading?: boolean;
}

export default function QuizArtifact({ artifact, isLoading = false }: QuizArtifactProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(new Set());
  const [showHint, setShowHint] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [answers, setAnswers] = useState<Map<number, Set<number>>>(new Map());
  const [questions, setQuestions] = useState<QuizQuestion[]>(artifact.questions || []);

  // Update questions when artifact changes (supports incremental loading)
  useEffect(() => {
    if (artifact.questions && artifact.questions.length > 0) {
      setQuestions(prev => {
        // Merge new questions, keeping existing ones
        const existingIds = new Set(prev.map(q => q.id));
        const newQuestions = artifact.questions.filter(q => !existingIds.has(q.id));
        return [...prev, ...newQuestions];
      });
    }
  }, [artifact.questions]);

  // Show loading shell if we have metadata but no questions yet
  if (!questions || questions.length === 0) {
    if (artifact.title) {
      return (
        <div className="my-6 rounded-xl overflow-hidden bg-gradient-to-br from-neutral-900 to-neutral-800 border border-neutral-700 w-full max-w-full min-w-0">
          {/* Header */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-700 bg-neutral-900/50 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">{artifact.title}</h3>
              {artifact.subtitle && (
                <span className="text-xs sm:text-sm text-neutral-400 truncate">{artifact.subtitle}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-xs sm:text-sm text-neutral-400">Generating questions...</span>
            </div>
          </div>
          {/* Loading body */}
          <div className="p-4 sm:p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-neutral-700 rounded w-3/4"></div>
              <div className="h-4 bg-neutral-700 rounded w-1/2"></div>
              <div className="space-y-2 mt-6">
                <div className="h-10 bg-neutral-800 rounded"></div>
                <div className="h-10 bg-neutral-800 rounded"></div>
                <div className="h-10 bg-neutral-800 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null; // No metadata yet, don't render anything
  }

  const currentQuestion = questions[currentQuestionIndex];
  
  // Guard against invalid question index
  if (!currentQuestion) {
    setCurrentQuestionIndex(0);
    return null;
  }
  
  const isMultipleChoice = currentQuestion.type === 'multiple';

  const handleOptionSelect = (optionId: number) => {
    if (showFeedback) return;

    if (isMultipleChoice) {
      const newSelected = new Set(selectedOptions);
      if (newSelected.has(optionId)) {
        newSelected.delete(optionId);
      } else {
        newSelected.add(optionId);
      }
      setSelectedOptions(newSelected);
    } else {
      // Single choice - auto-submit
      setSelectedOptions(new Set([optionId]));
      setShowFeedback(true);
      // Save answer
      setAnswers(new Map(answers).set(currentQuestion.id, new Set([optionId])));
    }
  };

  const handleSubmit = () => {
    if (selectedOptions.size === 0) return;
    setShowFeedback(true);
    // Save answer
    setAnswers(new Map(answers).set(currentQuestion.id, new Set(selectedOptions)));
  };

  const handleNext = () => {
    if (currentQuestionIndex < artifact.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOptions(new Set());
      setShowFeedback(false);
      setShowHint(false);
    } else {
      setCompleted(true);
    }
  };

  const handleTryAgain = () => {
    setCurrentQuestionIndex(0);
    setSelectedOptions(new Set());
    setShowFeedback(false);
    setShowHint(false);
    setCompleted(false);
    setAnswers(new Map());
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach(q => {
      const userAnswers = answers.get(q.id) || new Set();
      const correctOptions = q.options.filter(o => o.isCorrect).map(o => o.id);
      
      if (q.type === 'single') {
        if (userAnswers.has(correctOptions[0])) {
          correct++;
        }
      } else {
        // Multiple choice - all correct must be selected, no incorrect selected
        const allCorrectSelected = correctOptions.every(id => userAnswers.has(id));
        const noIncorrectSelected = q.options.filter(o => !o.isCorrect).every(o => !userAnswers.has(o.id));
        if (allCorrectSelected && noIncorrectSelected) {
          correct++;
        }
      }
    });
    return correct;
  };

  if (completed) {
    const score = calculateScore();
    const total = questions.length;

    return (
      <div className="my-6 rounded-xl overflow-hidden bg-gradient-to-br from-neutral-900 to-neutral-800 border border-neutral-700 w-full max-w-full min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-700 bg-neutral-900/50">
          <h3 className="text-lg sm:text-xl font-bold text-white truncate">{artifact.title}</h3>
          <p className="text-sm text-neutral-400 mt-1">
            Nice work — you got {score} out of {total} correct.
          </p>
        </div>

        {/* Results List */}
        <div className="p-4 sm:p-6 space-y-4">
          {questions.map((q, index) => {
            const userAnswers = answers.get(q.id) || new Set();
            const correctOptions = q.options.filter(o => o.isCorrect);
            const isCorrect = q.type === 'single'
              ? userAnswers.has(correctOptions[0].id)
              : correctOptions.every(o => userAnswers.has(o.id)) && 
                q.options.filter(o => !o.isCorrect).every(o => !userAnswers.has(o.id));

            return (
              <div key={q.id} className="p-3 sm:p-4 rounded-lg bg-neutral-800/50 border border-neutral-700">
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    isCorrect ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    {isCorrect ? <Check size={14} className="text-white" /> : <X size={14} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white mb-2">
                      Q{index + 1}: {q.question}
                    </p>
                    <div className="space-y-1">
                      {q.options.map((opt) => {
                        const isSelected = userAnswers.has(opt.id);
                        return (
                          <div key={opt.id} className="text-xs">
                            <span className={`${isSelected ? 'text-white' : 'text-neutral-500'} ${
                              opt.isCorrect ? 'text-green-400' : ''
                            }`}>
                              {isSelected && !opt.isCorrect && '✗ '}
                              {opt.isCorrect && '✓ '}
                              {opt.text}
                            </span>
                            {opt.explanation && (
                              <span className="ml-2 text-neutral-500">— {opt.explanation}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-neutral-700 bg-neutral-900/50 flex gap-3">
          <button
            onClick={handleTryAgain}
            className="px-4 py-2 rounded-lg bg-neutral-700 text-white text-sm font-medium hover:bg-neutral-600 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors"
          >
            Next quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-6 rounded-xl overflow-hidden bg-gradient-to-br from-neutral-900 to-neutral-800 border border-neutral-700 w-full max-w-full min-w-0">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-700 bg-neutral-900/50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-white truncate">{artifact.title}</h3>
          {artifact.subtitle && (
            <span className="text-xs sm:text-sm text-neutral-400 truncate">{artifact.subtitle}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-400">
            {currentQuestionIndex + 1} of {questions.length}
          </span>
          {currentQuestion.hint && (
            <button
              onClick={() => setShowHint(!showHint)}
              className="p-2 rounded-lg hover:bg-neutral-700 transition-colors"
              title="Show hint"
            >
              <Lightbulb size={18} className={showHint ? 'text-yellow-400' : 'text-neutral-400'} />
            </button>
          )}
        </div>
      </div>

      {/* Question */}
      <div className="p-4 sm:p-6">
        <p className="text-base sm:text-lg font-medium text-white mb-4 sm:mb-6">{currentQuestion.question}</p>

        {/* Hint */}
        {showHint && currentQuestion.hint && (
          <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-sm text-yellow-200">
              <Lightbulb size={14} className="inline mr-2" />
              {currentQuestion.hint}
            </p>
          </div>
        )}

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedOptions.has(option.id);
            const letter = String.fromCharCode(65 + index); // A, B, C, D...

            let bgColor = 'bg-neutral-800';
            let textColor = 'text-white';
            let badgeColor = 'bg-neutral-600';
            let badgeText = 'text-white';

            if (showFeedback) {
              if (option.isCorrect) {
                bgColor = 'bg-green-500/10';
                textColor = 'text-green-300';
                badgeColor = 'bg-green-500';
                badgeText = 'text-white';
              } else if (isSelected && !option.isCorrect) {
                bgColor = 'bg-red-500/10';
                textColor = 'text-red-300';
                badgeColor = 'bg-red-500';
                badgeText = 'text-white';
              }
            } else if (isSelected) {
              bgColor = 'bg-blue-500/10';
              textColor = 'text-blue-300';
              badgeColor = 'bg-blue-500';
              badgeText = 'text-white';
            }

            return (
              <div key={option.id}>
                <button
                  onClick={() => handleOptionSelect(option.id)}
                  disabled={showFeedback}
                  className={`w-full p-4 rounded-lg border transition-all ${bgColor} ${
                    isSelected ? 'border-blue-500' : 'border-neutral-700'
                  } ${showFeedback ? 'cursor-not-allowed' : 'hover:border-neutral-600'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full ${badgeColor} ${badgeText} flex items-center justify-center font-bold text-sm`}>
                      {letter}
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`font-medium ${textColor}`}>{option.text}</p>
                    </div>
                  </div>
                </button>
                {showFeedback && option.explanation && (
                  <div className="mt-2 ml-11 text-sm text-neutral-400">
                    {option.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-neutral-700 bg-neutral-900/50 flex justify-end">
        {isMultipleChoice && !showFeedback && (
          <button
            onClick={handleSubmit}
            disabled={selectedOptions.size === 0}
            className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Check
          </button>
        )}
        {showFeedback && (
          <button
            onClick={handleNext}
            className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-neutral-200 transition-colors flex items-center gap-2"
          >
            {currentQuestionIndex < artifact.questions.length - 1 ? (
              <>
                Next <ChevronRight size={16} />
              </>
            ) : (
              'See results'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
