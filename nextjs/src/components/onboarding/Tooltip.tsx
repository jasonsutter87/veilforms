/**
 * VeilForms - Tooltip Component
 * Display contextual help tooltips for first-time users
 */

'use client';

import React, { useEffect, useState, useRef } from 'react';
import { markTooltipSeen, hasSeenTooltip, type TooltipConfig } from '@/lib/onboarding';

interface TooltipProps extends TooltipConfig {
  isVisible?: boolean;
  onClose?: () => void;
}

export function Tooltip({
  id,
  target,
  title,
  content,
  position = 'bottom',
  showOnce = true,
  isVisible = true,
  onClose,
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if tooltip should be shown
    if (showOnce && hasSeenTooltip(id)) {
      setShow(false);
      return;
    }

    if (!isVisible) {
      setShow(false);
      return;
    }

    // Find target element
    const targetElement = document.querySelector(target);
    if (!targetElement) {
      setShow(false);
      return;
    }

    // Calculate position
    const rect = targetElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top + scrollTop - 10;
        left = rect.left + scrollLeft + rect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + scrollTop + 10;
        left = rect.left + scrollLeft + rect.width / 2;
        break;
      case 'left':
        top = rect.top + scrollTop + rect.height / 2;
        left = rect.left + scrollLeft - 10;
        break;
      case 'right':
        top = rect.top + scrollTop + rect.height / 2;
        left = rect.right + scrollLeft + 10;
        break;
    }

    setCoords({ top, left });
    setShow(true);
  }, [id, target, position, showOnce, isVisible]);

  const handleClose = () => {
    if (showOnce) {
      markTooltipSeen(id);
    }
    setShow(false);
    onClose?.();
  };

  if (!show) return null;

  return (
    <div
      ref={tooltipRef}
      className={`onboarding-tooltip tooltip-${position}`}
      style={{
        position: 'absolute',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
      }}
      role="tooltip"
      aria-live="polite"
    >
      <div className="tooltip-content">
        <div className="tooltip-header">
          <h4 className="tooltip-title">{title}</h4>
          <button
            className="tooltip-close"
            onClick={handleClose}
            aria-label="Close tooltip"
          >
            &times;
          </button>
        </div>
        <p className="tooltip-text">{content}</p>
      </div>
      <div className="tooltip-arrow"></div>
    </div>
  );
}

interface TooltipManagerProps {
  tooltips: TooltipConfig[];
  active?: boolean;
}

/**
 * TooltipManager - Manages multiple tooltips
 */
export function TooltipManager({ tooltips, active = true }: TooltipManagerProps) {
  const [visibleTooltips, setVisibleTooltips] = useState<string[]>([]);

  useEffect(() => {
    if (!active) {
      setVisibleTooltips([]);
      return;
    }

    // Show tooltips that haven't been seen
    const toShow = tooltips
      .filter((t) => !t.showOnce || !hasSeenTooltip(t.id))
      .map((t) => t.id);

    setVisibleTooltips(toShow);
  }, [tooltips, active]);

  const handleClose = (id: string) => {
    setVisibleTooltips((prev) => prev.filter((tid) => tid !== id));
  };

  return (
    <>
      {tooltips.map((tooltip) => (
        <Tooltip
          key={tooltip.id}
          {...tooltip}
          isVisible={visibleTooltips.includes(tooltip.id)}
          onClose={() => handleClose(tooltip.id)}
        />
      ))}
    </>
  );
}
