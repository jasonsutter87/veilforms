/**
 * VeilForms - OnboardingStep Component
 * Individual step in the onboarding wizard
 */

'use client';

import React from 'react';

interface OnboardingStepProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  stepNumber: number;
  totalSteps: number;
  onNext?: () => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  previousLabel?: string;
  isNextDisabled?: boolean;
  showPrevious?: boolean;
  showSkip?: boolean;
}

export function OnboardingStep({
  children,
  title,
  description,
  stepNumber,
  totalSteps,
  onNext,
  onPrevious,
  onSkip,
  nextLabel = 'Next',
  previousLabel = 'Previous',
  isNextDisabled = false,
  showPrevious = true,
  showSkip = true,
}: OnboardingStepProps) {
  return (
    <div className="onboarding-step">
      <div className="onboarding-step-header">
        <div className="step-progress">
          <span className="step-number">
            Step {stepNumber} of {totalSteps}
          </span>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(stepNumber / totalSteps) * 100}%` }}
            />
          </div>
        </div>
        <h2 className="step-title">{title}</h2>
        {description && <p className="step-description">{description}</p>}
      </div>

      <div className="onboarding-step-content">{children}</div>

      <div className="onboarding-step-footer">
        <div className="step-actions-left">
          {showPrevious && stepNumber > 1 && onPrevious && (
            <button
              onClick={onPrevious}
              className="btn btn-secondary"
              type="button"
            >
              {previousLabel}
            </button>
          )}
        </div>
        <div className="step-actions-right">
          {showSkip && onSkip && (
            <button onClick={onSkip} className="btn btn-text" type="button">
              Skip for now
            </button>
          )}
          {onNext && (
            <button
              onClick={onNext}
              className="btn btn-primary"
              disabled={isNextDisabled}
              type="button"
            >
              {nextLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

/**
 * StepIndicator - Visual indicator of wizard progress
 */
export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <div className="step-indicator">
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;
        const isClickable = onStepClick && stepNum <= currentStep;

        return (
          <div
            key={stepNum}
            className={`step-indicator-item ${
              isCompleted ? 'completed' : ''
            } ${isCurrent ? 'current' : ''} ${isClickable ? 'clickable' : ''}`}
            onClick={() => isClickable && onStepClick(stepNum)}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={(e) => {
              if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onStepClick(stepNum);
              }
            }}
          >
            <div className="step-indicator-circle">
              {isCompleted ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  width="16"
                  height="16"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                stepNum
              )}
            </div>
            <span className="step-indicator-label">{step}</span>
          </div>
        );
      })}
    </div>
  );
}
