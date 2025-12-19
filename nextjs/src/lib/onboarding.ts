/**
 * VeilForms - Onboarding Utilities
 * Manage onboarding state and progress
 */

export interface OnboardingState {
  completed: boolean;
  currentStep: number;
  tooltipsSeen: string[];
  skipped: boolean;
}

export interface TooltipConfig {
  id: string;
  target: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  showOnce: boolean;
}

const STORAGE_KEY = 'vf_onboarding';
const TOTAL_STEPS = 6;

/**
 * Get onboarding state from localStorage
 */
export function getOnboardingState(): OnboardingState {
  if (typeof window === 'undefined') {
    return {
      completed: false,
      currentStep: 0,
      tooltipsSeen: [],
      skipped: false,
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to parse onboarding state:', error);
  }

  return {
    completed: false,
    currentStep: 0,
    tooltipsSeen: [],
    skipped: false,
  };
}

/**
 * Save onboarding state to localStorage
 */
export function saveOnboardingState(state: OnboardingState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save onboarding state:', error);
  }
}

/**
 * Update current step
 */
export function updateOnboardingStep(step: number): void {
  const state = getOnboardingState();
  state.currentStep = step;
  saveOnboardingState(state);
}

/**
 * Mark onboarding as completed
 */
export function completeOnboarding(): void {
  const state = getOnboardingState();
  state.completed = true;
  state.currentStep = TOTAL_STEPS;
  saveOnboardingState(state);
}

/**
 * Skip onboarding
 */
export function skipOnboarding(): void {
  const state = getOnboardingState();
  state.skipped = true;
  state.completed = true;
  saveOnboardingState(state);
}

/**
 * Reset onboarding (for restart)
 */
export function resetOnboarding(): void {
  const state: OnboardingState = {
    completed: false,
    currentStep: 0,
    tooltipsSeen: [],
    skipped: false,
  };
  saveOnboardingState(state);
}

/**
 * Mark tooltip as seen
 */
export function markTooltipSeen(tooltipId: string): void {
  const state = getOnboardingState();
  if (!state.tooltipsSeen.includes(tooltipId)) {
    state.tooltipsSeen.push(tooltipId);
    saveOnboardingState(state);
  }
}

/**
 * Check if tooltip has been seen
 */
export function hasSeenTooltip(tooltipId: string): boolean {
  const state = getOnboardingState();
  return state.tooltipsSeen.includes(tooltipId);
}

/**
 * Check if user should see onboarding
 */
export function shouldShowOnboarding(userOnboardingCompleted?: boolean): boolean {
  const localState = getOnboardingState();

  // If user object says onboarding is completed, trust that
  if (userOnboardingCompleted === true) {
    return false;
  }

  // Otherwise check local state
  return !localState.completed && !localState.skipped;
}

/**
 * Sync onboarding state to server
 */
export async function syncOnboardingToServer(
  completed: boolean,
  step: number
): Promise<void> {
  try {
    const token = localStorage.getItem('veilforms_token');
    if (!token) return;

    await fetch('/api/user/onboarding', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        onboardingCompleted: completed,
        onboardingStep: step,
      }),
    });
  } catch (error) {
    console.error('Failed to sync onboarding to server:', error);
  }
}

/**
 * Get progress percentage
 */
export function getOnboardingProgress(): number {
  const state = getOnboardingState();
  return Math.round((state.currentStep / TOTAL_STEPS) * 100);
}

/**
 * Predefined tooltips for different pages
 */
export const TOOLTIPS: Record<string, TooltipConfig[]> = {
  dashboard: [
    {
      id: 'dashboard_intro',
      target: '.forms-grid',
      title: 'Your Forms',
      content: 'This is where all your forms are displayed. Click on any form to view submissions and manage settings.',
      position: 'bottom',
      showOnce: true,
    },
    {
      id: 'dashboard_create',
      target: '.form-card-new',
      title: 'Create New Form',
      content: 'Click here to create a new encrypted form. Each form gets its own encryption keys for maximum security.',
      position: 'left',
      showOnce: true,
    },
  ],
  formBuilder: [
    {
      id: 'form_builder_toolbar',
      target: '.form-builder-toolbar',
      title: 'Form Builder Tools',
      content: 'Use these tools to add fields, customize your form, and configure settings.',
      position: 'bottom',
      showOnce: true,
    },
    {
      id: 'form_builder_fields',
      target: '.form-fields',
      title: 'Form Fields',
      content: 'Drag and drop to reorder fields. Click on any field to edit its properties.',
      position: 'right',
      showOnce: true,
    },
  ],
  submissions: [
    {
      id: 'submissions_decrypt',
      target: '.decrypt-button',
      title: 'Decrypt Submissions',
      content: 'Upload your private key to decrypt and view form submissions. Keep your private key secure!',
      position: 'bottom',
      showOnce: true,
    },
  ],
};

/**
 * Form templates for onboarding
 */
export const FORM_TEMPLATES = {
  contact: {
    name: 'Contact Form',
    description: 'A simple contact form with name, email, and message fields',
    fields: [
      {
        type: 'text',
        label: 'Name',
        name: 'name',
        required: true,
        placeholder: 'Your name',
      },
      {
        type: 'email',
        label: 'Email',
        name: 'email',
        required: true,
        placeholder: 'your.email@example.com',
      },
      {
        type: 'textarea',
        label: 'Message',
        name: 'message',
        required: true,
        placeholder: 'How can we help you?',
      },
    ],
  },
  feedback: {
    name: 'Feedback Form',
    description: 'Collect user feedback with ratings and comments',
    fields: [
      {
        type: 'text',
        label: 'Name (Optional)',
        name: 'name',
        required: false,
        placeholder: 'Your name',
      },
      {
        type: 'select',
        label: 'How satisfied are you?',
        name: 'satisfaction',
        required: true,
        options: ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied'],
      },
      {
        type: 'textarea',
        label: 'Comments',
        name: 'comments',
        required: true,
        placeholder: 'Tell us more about your experience...',
      },
    ],
  },
  custom: {
    name: 'Custom Form',
    description: 'Start with a blank form and add your own fields',
    fields: [
      {
        type: 'text',
        label: 'Sample Field',
        name: 'sample',
        required: false,
        placeholder: 'Replace this with your own fields',
      },
    ],
  },
};
