/**
 * VeilForms - Form Builder Component
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { FieldPalette } from "./FieldPalette";
import { FormCanvas } from "./FormCanvas";
import { FieldProperties } from "./FieldProperties";
import { SortableField } from "./SortableField";
import { PreviewModal } from "./PreviewModal";
import type { FormField } from "@/store/dashboard";
import { useHistory } from "@/hooks/useHistory";
import { cleanupDeletedFieldReferences } from "@/lib/conditional-logic";

interface FormBuilderProps {
  formId: string;
  formName: string;
  initialFields?: FormField[];
  onSave: (fields: FormField[]) => Promise<void>;
  onBack: () => void;
}

// Generate unique ID
function generateId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Default field configurations - frozen to prevent accidental mutation
const FIELD_DEFAULTS: Record<string, Partial<FormField>> = {
  text: { type: "text", label: "Text Field", placeholder: "Enter text..." },
  email: { type: "email", label: "Email", placeholder: "email@example.com" },
  textarea: { type: "textarea", label: "Message", placeholder: "Enter your message..." },
  number: { type: "number", label: "Number", placeholder: "0" },
  phone: { type: "phone", label: "Phone", placeholder: "(555) 555-5555" },
  select: { type: "select", label: "Dropdown", options: ["Option 1", "Option 2", "Option 3"] },
  checkbox: { type: "checkbox", label: "Checkbox" },
  radio: { type: "radio", label: "Radio Group", options: ["Option 1", "Option 2", "Option 3"] },
  date: { type: "date", label: "Date" },
  url: { type: "url", label: "Website", placeholder: "https://" },
  hidden: { type: "hidden", label: "Hidden Field", name: "hidden_field" },
  heading: { type: "heading", label: "Section Heading" },
  paragraph: { type: "paragraph", label: "Add description text here..." },
  divider: { type: "divider", label: "" },
};

export function FormBuilder({ formId, formName, initialFields = [], onSave, onBack }: FormBuilderProps) {
  const {
    state: historyState,
    pushState: setFields,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<FormField[]>(initialFields);

  // Ensure fields is always an array
  const fields = historyState ?? [];

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undo();
        }
      } else if (isMod && (e.key === 'Z' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        if (canRedo) {
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  // Add field from palette - uses functional update to avoid dependency on fields
  const handleAddField = useCallback((fieldType: string) => {
    const defaults = FIELD_DEFAULTS[fieldType] || { type: fieldType, label: fieldType };
    const newField: FormField = {
      id: generateId(),
      name: `${fieldType}_${Date.now()}`,
      ...defaults,
    } as FormField;

    setFields((prevFields: FormField[]) => [...prevFields, newField]);
    setSelectedFieldId(newField.id);
  }, [setFields]);

  // Update field - uses functional update to avoid dependency on fields
  const handleUpdateField = useCallback((id: string, updates: Partial<FormField>) => {
    setFields((prevFields: FormField[]) => {
      const index = prevFields.findIndex((f: FormField) => f.id === id);
      if (index === -1) return prevFields;
      const existing = prevFields[index];
      if (!existing) return prevFields;
      const newFields = [...prevFields];
      newFields[index] = { ...existing, ...updates };
      return newFields;
    });
  }, [setFields]);

  // Delete field - uses functional update to avoid dependency on fields
  const handleDeleteField = useCallback((id: string) => {
    setFields((prevFields: FormField[]) => {
      const filtered = prevFields.filter((f: FormField) => f.id !== id);
      // Clean up any conditional logic references to the deleted field
      return cleanupDeletedFieldReferences(filtered, id);
    });
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
  }, [setFields, selectedFieldId]);

  // Duplicate field - uses functional update to avoid dependency on fields
  const handleDuplicateField = useCallback((id: string) => {
    setFields((prevFields: FormField[]) => {
      const field = prevFields.find((f: FormField) => f.id === id);
      if (!field) return prevFields;

      const newField: FormField = {
        ...field,
        id: generateId(),
        name: `${field.name}_copy`,
        label: `${field.label} (Copy)`,
      };
      const index = prevFields.findIndex((f: FormField) => f.id === id);
      const newFields = [
        ...prevFields.slice(0, index + 1),
        newField,
        ...prevFields.slice(index + 1),
      ];

      setSelectedFieldId(newField.id);
      return newFields;
    });
  }, [setFields]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // If dragging from palette
    if (active.id.toString().startsWith("palette-")) {
      const fieldType = active.id.toString().replace("palette-", "");
      handleAddField(fieldType);
      return;
    }

    // Reordering existing fields - uses functional update to avoid dependency on fields
    if (active.id !== over.id) {
      setFields((prevFields: FormField[]) => {
        const oldIndex = prevFields.findIndex((f: FormField) => f.id === active.id);
        const newIndex = prevFields.findIndex((f: FormField) => f.id === over.id);
        return arrayMove(prevFields, oldIndex, newIndex);
      });
    }
  };

  // Save form
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(fields);
    } finally {
      setSaving(false);
    }
  };

  const activeField = activeId ? fields.find((f) => f.id === activeId) : null;

  return (
    <div className="form-builder-view" style={{ display: "block" }}>
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="form-builder-layout">
          {/* Field Palette */}
          <FieldPalette onAddField={handleAddField} />

          {/* Form Canvas */}
          <div className="form-canvas-wrapper">
            <div className="canvas-header">
              <button className="btn btn-secondary" onClick={onBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                <span>Back</span>
              </button>
              <div className="canvas-actions">
                <button
                  className="btn btn-secondary"
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo (Cmd/Ctrl+Z)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M3 7v6h6"></path>
                    <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"></path>
                  </svg>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo (Cmd/Ctrl+Shift+Z)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M21 7v6h-6"></path>
                    <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"></path>
                  </svg>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setPreviewOpen(true)}
                  title="Preview Form"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <span>Preview</span>
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Form"}
                </button>
              </div>
            </div>

            <div className="form-canvas">
              {fields.length === 0 ? (
                <div className="canvas-dropzone">
                  <div className="dropzone-hint">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <p>Drag fields here to build your form</p>
                    <p className="hint-sub">or click a field type to add it</p>
                  </div>
                </div>
              ) : (
                <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                  <FormCanvas
                    fields={fields}
                    selectedFieldId={selectedFieldId}
                    onSelectField={setSelectedFieldId}
                    onDeleteField={handleDeleteField}
                    onDuplicateField={handleDuplicateField}
                  />
                </SortableContext>
              )}
            </div>
          </div>

          {/* Field Properties Panel */}
          {selectedField && (
            <FieldProperties
              field={selectedField}
              allFields={fields}
              onUpdate={(updates) => handleUpdateField(selectedField.id, updates)}
              onClose={() => setSelectedFieldId(null)}
            />
          )}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeField && (
            <div className="field-item dragging">
              <span className="field-label">{activeField.label}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Preview Modal */}
      <PreviewModal
        formId={formId}
        formName={formName}
        fields={fields}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
