/**
 * VeilForms - ProductTour Component
 * Guided tour highlighting key features with spotlight effect
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface TourStep {
  target: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface ProductTourProps {
  steps: TourStep[];
  isActive: boolean;
  onComplete: () => void;
  onExit: () => void;
}

export function ProductTour({
  steps,
  isActive,
  onComplete,
  onExit,
}: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightPosition, setSpotlightPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  });
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || currentStep >= steps.length) return;

    const step = steps[currentStep];
    const targetElement = document.querySelector(step.target);

    if (!targetElement) {
      console.warn(`Tour target not found: ${step.target}`);
      return;
    }

    // Calculate spotlight position
    const rect = targetElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    setSpotlightPosition({
      top: rect.top + scrollTop,
      left: rect.left + scrollLeft,
      width: rect.width,
      height: rect.height,
    });

    // Calculate tooltip position
    const position = step.position || 'bottom';
    let tooltipTop = 0;
    let tooltipLeft = 0;

    switch (position) {
      case 'top':
        tooltipTop = rect.top + scrollTop - 20;
        tooltipLeft = rect.left + scrollLeft + rect.width / 2;
        break;
      case 'bottom':
        tooltipTop = rect.bottom + scrollTop + 20;
        tooltipLeft = rect.left + scrollLeft + rect.width / 2;
        break;
      case 'left':
        tooltipTop = rect.top + scrollTop + rect.height / 2;
        tooltipLeft = rect.left + scrollLeft - 20;
        break;
      case 'right':
        tooltipTop = rect.top + scrollTop + rect.height / 2;
        tooltipLeft = rect.right + scrollLeft + 20;
        break;
    }

    setTooltipPosition({ top: tooltipTop, left: tooltipLeft });

    // Scroll element into view
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentStep, steps, isActive]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleExit = () => {
    setCurrentStep(0);
    onExit();
  };

  if (!isActive || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <>
      {/* Overlay */}
      <div className="tour-overlay" onClick={handleExit}>
        {/* Spotlight hole */}
        <div
          className="tour-spotlight"
          style={{
            top: `${spotlightPosition.top}px`,
            left: `${spotlightPosition.left}px`,
            width: `${spotlightPosition.width}px`,
            height: `${spotlightPosition.height}px`,
          }}
        />
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`tour-tooltip tour-tooltip-${step.position || 'bottom'}`}
        style={{
          position: 'absolute',
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
        }}
      >
        <div className="tour-tooltip-header">
          <div className="tour-step-counter">
            {currentStep + 1} of {steps.length}
          </div>
          <button
            className="tour-close"
            onClick={handleExit}
            aria-label="Exit tour"
          >
            &times;
          </button>
        </div>
        <h3 className="tour-tooltip-title">{step.title}</h3>
        <p className="tour-tooltip-content">{step.content}</p>
        <div className="tour-tooltip-actions">
          {!isFirstStep && (
            <button onClick={handlePrevious} className="btn btn-secondary btn-sm">
              Previous
            </button>
          )}
          <div className="tour-dots">
            {steps.map((_, index) => (
              <span
                key={index}
                className={`tour-dot ${index === currentStep ? 'active' : ''}`}
              />
            ))}
          </div>
          <button onClick={handleNext} className="btn btn-primary btn-sm">
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}

interface ProductTourTriggerProps {
  tourSteps: TourStep[];
  buttonLabel?: string;
  buttonClassName?: string;
}

/**
 * ProductTourTrigger - Button to start product tour
 */
export function ProductTourTrigger({
  tourSteps,
  buttonLabel = 'Take a Tour',
  buttonClassName = 'btn btn-secondary',
}: ProductTourTriggerProps) {
  const [isActive, setIsActive] = useState(false);

  return (
    <>
      <button onClick={() => setIsActive(true)} className={buttonClassName}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          width="16"
          height="16"
          style={{ marginRight: '8px' }}
        >
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        {buttonLabel}
      </button>

      <ProductTour
        steps={tourSteps}
        isActive={isActive}
        onComplete={() => setIsActive(false)}
        onExit={() => setIsActive(false)}
      />
    </>
  );
}
