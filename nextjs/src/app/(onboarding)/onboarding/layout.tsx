/**
 * VeilForms - Onboarding Layout
 * Clean layout for the onboarding experience
 */

'use client';

import React from 'react';
import Link from 'next/link';
import '@/styles/onboarding.scss';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="onboarding-layout">
      <header className="onboarding-header">
        <Link href="/" className="onboarding-logo">
          <span className="logo-veil">Veil</span>
          <span className="logo-forms">Forms</span>
        </Link>
      </header>

      <main className="onboarding-main">{children}</main>

      <footer className="onboarding-footer">
        <p>
          Need help? <a href="/docs">View documentation</a> or{' '}
          <a href="/support">contact support</a>
        </p>
      </footer>
    </div>
  );
}
