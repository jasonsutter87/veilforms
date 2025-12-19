/**
 * VeilForms - EmptyState Component
 * Friendly empty state display with action prompts
 */

import React from 'react';
import Link from 'next/link';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  const defaultIcon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      width="64"
      height="64"
      className="empty-state-icon-svg"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="12" y1="8" x2="12" y2="16"></line>
      <line x1="8" y1="12" x2="16" y2="12"></line>
    </svg>
  );

  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon || defaultIcon}</div>
      <h2 className="empty-state-title">{title}</h2>
      <p className="empty-state-description">{description}</p>
      {(action || secondaryAction) && (
        <div className="empty-state-actions">
          {action && (
            <>
              {action.href ? (
                <Link href={action.href} className="btn btn-primary">
                  {action.label}
                </Link>
              ) : (
                <button onClick={action.onClick} className="btn btn-primary">
                  {action.label}
                </button>
              )}
            </>
          )}
          {secondaryAction && (
            <>
              {secondaryAction.href ? (
                <Link href={secondaryAction.href} className="btn btn-secondary">
                  {secondaryAction.label}
                </Link>
              ) : (
                <button
                  onClick={secondaryAction.onClick}
                  className="btn btn-secondary"
                >
                  {secondaryAction.label}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
