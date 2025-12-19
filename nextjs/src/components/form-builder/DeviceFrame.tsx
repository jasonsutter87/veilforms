/**
 * VeilForms - Device Frame Component
 * Simulates different device viewports for form preview
 */

"use client";

import { ReactNode } from "react";

export type DeviceType = "desktop" | "tablet" | "mobile";

interface DeviceFrameProps {
  device: DeviceType;
  children: ReactNode;
}

const DEVICE_WIDTHS = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
} as const;

const DEVICE_HEIGHTS = {
  desktop: "100%",
  tablet: "1024px",
  mobile: "667px",
} as const;

const DEVICE_LABELS = {
  desktop: "Desktop",
  tablet: "Tablet (768px)",
  mobile: "Mobile (375px)",
} as const;

export function DeviceFrame({ device, children }: DeviceFrameProps) {
  return (
    <div className="device-frame-wrapper">
      <div className="device-label">{DEVICE_LABELS[device]}</div>
      <div
        className={`device-frame device-${device}`}
        style={{
          width: DEVICE_WIDTHS[device],
          maxHeight: DEVICE_HEIGHTS[device],
        }}
      >
        <div className="device-content">
          {children}
        </div>
      </div>

      <style jsx>{`
        .device-frame-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          width: 100%;
          height: 100%;
          overflow: auto;
          padding: 2rem;
          background: var(--color-surface-secondary, #f5f5f5);
        }

        .device-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-secondary, #666);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .device-frame {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
                      0 2px 4px -1px rgba(0, 0, 0, 0.06);
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .device-frame.device-desktop {
          width: 100%;
          max-width: 1200px;
        }

        .device-frame.device-tablet {
          border: 2px solid #ddd;
        }

        .device-frame.device-mobile {
          border: 2px solid #ddd;
        }

        .device-content {
          width: 100%;
          height: 100%;
          overflow-y: auto;
          background: white;
        }

        /* Scrollbar styling */
        .device-content::-webkit-scrollbar {
          width: 8px;
        }

        .device-content::-webkit-scrollbar-track {
          background: #f1f1f1;
        }

        .device-content::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }

        .device-content::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
}
