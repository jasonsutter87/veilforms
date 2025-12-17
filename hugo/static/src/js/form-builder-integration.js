// Form Builder UX Integration
// This file patches existing dashboard.js functions to use the new UX enhancements

// Wait for DOM and existing scripts to load
document.addEventListener('DOMContentLoaded', () => {
  // Only run if we're on the dashboard with form builder
  if (!document.getElementById('form-builder-view')) return;

  // Make formBuilder globally accessible for UX functions
  if (typeof formBuilder !== 'undefined') {
    window.formBuilder = formBuilder;
  }

  // Make utility functions globally accessible
  if (typeof hide !== 'undefined') window.hide = hide;
  if (typeof show !== 'undefined') window.show = show;
  if (typeof escapeHtml !== 'undefined') window.escapeHtml = escapeHtml;
  if (typeof deleteField !== 'undefined') window.deleteField = deleteField;
  if (typeof selectField !== 'undefined') window.selectField = selectField;

  // Patch showFormBuilder to add keyboard shortcuts and hints
  const originalShowFormBuilder = window.showFormBuilder;
  if (originalShowFormBuilder) {
    window.showFormBuilder = function(formId, formName, existingFields = []) {
      // Call original function
      originalShowFormBuilder.call(this, formId, formName, existingFields);

      // Add UX enhancements
      if (window.initFormBuilderKeyboardShortcuts) {
        window.initFormBuilderKeyboardShortcuts();
      }

      // Show keyboard shortcuts hint (after a short delay for better UX)
      if (window.showKeyboardShortcutsHint) {
        setTimeout(() => window.showKeyboardShortcutsHint(), 500);
      }
    };
  }

  // Patch exitFormBuilder to clean up keyboard shortcuts
  const originalExitFormBuilder = window.exitFormBuilder;
  if (originalExitFormBuilder) {
    window.exitFormBuilder = function() {
      // Remove keyboard shortcuts
      if (window.removeFormBuilderKeyboardShortcuts) {
        window.removeFormBuilderKeyboardShortcuts();
      }

      // Call original function
      originalExitFormBuilder.call(this);
    };
  }

  // Patch initFormBuilderEvents to use ConfirmDialog instead of confirm()
  const originalInitFormBuilderEvents = window.initFormBuilderEvents;
  if (originalInitFormBuilderEvents && window.ConfirmDialog) {
    window.initFormBuilderEvents = async function() {
      // Back button with async confirmation
      const backBtn = document.getElementById('builder-back-btn');
      if (backBtn) {
        backBtn.addEventListener('click', async () => {
          if (window.formBuilder && window.formBuilder.isDirty) {
            const confirmed = await window.ConfirmDialog.show(
              'Unsaved Changes',
              'You have unsaved changes. Are you sure you want to leave?',
              { confirmText: 'Leave', type: 'warning' }
            );
            if (!confirmed) return;
          }
          if (window.exitFormBuilder) window.exitFormBuilder();
        });
      }

      // Preview button
      document.getElementById('preview-form-btn')?.addEventListener('click', window.showFormPreview);

      // Save button
      document.getElementById('save-form-btn')?.addEventListener('click', window.saveFormBuilder);

      // Close properties
      document.getElementById('close-properties')?.addEventListener('click', () => {
        if (window.formBuilder) {
          window.formBuilder.selectedFieldId = null;
        }
        if (window.hide) window.hide('field-properties');
        document.querySelectorAll('.form-field-item.selected').forEach(el => el.classList.remove('selected'));
      });

      // Field type buttons (click to add)
      document.querySelectorAll('.field-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const type = btn.dataset.fieldType;
          if (window.addField) {
            window.addField(type);
            if (window.Toast) {
              const fieldTypes = window.fieldTypes || {};
              const typeName = fieldTypes[type]?.label || type;
              window.Toast.success(`${typeName} field added`);
            }
          }
        });
      });
    };
  }

  // Patch addField to show toast notification
  const originalAddField = window.addField;
  if (originalAddField && window.Toast) {
    window.addField = function(type, index = -1) {
      originalAddField.call(this, type, index);

      // Show toast (only if not triggered by click, to avoid duplicate toasts)
      const fieldTypes = window.fieldTypes || {};
      const typeName = fieldTypes[type]?.label || type;
      // Toast is shown in the patched initFormBuilderEvents for clicks
    };
  }

  // Patch duplicateField to show toast notification
  const originalDuplicateField = window.duplicateField;
  if (originalDuplicateField && window.Toast) {
    window.duplicateField = function(fieldId) {
      originalDuplicateField.call(this, fieldId);
      window.Toast.success('Field duplicated');
    };
  }

  // Patch saveFormBuilder to use loading states and toasts
  const originalSaveFormBuilder = window.saveFormBuilder;
  if (originalSaveFormBuilder) {
    window.saveFormBuilder = async function() {
      const saveBtn = document.getElementById('save-form-btn');

      // Validate form has at least one field
      if (window.formBuilder && window.formBuilder.fields.length === 0) {
        if (window.Toast) {
          window.Toast.error('Please add at least one field to the form');
        } else {
          alert('Please add at least one field to the form');
        }
        return;
      }

      // Validate all fields (if validation function exists)
      if (window.validateAllFields) {
        const validationErrors = window.validateAllFields();
        if (validationErrors && validationErrors.length > 0) {
          let errorMessage = 'Please fix the following errors:\n\n';
          validationErrors.forEach(({ field, errors }) => {
            errorMessage += `${field}:\n`;
            errors.forEach(error => {
              errorMessage += `  - ${error}\n`;
            });
            errorMessage += '\n';
          });
          if (window.Toast) {
            window.Toast.error('Validation errors found');
          }
          alert(errorMessage);
          return;
        }
      }

      // Show loading state
      if (window.setSaveButtonLoading) {
        window.setSaveButtonLoading(true);
      }

      try {
        // Make API call
        await window.api(`/api/forms/${window.formBuilder.formId}`, {
          method: 'PUT',
          body: JSON.stringify({
            fields: window.formBuilder.fields
          })
        });

        window.formBuilder.isDirty = false;

        // Show success toast
        if (window.Toast) {
          window.Toast.success('Form saved successfully!');
        } else {
          alert('Form saved successfully!');
        }
      } catch (err) {
        console.error('Save error:', err);
        if (window.Toast) {
          window.Toast.error('Failed to save form: ' + err.message);
        } else {
          alert('Failed to save form: ' + err.message);
        }
      } finally {
        // Hide loading state
        if (window.setSaveButtonLoading) {
          window.setSaveButtonLoading(false);
        }
      }
    };
  }

  // Patch delete field actions to use confirmation dialog
  const originalRenderFormFields = window.renderFormFields;
  if (originalRenderFormFields && window.ConfirmDialog) {
    window.renderFormFields = function() {
      originalRenderFormFields.call(this);

      // Re-attach delete handlers with confirmation
      document.querySelectorAll('.form-field-item .btn-delete').forEach(btn => {
        const item = btn.closest('.form-field-item');
        const fieldId = item?.dataset.fieldId;
        if (!fieldId) return;

        // Remove existing listeners and add new one
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (window.deleteFieldWithConfirmation) {
            await window.deleteFieldWithConfirmation(fieldId);
          } else {
            const confirmed = await window.ConfirmDialog.show(
              'Delete Field',
              'Are you sure you want to delete this field?',
              { confirmText: 'Delete', type: 'danger' }
            );
            if (confirmed && window.deleteField) {
              window.deleteField(fieldId);
              if (window.Toast) {
                window.Toast.success('Field deleted');
              }
            }
          }
        });
      });
    };
  }

  // Initialize on page load if builder is already visible
  const builderView = document.getElementById('form-builder-view');
  if (builderView && builderView.style.display !== 'none') {
    if (window.initFormBuilderKeyboardShortcuts) {
      window.initFormBuilderKeyboardShortcuts();
    }
  }
});
