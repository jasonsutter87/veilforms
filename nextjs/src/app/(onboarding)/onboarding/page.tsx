/**
 * VeilForms - Onboarding Page
 * Multi-step wizard for first-time users
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useOnboarding } from '@/hooks/useOnboarding';
import { FORM_TEMPLATES } from '@/lib/onboarding';

export default function OnboardingPage() {
  const router = useRouter();
  const { state, nextStep, previousStep, completeOnboarding, skipOnboarding } =
    useOnboarding();

  const [selectedTemplate, setSelectedTemplate] = useState<
    'contact' | 'feedback' | 'custom'
  >('contact');
  const [createdFormId, setCreatedFormId] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string>('');
  const [embedCode, setEmbedCode] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string>('');

  // Redirect if already completed
  useEffect(() => {
    if (state.completed) {
      router.push('/dashboard');
    }
  }, [state.completed, router]);

  const handleCreateForm = async () => {
    setIsCreating(true);
    setError('');

    try {
      const token = localStorage.getItem('veilforms_token');
      const template = FORM_TEMPLATES[selectedTemplate];

      const response = await fetch('/api/forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: template.name,
          fields: template.fields,
          settings: {
            encryption: true,
            piiStrip: false,
            allowedOrigins: ['*'],
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create form');
      }

      setCreatedFormId(data.form.id);
      setPrivateKey(JSON.stringify(data.privateKey, null, 2));

      // Generate embed code
      const code = `<!-- VeilForms Embed -->\n<div id="veilforms-${data.form.id}"></div>\n<script src="https://cdn.veilforms.com/sdk.js"></script>\n<script>\n  VeilForms.embed('${data.form.id}', '#veilforms-${data.form.id}');\n</script>`;
      setEmbedCode(code);

      nextStep();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleFinish = async () => {
    await completeOnboarding();
    router.push('/dashboard');
  };

  const handleSkip = async () => {
    await skipOnboarding();
    router.push('/dashboard');
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadPrivateKey = () => {
    const blob = new Blob([privateKey], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'veilforms-private-key.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderStep = () => {
    switch (state.currentStep) {
      case 0:
        // Step 1: Welcome
        return (
          <OnboardingStep
            stepNumber={1}
            totalSteps={6}
            title="Welcome to VeilForms"
            description="Privacy-first form builder with client-side encryption"
            onNext={nextStep}
            onSkip={handleSkip}
            showPrevious={false}
          >
            <div className="onboarding-welcome">
              <div className="welcome-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  width="80"
                  height="80"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
              </div>
              <h3>Let&apos;s get you started</h3>
              <p>
                VeilForms protects your users&apos; privacy with end-to-end encryption.
                We&apos;ll walk you through creating your first form in just a few
                minutes.
              </p>
              <div className="feature-list">
                <div className="feature-item">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="20"
                    height="20"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Client-side encryption</span>
                </div>
                <div className="feature-item">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="20"
                    height="20"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Zero-knowledge architecture</span>
                </div>
                <div className="feature-item">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="20"
                    height="20"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Easy to embed anywhere</span>
                </div>
              </div>
            </div>
          </OnboardingStep>
        );

      case 1:
        // Step 2: Create First Form - Template Selection
        return (
          <OnboardingStep
            stepNumber={2}
            totalSteps={6}
            title="Create Your First Form"
            description="Choose a template to get started quickly"
            onNext={handleCreateForm}
            onPrevious={previousStep}
            onSkip={handleSkip}
            nextLabel={isCreating ? 'Creating...' : 'Create Form'}
            isNextDisabled={isCreating}
          >
            <div className="template-selection">
              {error && <div className="error-message">{error}</div>}

              <div className="template-grid">
                <label
                  className={`template-card ${
                    selectedTemplate === 'contact' ? 'selected' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    value="contact"
                    checked={selectedTemplate === 'contact'}
                    onChange={(e) =>
                      setSelectedTemplate(e.target.value as 'contact')
                    }
                  />
                  <div className="template-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="32"
                      height="32"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                  </div>
                  <h4>Contact Form</h4>
                  <p>{FORM_TEMPLATES.contact.description}</p>
                </label>

                <label
                  className={`template-card ${
                    selectedTemplate === 'feedback' ? 'selected' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    value="feedback"
                    checked={selectedTemplate === 'feedback'}
                    onChange={(e) =>
                      setSelectedTemplate(e.target.value as 'feedback')
                    }
                  />
                  <div className="template-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="32"
                      height="32"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </div>
                  <h4>Feedback Form</h4>
                  <p>{FORM_TEMPLATES.feedback.description}</p>
                </label>

                <label
                  className={`template-card ${
                    selectedTemplate === 'custom' ? 'selected' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    value="custom"
                    checked={selectedTemplate === 'custom'}
                    onChange={(e) =>
                      setSelectedTemplate(e.target.value as 'custom')
                    }
                  />
                  <div className="template-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="32"
                      height="32"
                    >
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                  </div>
                  <h4>Custom Form</h4>
                  <p>{FORM_TEMPLATES.custom.description}</p>
                </label>
              </div>
            </div>
          </OnboardingStep>
        );

      case 2:
        // Step 3: Customize Form
        return (
          <OnboardingStep
            stepNumber={3}
            totalSteps={6}
            title="Customize Your Form"
            description="You can add more fields and customize your form later"
            onNext={nextStep}
            onPrevious={previousStep}
            onSkip={handleSkip}
          >
            <div className="form-preview">
              <div className="preview-info">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="24"
                  height="24"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <p>
                  Your form has been created! You can customize it further from the
                  form builder. For now, let&apos;s continue with the onboarding.
                </p>
              </div>

              <div className="form-builder-tips">
                <h4>Form Builder Features:</h4>
                <ul>
                  <li>Drag and drop to reorder fields</li>
                  <li>Click on any field to edit properties</li>
                  <li>Add validation rules and conditional logic</li>
                  <li>Configure spam protection and notifications</li>
                </ul>
              </div>
            </div>
          </OnboardingStep>
        );

      case 3:
        // Step 4: Understand Encryption
        return (
          <OnboardingStep
            stepNumber={4}
            totalSteps={6}
            title="Understanding Encryption"
            description="Your private key is critical for decrypting submissions"
            onNext={nextStep}
            onPrevious={previousStep}
            onSkip={handleSkip}
          >
            <div className="encryption-explanation">
              <div className="encryption-diagram">
                <div className="diagram-step">
                  <div className="diagram-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="32"
                      height="32"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                  <p>User fills form</p>
                </div>
                <div className="diagram-arrow">→</div>
                <div className="diagram-step">
                  <div className="diagram-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="32"
                      height="32"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <p>Encrypted in browser</p>
                </div>
                <div className="diagram-arrow">→</div>
                <div className="diagram-step">
                  <div className="diagram-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="32"
                      height="32"
                    >
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    </svg>
                  </div>
                  <p>Stored encrypted</p>
                </div>
              </div>

              <div className="warning-box">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="24"
                  height="24"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <div>
                  <strong>Important: Keep your private key safe!</strong>
                  <p>
                    We cannot recover your private key. Without it, you will not be
                    able to decrypt your form submissions. Store it securely offline.
                  </p>
                </div>
              </div>

              <div className="key-download">
                <h4>Your Private Key:</h4>
                <textarea
                  readOnly
                  rows={6}
                  value={privateKey}
                  className="key-display"
                />
                <div className="key-actions">
                  <button
                    onClick={() => copyToClipboard(privateKey)}
                    className="btn btn-secondary"
                  >
                    Copy to Clipboard
                  </button>
                  <button onClick={downloadPrivateKey} className="btn btn-primary">
                    Download as File
                  </button>
                </div>
              </div>
            </div>
          </OnboardingStep>
        );

      case 4:
        // Step 5: Embed Your Form
        return (
          <OnboardingStep
            stepNumber={5}
            totalSteps={6}
            title="Embed Your Form"
            description="Add your form to any website with our embed code"
            onNext={nextStep}
            onPrevious={previousStep}
            onSkip={handleSkip}
          >
            <div className="embed-instructions">
              <p>
                Copy the code below and paste it into your website where you want
                the form to appear.
              </p>

              <div className="code-block">
                <pre>
                  <code>{embedCode}</code>
                </pre>
                <button
                  onClick={() => copyToClipboard(embedCode)}
                  className="copy-button"
                  title="Copy to clipboard"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="16"
                    height="16"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>

              <div className="integration-options">
                <h4>Other Integration Options:</h4>
                <div className="option-list">
                  <div className="option-item">
                    <strong>React/Vue/Angular:</strong>
                    <p>Use our JavaScript SDK for seamless integration</p>
                  </div>
                  <div className="option-item">
                    <strong>WordPress:</strong>
                    <p>Install our WordPress plugin</p>
                  </div>
                  <div className="option-item">
                    <strong>Direct Link:</strong>
                    <p>Share a standalone form URL</p>
                  </div>
                </div>
              </div>
            </div>
          </OnboardingStep>
        );

      case 5:
        // Step 6: Complete
        return (
          <OnboardingStep
            stepNumber={6}
            totalSteps={6}
            title="You're All Set!"
            description="Start collecting encrypted form submissions"
            onNext={handleFinish}
            onPrevious={previousStep}
            nextLabel="Go to Dashboard"
            showSkip={false}
          >
            <div className="onboarding-complete">
              <div className="success-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="64"
                  height="64"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h3>Congratulations!</h3>
              <p>You&apos;ve created your first encrypted form.</p>

              <div className="next-steps">
                <h4>What&apos;s Next?</h4>
                <div className="next-steps-grid">
                  <div className="next-step-card">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="24"
                      height="24"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="12" y1="8" x2="12" y2="16"></line>
                      <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                    <h5>Create More Forms</h5>
                    <p>Build forms for different use cases</p>
                  </div>
                  <div className="next-step-card">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="24"
                      height="24"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <h5>Read the Docs</h5>
                    <p>Learn about advanced features</p>
                  </div>
                  <div className="next-step-card">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="24"
                      height="24"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <h5>Get Support</h5>
                    <p>We&apos;re here to help you succeed</p>
                  </div>
                </div>
              </div>
            </div>
          </OnboardingStep>
        );

      default:
        return null;
    }
  };

  return <div className="onboarding-wizard">{renderStep()}</div>;
}
