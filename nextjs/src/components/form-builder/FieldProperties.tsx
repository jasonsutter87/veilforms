/**
 * VeilForms - Field Properties Panel
 */

"use client";

import { useState, memo } from "react";
import type { FormField } from "@/store/dashboard";
import { supportsOptions, supportsPlaceholder, supportsRequired, isFileField, type FieldType, type FileFieldValidation } from "@/lib/field-types";
import { ConditionBuilder } from "./ConditionBuilder";
import type { ConditionalLogic } from "@/lib/conditional-logic";
import { FILE_STORAGE_CONFIG } from "@/lib/file-storage";

interface FieldPropertiesProps {
  field: FormField;
  allFields?: FormField[];
  onUpdate: (updates: Partial<FormField>) => void;
  onClose: () => void;
}

export const FieldProperties = memo(function FieldProperties({ field, allFields = [], onUpdate, onClose }: FieldPropertiesProps) {
  const [activeTab, setActiveTab] = useState<"properties" | "logic">("properties");
  const [options, setOptions] = useState<string[]>(field.options || []);

  const handleAddOption = () => {
    const newOptions = [...options, `Option ${options.length + 1}`];
    setOptions(newOptions);
    onUpdate({ options: newOptions });
  };

  const handleUpdateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    onUpdate({ options: newOptions });
  };

  const handleDeleteOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    onUpdate({ options: newOptions });
  };

  const showOptions = supportsOptions(field.type as FieldType);
  const showPlaceholder = supportsPlaceholder(field.type as FieldType);
  const showRequired = supportsRequired(field.type as FieldType);
  const canHaveLogic = !["heading", "paragraph", "divider"].includes(field.type);

  const handleLogicUpdate = (logic: ConditionalLogic) => {
    onUpdate({ conditionalLogic: logic });
  };

  return (
    <aside className="field-properties" style={{ display: "block" }}>
      <div className="properties-header">
        <h3>Field Properties</h3>
        <button className="properties-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </div>

      {canHaveLogic && (
        <div className="properties-tabs">
          <button
            className={`tab ${activeTab === "properties" ? "active" : ""}`}
            onClick={() => setActiveTab("properties")}
          >
            Properties
          </button>
          <button
            className={`tab ${activeTab === "logic" ? "active" : ""}`}
            onClick={() => setActiveTab("logic")}
          >
            Logic
            {field.conditionalLogic?.enabled && (
              <span className="tab-indicator" title="Has conditional logic">●</span>
            )}
          </button>
        </div>
      )}

      <div className="properties-body">
        {activeTab === "properties" && (
          <>
            {/* Label */}
            {field.type !== "divider" && (
              <div className="form-group">
                <label htmlFor="prop-label">Label</label>
                <input
                  type="text"
                  id="prop-label"
                  value={field.label}
                  onChange={(e) => onUpdate({ label: e.target.value })}
                />
              </div>
            )}

            {/* Field Name */}
            {!["heading", "paragraph", "divider"].includes(field.type) && (
              <div className="form-group">
                <label htmlFor="prop-name">Field Name</label>
                <input
                  type="text"
                  id="prop-name"
                  value={field.name}
                  onChange={(e) => onUpdate({ name: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
                />
                <small>Used in form data (no spaces)</small>
              </div>
            )}

            {/* Placeholder */}
            {showPlaceholder && (
              <div className="form-group">
                <label htmlFor="prop-placeholder">Placeholder</label>
                <input
                  type="text"
                  id="prop-placeholder"
                  value={field.placeholder || ""}
                  onChange={(e) => onUpdate({ placeholder: e.target.value })}
                />
              </div>
            )}

            {/* Required */}
            {showRequired && (
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={field.required || false}
                    onChange={(e) => onUpdate({ required: e.target.checked })}
                  />
                  Required field
                </label>
              </div>
            )}

            {/* Options for select/radio/checkbox */}
            {showOptions && field.type !== "checkbox" && (
              <div className="form-group">
                <label>Options</label>
                <div className="options-list">
                  {options.map((opt, index) => (
                    <div key={index} className="option-item">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleUpdateOption(index, e.target.value)}
                      />
                      <button
                        type="button"
                        className="option-delete"
                        onClick={() => handleDeleteOption(index)}
                        aria-label="Delete option"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddOption}>
                  + Add Option
                </button>
              </div>
            )}

            {/* Hidden field value */}
            {field.type === "hidden" && (
              <div className="form-group">
                <label htmlFor="prop-default">Default Value</label>
                <input
                  type="text"
                  id="prop-default"
                  value={(field.validation as Record<string, string>)?.default || ""}
                  onChange={(e) => onUpdate({ validation: { ...field.validation, default: e.target.value } })}
                />
                <small>Pre-filled value for this hidden field</small>
              </div>
            )}

            {/* Number validation */}
            {field.type === "number" && (
              <>
                <div className="form-group">
                  <label htmlFor="prop-min">Minimum Value</label>
                  <input
                    type="number"
                    id="prop-min"
                    value={(field.validation as Record<string, number>)?.min || ""}
                    onChange={(e) => onUpdate({ validation: { ...field.validation, min: e.target.value ? Number(e.target.value) : undefined } })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="prop-max">Maximum Value</label>
                  <input
                    type="number"
                    id="prop-max"
                    value={(field.validation as Record<string, number>)?.max || ""}
                    onChange={(e) => onUpdate({ validation: { ...field.validation, max: e.target.value ? Number(e.target.value) : undefined } })}
                  />
                </div>
              </>
            )}

            {/* Text validation */}
            {["text", "textarea"].includes(field.type) && (
              <>
                <div className="form-group">
                  <label htmlFor="prop-minlength">Min Length</label>
                  <input
                    type="number"
                    id="prop-minlength"
                    min="0"
                    value={(field.validation as Record<string, number>)?.minLength || ""}
                    onChange={(e) => onUpdate({ validation: { ...field.validation, minLength: e.target.value ? Number(e.target.value) : undefined } })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="prop-maxlength">Max Length</label>
                  <input
                    type="number"
                    id="prop-maxlength"
                    min="0"
                    value={(field.validation as Record<string, number>)?.maxLength || ""}
                    onChange={(e) => onUpdate({ validation: { ...field.validation, maxLength: e.target.value ? Number(e.target.value) : undefined } })}
                  />
                </div>
              </>
            )}

            {/* File validation */}
            {isFileField(field.type as FieldType) && (
              <>
                <div className="form-group">
                  <label htmlFor="prop-maxsize">Max File Size (MB)</label>
                  <input
                    type="number"
                    id="prop-maxsize"
                    min="1"
                    max="50"
                    value={(field.validation as FileFieldValidation)?.maxSize || FILE_STORAGE_CONFIG.DEFAULT_MAX_SIZE_MB}
                    onChange={(e) => onUpdate({
                      validation: {
                        ...field.validation,
                        maxSize: e.target.value ? Number(e.target.value) : FILE_STORAGE_CONFIG.DEFAULT_MAX_SIZE_MB
                      }
                    })}
                  />
                  <small>Maximum: 50 MB</small>
                </div>
                <div className="form-group">
                  <label htmlFor="prop-maxfiles">Max Number of Files</label>
                  <input
                    type="number"
                    id="prop-maxfiles"
                    min="1"
                    max="10"
                    value={(field.validation as FileFieldValidation)?.maxFiles || 1}
                    onChange={(e) => onUpdate({
                      validation: {
                        ...field.validation,
                        maxFiles: e.target.value ? Number(e.target.value) : 1
                      }
                    })}
                  />
                  <small>Maximum: 10 files</small>
                </div>
                <div className="form-group">
                  <label htmlFor="prop-allowedtypes">Allowed File Types</label>
                  <input
                    type="text"
                    id="prop-allowedtypes"
                    value={(field.validation as FileFieldValidation)?.allowedTypes?.join(", ") || ""}
                    onChange={(e) => onUpdate({
                      validation: {
                        ...field.validation,
                        allowedTypes: e.target.value ? e.target.value.split(",").map(t => t.trim()).filter(Boolean) : undefined
                      }
                    })}
                    placeholder="image/*, .pdf, .doc"
                  />
                  <small>MIME types or extensions (comma-separated). Leave empty for all types.</small>
                </div>
              </>
            )}

            {/* Field type indicator */}
            <div className="field-type-indicator">
              <small>Type: {field.type}</small>
            </div>
          </>
        )}

        {activeTab === "logic" && canHaveLogic && (
          <div className="logic-section">
            <ConditionBuilder
              field={field}
              allFields={allFields}
              onUpdate={handleLogicUpdate}
            />
          </div>
        )}
      </div>
    </aside>
  );
});
