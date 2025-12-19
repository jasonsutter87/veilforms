/**
 * VeilForms - Form Preview Renderer
 * Renders form fields as respondents will see them
 */

"use client";

import { useState, FormEvent } from "react";
import type { FormField } from "@/store/dashboard";
import { evaluateFieldVisibility } from "@/lib/conditional-logic";

interface FormPreviewRendererProps {
  formName: string;
  fields: FormField[];
  isPreview?: boolean;
  onSubmit?: (data: Record<string, unknown>) => void;
}

export function FormPreviewRenderer({
  formName,
  fields,
  isPreview = true,
  onSubmit,
}: FormPreviewRendererProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Handle field value change
  const handleChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Check if field should be visible based on conditional logic
  const isFieldVisible = (field: FormField): boolean => {
    return evaluateFieldVisibility(field, formData);
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      // Skip validation for hidden/non-input fields
      if (["heading", "paragraph", "divider", "hidden"].includes(field.type)) {
        return;
      }

      // Skip validation for fields hidden by conditional logic
      if (!isFieldVisible(field)) {
        return;
      }

      // Check required fields
      if (field.required) {
        const value = formData[field.name];
        if (value === undefined || value === null || value === "") {
          newErrors[field.name] = `${field.label} is required`;
        }
      }

      // Validate email
      if (field.type === "email" && formData[field.name]) {
        const email = String(formData[field.name]);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          newErrors[field.name] = "Please enter a valid email address";
        }
      }

      // Validate URL
      if (field.type === "url" && formData[field.name]) {
        const url = String(formData[field.name]);
        try {
          new URL(url);
        } catch {
          newErrors[field.name] = "Please enter a valid URL";
        }
      }

      // Validate phone
      if (field.type === "phone" && formData[field.name]) {
        const phone = String(formData[field.name]);
        if (!/^[\d\s\-\+\(\)]+$/.test(phone)) {
          newErrors[field.name] = "Please enter a valid phone number";
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    // In preview mode, just show success message
    if (isPreview) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSubmitted(true);
      setSubmitting(false);
      return;
    }

    // In production, call the onSubmit handler
    if (onSubmit) {
      try {
        await onSubmit(formData);
        setSubmitted(true);
      } catch (err) {
        console.error("Form submission error:", err);
        setErrors({ _form: "Submission failed. Please try again." });
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Render success message
  if (submitted) {
    return (
      <div className="preview-success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <h3>Form Submitted Successfully!</h3>
        {isPreview && (
          <p className="preview-note">This is preview mode - no data was actually submitted.</p>
        )}
        <button
          className="btn btn-primary"
          onClick={() => {
            setSubmitted(false);
            setFormData({});
            setErrors({});
          }}
        >
          Submit Another Response
        </button>
      </div>
    );
  }

  return (
    <div className="form-preview-renderer">
      <form onSubmit={handleSubmit} className="preview-form">
        <h2 className="form-title">{formName}</h2>

        {errors._form && (
          <div className="form-error">{errors._form}</div>
        )}

        {fields.map((field) => {
          // Skip hidden fields and fields with conditional logic that evaluates to false
          if (!isFieldVisible(field)) {
            return null;
          }

          return (
            <div key={field.id} className={`form-field field-${field.type}`}>
              {renderField(field, formData, handleChange, errors[field.name])}
            </div>
          );
        })}

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>

      <style jsx>{`
        .form-preview-renderer {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          padding: 2rem;
        }

        .preview-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-title {
          font-size: 1.75rem;
          font-weight: 600;
          color: var(--color-text-primary, #1a1a1a);
          margin: 0 0 1rem 0;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-error {
          padding: 0.75rem;
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 4px;
          color: #c00;
          font-size: 0.875rem;
        }

        .form-actions {
          margin-top: 1rem;
        }

        .preview-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 3rem 2rem;
          text-align: center;
        }

        .preview-success svg {
          color: var(--color-success, #22c55e);
        }

        .preview-success h3 {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--color-text-primary, #1a1a1a);
          margin: 0;
        }

        .preview-note {
          color: var(--color-text-secondary, #666);
          font-size: 0.875rem;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: var(--color-primary, #3b82f6);
          color: white;
        }

        .btn-primary:hover {
          background: var(--color-primary-dark, #2563eb);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

// Render individual field
function renderField(
  field: FormField,
  formData: Record<string, unknown>,
  onChange: (name: string, value: unknown) => void,
  error?: string
) {
  const value = formData[field.name] || "";

  switch (field.type) {
    case "heading":
      return <h3 className="field-heading">{field.label}</h3>;

    case "paragraph":
      return <p className="field-paragraph">{field.label}</p>;

    case "divider":
      return <hr className="field-divider" />;

    case "text":
    case "email":
    case "url":
    case "phone":
    case "number":
    case "date":
      return (
        <>
          <label htmlFor={field.id}>
            {field.label}
            {field.required && <span className="required">*</span>}
          </label>
          <input
            type={field.type}
            id={field.id}
            name={field.name}
            placeholder={field.placeholder}
            required={field.required}
            value={String(value)}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={error ? "error" : ""}
          />
          {error && <span className="error-message">{error}</span>}
        </>
      );

    case "textarea":
      return (
        <>
          <label htmlFor={field.id}>
            {field.label}
            {field.required && <span className="required">*</span>}
          </label>
          <textarea
            id={field.id}
            name={field.name}
            placeholder={field.placeholder}
            required={field.required}
            value={String(value)}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={error ? "error" : ""}
            rows={4}
          />
          {error && <span className="error-message">{error}</span>}
        </>
      );

    case "select":
      return (
        <>
          <label htmlFor={field.id}>
            {field.label}
            {field.required && <span className="required">*</span>}
          </label>
          <select
            id={field.id}
            name={field.name}
            required={field.required}
            value={String(value)}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={error ? "error" : ""}
          >
            <option value="">Select an option...</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
          {error && <span className="error-message">{error}</span>}
        </>
      );

    case "checkbox":
      return (
        <label className="checkbox-label">
          <input
            type="checkbox"
            id={field.id}
            name={field.name}
            required={field.required}
            checked={Boolean(value)}
            onChange={(e) => onChange(field.name, e.target.checked)}
          />
          <span>
            {field.label}
            {field.required && <span className="required">*</span>}
          </span>
          {error && <span className="error-message">{error}</span>}
        </label>
      );

    case "radio":
      return (
        <>
          <label>
            {field.label}
            {field.required && <span className="required">*</span>}
          </label>
          <div className="radio-group">
            {field.options?.map((option, index) => (
              <label key={index} className="radio-label">
                <input
                  type="radio"
                  name={field.name}
                  value={option}
                  required={field.required}
                  checked={value === option}
                  onChange={(e) => onChange(field.name, e.target.value)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
          {error && <span className="error-message">{error}</span>}
        </>
      );

    default:
      return null;
  }
}
