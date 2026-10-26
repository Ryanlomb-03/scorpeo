import React, { useState, useEffect, useRef } from 'react';

interface InstallationSequenceProps {
  steps: string[];
  onComplete?: () => void;
}

export default function InstallationSequence({ steps, onComplete }: InstallationSequenceProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isProgressStep, setIsProgressStep] = useState(false);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  // Detect network speed
  const getNetworkSpeed = (): number => {
    const connection = (navigator as any).connection;
    if (connection && connection.downlink) {
      // downlink is in Mbps, convert to a speed factor (0.1 to 1)
      return Math.min(connection.downlink / 10, 1);
    }
    // Fallback to medium speed
    return 0.5;
  };

  // Animate through steps
  useEffect(() => {
    const animateStep = (stepIndex: number) => {
      if (stepIndex >= steps.length) {
        onComplete?.();
        return;
      }

      const step = steps[stepIndex];
      const isProgress = step.includes('[PROGRESS_BAR]');
      
      setIsProgressStep(isProgress);

      if (isProgress) {
        // Animate progress bar based on network speed
        const speed = getNetworkSpeed();
        const increment = Math.max(1, speed * 5); // 1-5% per update
        const interval = Math.max(50, 1000 / speed); // 50-1000ms per update

        let currentProgress = 0;
        
        const progressInterval = setInterval(() => {
          currentProgress += increment;
          if (currentProgress >= 100) {
            currentProgress = 100;
            clearInterval(progressInterval);
            setProgress(100);
            
            // Move to next step after a brief delay
            setTimeout(() => {
              setCurrentStep(stepIndex + 1);
              animateStep(stepIndex + 1);
            }, 500);
          }
          setProgress(currentProgress);
        }, interval);

        animationRef.current = progressInterval as any;
      } else {
        // Regular step - show for a moment then move to next
        const delay = stepIndex === 0 ? 500 : 800; // First step faster
        animationRef.current = setTimeout(() => {
          setCurrentStep(stepIndex + 1);
          animateStep(stepIndex + 1);
        }, delay);
      }
    };

    animateStep(currentStep);

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        clearInterval(animationRef.current as any);
      }
    };
  }, [steps, currentStep, onComplete]);

  // Render step with progress bar
  const renderStep = (step: string, index: number) => {
    // Remove "Step N:" prefix if present
    const cleanStep = step.replace(/^Step \d+:\s*/i, '');
    
    if (cleanStep.includes('[PROGRESS_BAR]')) {
      const percentage = isProgressStep && index === currentStep ? progress : 100;
      const textWithoutMarkers = cleanStep.replace(/\[PROGRESS_BAR\]\s*\[PERCENTAGE\]%/g, '');
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <span>{textWithoutMarkers}</span>
          <div className="w-32 h-4 bg-gray-800 border border-green-500">
            <div 
              className="h-full bg-[#00FF00] transition-all duration-100"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span>{percentage}%</span>
        </div>
      );
    }
    return cleanStep;
  };

  return (
    <div className="bg-black p-4 rounded-lg font-mono text-sm border-2 border-green-500 w-full max-w-full min-w-0 overflow-x-auto">
      {steps.slice(0, currentStep + 1).map((step, index) => (
        <div 
          key={index} 
          className="text-green-500 mb-1"
          style={{ 
            opacity: index === currentStep ? 1 : 0.8,
            animation: index === currentStep ? 'pulse 0.5s ease-in-out' : 'none'
          }}
        >
          {renderStep(step, index)}
        </div>
      ))}
      {currentStep < steps.length && (
        <div className="text-green-500 animate-pulse">
          █
        </div>
      )}
    </div>
  );
}
