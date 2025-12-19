/**
 * VeilForms - Centralized Field Type Definitions
 * Single source of truth for all supported field types
 */

export type FieldType =
  | "text"
  | "email"
  | "textarea"
  | "number"
  | "phone"
  | "select"
  | "checkbox"
  | "radio"
  | "date"
  | "url"
  | "file"
  | "hidden"
  | "heading"
  | "paragraph"
  | "divider";

export interface FieldTypeConfig {
  type: FieldType;
  label: string;
  icon: string;
}

/**
 * Complete list of all supported field types with their metadata
 * Frozen to prevent accidental mutation
 */
export const FIELD_TYPES = Object.freeze([
  Object.freeze({ type: "text" as const, label: "Text", icon: "T" }),
  Object.freeze({ type: "email" as const, label: "Email", icon: "@" }),
  Object.freeze({ type: "textarea" as const, label: "Text Area", icon: "P" }),
  Object.freeze({ type: "number" as const, label: "Number", icon: "#" }),
  Object.freeze({ type: "phone" as const, label: "Phone", icon: "P" }),
  Object.freeze({ type: "select" as const, label: "Dropdown", icon: "v" }),
  Object.freeze({ type: "checkbox" as const, label: "Checkbox", icon: "x" }),
  Object.freeze({ type: "radio" as const, label: "Radio", icon: "o" }),
  Object.freeze({ type: "date" as const, label: "Date", icon: "D" }),
  Object.freeze({ type: "url" as const, label: "URL", icon: "/" }),
  Object.freeze({ type: "file" as const, label: "File Upload", icon: "📎" }),
  Object.freeze({ type: "hidden" as const, label: "Hidden", icon: "-" }),
  Object.freeze({ type: "heading" as const, label: "Heading", icon: "H" }),
  Object.freeze({ type: "paragraph" as const, label: "Paragraph", icon: "=" }),
  Object.freeze({ type: "divider" as const, label: "Divider", icon: "_" }),
]) as readonly FieldTypeConfig[];

/**
 * Field types that support placeholder text
 * Frozen to prevent accidental mutation
 */
export const FIELD_TYPES_WITH_PLACEHOLDER = Object.freeze([
  "text",
  "email",
  "textarea",
  "number",
  "phone",
  "url",
] as const) as readonly FieldType[];

/**
 * Field types that support options (select, radio, checkbox)
 * Frozen to prevent accidental mutation
 */
export const FIELD_TYPES_WITH_OPTIONS = Object.freeze([
  "select",
  "radio",
  "checkbox",
] as const) as readonly FieldType[];

/**
 * Field types that can be marked as required
 * Frozen to prevent accidental mutation
 */
export const FIELD_TYPES_WITH_REQUIRED = Object.freeze([
  "text",
  "email",
  "textarea",
  "number",
  "phone",
  "select",
  "checkbox",
  "radio",
  "date",
  "url",
  "file",
] as const) as readonly FieldType[];

/**
 * Field types that are non-interactive (display-only)
 * Frozen to prevent accidental mutation
 */
export const FIELD_TYPES_NON_INTERACTIVE = Object.freeze([
  "heading",
  "paragraph",
  "divider",
  "hidden",
] as const) as readonly FieldType[];

/**
 * Check if a field type supports placeholder text
 */
export function supportsPlaceholder(fieldType: FieldType): boolean {
  return FIELD_TYPES_WITH_PLACEHOLDER.includes(fieldType);
}

/**
 * Check if a field type supports options
 */
export function supportsOptions(fieldType: FieldType): boolean {
  return FIELD_TYPES_WITH_OPTIONS.includes(fieldType);
}

/**
 * Check if a field type can be marked as required
 */
export function supportsRequired(fieldType: FieldType): boolean {
  return FIELD_TYPES_WITH_REQUIRED.includes(fieldType);
}

/**
 * Check if a field type is non-interactive
 */
export function isNonInteractive(fieldType: FieldType): boolean {
  return FIELD_TYPES_NON_INTERACTIVE.includes(fieldType);
}

/**
 * Check if a field type is a file upload field
 */
export function isFileField(fieldType: FieldType): boolean {
  return fieldType === "file";
}

/**
 * File field validation properties
 */
export interface FileFieldValidation {
  maxSize?: number;        // Max file size in MB (default: 10)
  maxFiles?: number;       // Max number of files (default: 1)
  allowedTypes?: string[]; // MIME types or extensions (default: all)
}
