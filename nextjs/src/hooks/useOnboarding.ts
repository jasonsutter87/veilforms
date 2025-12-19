/**
 * VeilForms - useOnboarding Hook
 * React hook for managing onboarding state
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getOnboardingState,
  saveOnboardingState,
  updateOnboardingStep,
  completeOnboarding as completeOnboardingUtil,
  skipOnboarding as skipOnboardingUtil,
  resetOnboarding as resetOnboardingUtil,
  syncOnboardingToServer,
  getOnboardingProgress,
  type OnboardingState,
} from '@/lib/onboarding';

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(() => getOnboardingState());
  const [isLoading, setIsLoading] = useState(false);

  // Sync state changes to localStorage
  useEffect(() => {
    saveOnboardingState(state);
  }, [state]);

  /**
   * Go to next step
   */
  const nextStep = useCallback(() => {
    setState((prev) => {
      const newStep = prev.currentStep + 1;
      updateOnboardingStep(newStep);
      return { ...prev, currentStep: newStep };
    });
  }, []);

  /**
   * Go to previous step
   */
  const previousStep = useCallback(() => {
    setState((prev) => {
      const newStep = Math.max(0, prev.currentStep - 1);
      updateOnboardingStep(newStep);
      return { ...prev, currentStep: newStep };
    });
  }, []);

  /**
   * Go to specific step
   */
  const goToStep = useCallback((step: number) => {
    setState((prev) => {
      updateOnboardingStep(step);
      return { ...prev, currentStep: step };
    });
  }, []);

  /**
   * Complete onboarding
   */
  const completeOnboarding = useCallback(async () => {
    setIsLoading(true);
    try {
      completeOnboardingUtil();
      setState((prev) => ({ ...prev, completed: true }));
      await syncOnboardingToServer(true, 6);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Skip onboarding
   */
  const skipOnboarding = useCallback(async () => {
    setIsLoading(true);
    try {
      skipOnboardingUtil();
      setState((prev) => ({ ...prev, skipped: true, completed: true }));
      await syncOnboardingToServer(true, 0);
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Reset onboarding
   */
  const resetOnboarding = useCallback(() => {
    resetOnboardingUtil();
    setState(getOnboardingState());
  }, []);

  /**
   * Update step and sync to server
   */
  const updateStep = useCallback(async (step: number) => {
    setState((prev) => {
      updateOnboardingStep(step);
      return { ...prev, currentStep: step };
    });
    await syncOnboardingToServer(false, step);
  }, []);

  /**
   * Get progress percentage
   */
  const progress = getOnboardingProgress();

  return {
    state,
    isLoading,
    progress,
    nextStep,
    previousStep,
    goToStep,
    updateStep,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding,
  };
}
