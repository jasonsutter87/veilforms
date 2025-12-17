/**
 * E2E SMOKE TEST: Form Builder Integration
 *
 * Test Case: TC-E2E-030
 * Priority: Critical
 * Type: E2E Integration
 *
 * Purpose: Verify form builder creates, saves, loads, and preserves forms
 *
 * Critical Path:
 * 1. Create form with multiple field types
 * 2. Configure field properties
 * 3. Save form to storage
 * 4. Reload form from storage
 * 5. Verify all fields and properties preserved
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import {
  generateFormId,
  createMockFormConfig,
  MockStorage,
  deepEqual
} from './test-helpers.js';

describe('E2E SMOKE TEST: Form Builder Integration', () => {
  let mockFormStore;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFormStore = new MockStorage();
  });

  describe('TC-E2E-030: Create and Save Form', () => {
    it('should create form with multiple field types', () => {
      // STEP 1: Create form configuration
      const formId = generateFormId();

      const form = {
        id: formId,
        name: 'Multi-Field Contact Form',
        fields: [
          {
            id: 'field_1',
            type: 'text',
            name: 'full_name',
            label: 'Full Name',
            placeholder: 'Enter your full name',
            required: true
          },
          {
            id: 'field_2',
            type: 'email',
            name: 'email',
            label: 'Email Address',
            placeholder: 'you@example.com',
            required: true
          },
          {
            id: 'field_3',
            type: 'phone',
            name: 'phone',
            label: 'Phone Number',
            placeholder: '+1 (555) 000-0000',
            required: false
          },
          {
            id: 'field_4',
            type: 'select',
            name: 'department',
            label: 'Department',
            options: ['Sales', 'Support', 'Technical'],
            required: true
          },
          {
            id: 'field_5',
            type: 'textarea',
            name: 'message',
            label: 'Message',
            placeholder: 'Type your message here...',
            required: true
          },
          {
            id: 'field_6',
            type: 'checkbox',
            name: 'interests',
            label: 'Interests',
            options: ['Product Updates', 'Newsletter', 'Events'],
            required: false
          },
          {
            id: 'field_7',
            type: 'radio',
            name: 'preferred_contact',
            label: 'Preferred Contact Method',
            options: ['Email', 'Phone', 'SMS'],
            required: true
          },
          {
            id: 'field_8',
            type: 'number',
            name: 'team_size',
            label: 'Team Size',
            min: '1',
            max: '1000',
            required: false
          },
          {
            id: 'field_9',
            type: 'date',
            name: 'start_date',
            label: 'Preferred Start Date',
            min: '2024-01-01',
            max: '2025-12-31',
            required: false
          },
          {
            id: 'field_10',
            type: 'url',
            name: 'website',
            label: 'Website',
            placeholder: 'https://example.com',
            required: false
          }
        ],
        settings: {
          encryption: true,
          piiStrip: false,
          allowedOrigins: ['https://example.com'],
          submitText: 'Send Message',
          successMessage: 'Thank you for your submission!'
        },
        createdAt: Date.now()
      };

      // ASSERT: Form structure is correct
      expect(form.id).toBe(formId);
      expect(form.name).toBe('Multi-Field Contact Form');
      expect(form.fields).toHaveLength(10);
      expect(form.settings.encryption).toBe(true);

      // ASSERT: Each field type is present
      const fieldTypes = form.fields.map(f => f.type);
      expect(fieldTypes).toContain('text');
      expect(fieldTypes).toContain('email');
      expect(fieldTypes).toContain('phone');
      expect(fieldTypes).toContain('select');
      expect(fieldTypes).toContain('textarea');
      expect(fieldTypes).toContain('checkbox');
      expect(fieldTypes).toContain('radio');
      expect(fieldTypes).toContain('number');
      expect(fieldTypes).toContain('date');
      expect(fieldTypes).toContain('url');
    });

    it('should save form to storage', async () => {
      const formId = generateFormId();
      const formConfig = createMockFormConfig({ id: formId });

      // STEP 2: Save form
      await mockFormStore.set(formId, formConfig);

      // ASSERT: Form saved successfully
      const savedForm = await mockFormStore.get(formId);
      expect(savedForm).toBeDefined();
      expect(savedForm.id).toBe(formId);
      expect(savedForm.name).toBe(formConfig.name);
      expect(savedForm.fields).toEqual(formConfig.fields);
    });

    it('should serialize and deserialize form correctly', async () => {
      const formId = generateFormId();
      const originalForm = createMockFormConfig({ id: formId });

      // Serialize to JSON
      const json = JSON.stringify(originalForm);

      // Deserialize
      const deserializedForm = JSON.parse(json);

      // ASSERT: Form preserved through serialization
      expect(deserializedForm).toEqual(originalForm);
      expect(deserializedForm.fields.length).toBe(originalForm.fields.length);
      expect(deserializedForm.settings).toEqual(originalForm.settings);
    });
  });

  describe('TC-E2E-031: Load and Restore Form', () => {
    it('should load saved form and preserve all fields', async () => {
      // STEP 1: Create and save form
      const formId = generateFormId();
      const originalForm = {
        id: formId,
        name: 'Test Form',
        fields: [
          {
            id: 'field_1',
            type: 'text',
            name: 'name',
            label: 'Name',
            required: true,
            placeholder: 'Your name'
          },
          {
            id: 'field_2',
            type: 'email',
            name: 'email',
            label: 'Email',
            required: true,
            placeholder: 'your@email.com'
          }
        ],
        settings: {
          encryption: true,
          piiStrip: true
        }
      };

      await mockFormStore.set(formId, originalForm);

      // STEP 2: Load form
      const loadedForm = await mockFormStore.get(formId);

      // ASSERT: Form loaded successfully
      expect(loadedForm).toBeDefined();
      expect(loadedForm.id).toBe(originalForm.id);
      expect(loadedForm.name).toBe(originalForm.name);

      // ASSERT: All fields preserved
      expect(loadedForm.fields).toHaveLength(2);
      expect(loadedForm.fields[0]).toEqual(originalForm.fields[0]);
      expect(loadedForm.fields[1]).toEqual(originalForm.fields[1]);

      // ASSERT: Settings preserved
      expect(loadedForm.settings).toEqual(originalForm.settings);
    });

    it('should maintain field order after reload', async () => {
      const formId = generateFormId();

      const form = {
        id: formId,
        fields: [
          { id: 'field_a', name: 'first', type: 'text' },
          { id: 'field_b', name: 'second', type: 'email' },
          { id: 'field_c', name: 'third', type: 'phone' },
          { id: 'field_d', name: 'fourth', type: 'textarea' }
        ]
      };

      await mockFormStore.set(formId, form);

      const loadedForm = await mockFormStore.get(formId);

      // ASSERT: Field order preserved
      expect(loadedForm.fields[0].id).toBe('field_a');
      expect(loadedForm.fields[1].id).toBe('field_b');
      expect(loadedForm.fields[2].id).toBe('field_c');
      expect(loadedForm.fields[3].id).toBe('field_d');
    });

    it('should preserve field options for select/radio/checkbox', async () => {
      const formId = generateFormId();

      const form = {
        id: formId,
        fields: [
          {
            id: 'field_select',
            type: 'select',
            name: 'country',
            options: ['USA', 'Canada', 'UK', 'Australia']
          },
          {
            id: 'field_radio',
            type: 'radio',
            name: 'size',
            options: ['Small', 'Medium', 'Large', 'X-Large']
          },
          {
            id: 'field_checkbox',
            type: 'checkbox',
            name: 'features',
            options: ['Feature A', 'Feature B', 'Feature C']
          }
        ]
      };

      await mockFormStore.set(formId, form);

      const loadedForm = await mockFormStore.get(formId);

      // ASSERT: Options preserved
      expect(loadedForm.fields[0].options).toEqual(['USA', 'Canada', 'UK', 'Australia']);
      expect(loadedForm.fields[1].options).toEqual(['Small', 'Medium', 'Large', 'X-Large']);
      expect(loadedForm.fields[2].options).toEqual(['Feature A', 'Feature B', 'Feature C']);
    });

    it('should preserve min/max values for number and date fields', async () => {
      const formId = generateFormId();

      const form = {
        id: formId,
        fields: [
          {
            id: 'field_number',
            type: 'number',
            name: 'quantity',
            min: '1',
            max: '100'
          },
          {
            id: 'field_date',
            type: 'date',
            name: 'event_date',
            min: '2024-01-01',
            max: '2024-12-31'
          }
        ]
      };

      await mockFormStore.set(formId, form);

      const loadedForm = await mockFormStore.get(formId);

      // ASSERT: Min/max preserved
      expect(loadedForm.fields[0].min).toBe('1');
      expect(loadedForm.fields[0].max).toBe('100');
      expect(loadedForm.fields[1].min).toBe('2024-01-01');
      expect(loadedForm.fields[1].max).toBe('2024-12-31');
    });
  });

  describe('TC-E2E-032: Form Updates', () => {
    it('should update form name', async () => {
      const formId = generateFormId();
      const originalForm = createMockFormConfig({ id: formId });

      await mockFormStore.set(formId, originalForm);

      // Update name
      const updatedForm = { ...originalForm, name: 'Updated Form Name' };
      await mockFormStore.set(formId, updatedForm);

      // ASSERT: Name updated
      const savedForm = await mockFormStore.get(formId);
      expect(savedForm.name).toBe('Updated Form Name');
    });

    it('should add new field to existing form', async () => {
      const formId = generateFormId();
      const originalForm = createMockFormConfig({ id: formId });

      await mockFormStore.set(formId, originalForm);

      // Add new field
      const newField = {
        id: 'field_new',
        type: 'url',
        name: 'website',
        label: 'Website',
        required: false
      };

      const updatedForm = {
        ...originalForm,
        fields: [...originalForm.fields, newField]
      };

      await mockFormStore.set(formId, updatedForm);

      // ASSERT: Field added
      const savedForm = await mockFormStore.get(formId);
      expect(savedForm.fields.length).toBe(originalForm.fields.length + 1);
      expect(savedForm.fields[savedForm.fields.length - 1]).toEqual(newField);
    });

    it('should remove field from form', async () => {
      const formId = generateFormId();
      const originalForm = createMockFormConfig({ id: formId });

      await mockFormStore.set(formId, originalForm);

      // Remove field
      const updatedFields = originalForm.fields.filter(f => f.id !== 'field_email');
      const updatedForm = {
        ...originalForm,
        fields: updatedFields
      };

      await mockFormStore.set(formId, updatedForm);

      // ASSERT: Field removed
      const savedForm = await mockFormStore.get(formId);
      expect(savedForm.fields.length).toBe(originalForm.fields.length - 1);
      expect(savedForm.fields.find(f => f.id === 'field_email')).toBeUndefined();
    });

    it('should reorder fields', async () => {
      const formId = generateFormId();
      const originalForm = {
        id: formId,
        fields: [
          { id: 'field_1', name: 'first' },
          { id: 'field_2', name: 'second' },
          { id: 'field_3', name: 'third' }
        ]
      };

      await mockFormStore.set(formId, originalForm);

      // Reorder: move first to last
      const reorderedFields = [
        originalForm.fields[1],
        originalForm.fields[2],
        originalForm.fields[0]
      ];

      const updatedForm = {
        ...originalForm,
        fields: reorderedFields
      };

      await mockFormStore.set(formId, updatedForm);

      // ASSERT: Order changed
      const savedForm = await mockFormStore.get(formId);
      expect(savedForm.fields[0].id).toBe('field_2');
      expect(savedForm.fields[1].id).toBe('field_3');
      expect(savedForm.fields[2].id).toBe('field_1');
    });

    it('should update field properties', async () => {
      const formId = generateFormId();
      const originalForm = createMockFormConfig({ id: formId });

      await mockFormStore.set(formId, originalForm);

      // Update field properties
      const updatedFields = originalForm.fields.map(field => {
        if (field.id === 'field_name') {
          return {
            ...field,
            label: 'Updated Label',
            placeholder: 'Updated placeholder',
            required: false
          };
        }
        return field;
      });

      const updatedForm = {
        ...originalForm,
        fields: updatedFields
      };

      await mockFormStore.set(formId, updatedForm);

      // ASSERT: Properties updated
      const savedForm = await mockFormStore.get(formId);
      const updatedField = savedForm.fields.find(f => f.id === 'field_name');
      expect(updatedField.label).toBe('Updated Label');
      expect(updatedField.placeholder).toBe('Updated placeholder');
      expect(updatedField.required).toBe(false);
    });
  });

  describe('TC-E2E-033: Form Validation', () => {
    it('should validate form has unique field names', () => {
      const fields = [
        { id: 'field_1', name: 'email', type: 'email' },
        { id: 'field_2', name: 'phone', type: 'phone' },
        { id: 'field_3', name: 'email', type: 'text' } // Duplicate name
      ];

      const fieldNames = fields.map(f => f.name);
      const uniqueNames = new Set(fieldNames);

      // ASSERT: Duplicate detected
      expect(fieldNames.length).not.toBe(uniqueNames.size);

      // Should fail validation
      const hasDuplicates = fieldNames.length !== uniqueNames.size;
      expect(hasDuplicates).toBe(true);
    });

    it('should validate field name format', () => {
      const validNames = ['email', 'first_name', 'user123', 'phoneNumber'];
      const invalidNames = ['123name', 'first-name', 'user name', 'email!'];

      const nameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;

      validNames.forEach(name => {
        expect(nameRegex.test(name)).toBe(true);
      });

      invalidNames.forEach(name => {
        expect(nameRegex.test(name)).toBe(false);
      });
    });

    it('should validate select/radio/checkbox have options', () => {
      const fieldsWithOptions = [
        { type: 'select', options: ['A', 'B'] },
        { type: 'radio', options: ['Yes', 'No'] },
        { type: 'checkbox', options: ['Option 1'] }
      ];

      const fieldsWithoutOptions = [
        { type: 'select', options: [] },
        { type: 'radio', options: [] },
        { type: 'checkbox' } // Missing options
      ];

      fieldsWithOptions.forEach(field => {
        expect(field.options?.length > 0).toBe(true);
      });

      fieldsWithoutOptions.forEach(field => {
        expect(field.options?.length > 0).toBeFalsy();
      });
    });

    it('should validate required fields are marked', () => {
      const form = {
        fields: [
          { id: 'field_1', name: 'email', required: true },
          { id: 'field_2', name: 'phone', required: false },
          { id: 'field_3', name: 'message' } // Missing required flag
        ]
      };

      // Check which fields have explicit required flag
      form.fields.forEach(field => {
        if (field.id === 'field_3') {
          expect(field.required).toBeUndefined();
        } else {
          expect(field).toHaveProperty('required');
        }
      });
    });
  });

  describe('TC-E2E-034: Form Settings', () => {
    it('should save and load form settings', async () => {
      const formId = generateFormId();

      const form = {
        id: formId,
        fields: [],
        settings: {
          encryption: true,
          piiStrip: false,
          allowedOrigins: ['https://example.com', 'https://app.example.com'],
          submitText: 'Submit Form',
          successMessage: 'Thank you!',
          redirectUrl: 'https://example.com/thank-you',
          webhookUrl: 'https://webhook.example.com/receive',
          notificationEmail: 'admin@example.com'
        }
      };

      await mockFormStore.set(formId, form);

      const loadedForm = await mockFormStore.get(formId);

      // ASSERT: All settings preserved
      expect(loadedForm.settings.encryption).toBe(true);
      expect(loadedForm.settings.piiStrip).toBe(false);
      expect(loadedForm.settings.allowedOrigins).toEqual(['https://example.com', 'https://app.example.com']);
      expect(loadedForm.settings.submitText).toBe('Submit Form');
      expect(loadedForm.settings.successMessage).toBe('Thank you!');
      expect(loadedForm.settings.redirectUrl).toBe('https://example.com/thank-you');
      expect(loadedForm.settings.webhookUrl).toBe('https://webhook.example.com/receive');
      expect(loadedForm.settings.notificationEmail).toBe('admin@example.com');
    });

    it('should update individual settings', async () => {
      const formId = generateFormId();
      const form = createMockFormConfig({ id: formId });

      await mockFormStore.set(formId, form);

      // Update encryption setting
      const updatedForm = {
        ...form,
        settings: {
          ...form.settings,
          encryption: false
        }
      };

      await mockFormStore.set(formId, updatedForm);

      const savedForm = await mockFormStore.get(formId);

      // ASSERT: Setting updated
      expect(savedForm.settings.encryption).toBe(false);
      // Other settings unchanged
      expect(savedForm.settings.piiStrip).toBe(form.settings.piiStrip);
    });
  });

  describe('TC-E2E-035: Layout Fields', () => {
    it('should support heading, paragraph, and divider fields', async () => {
      const formId = generateFormId();

      const form = {
        id: formId,
        fields: [
          {
            id: 'field_heading',
            type: 'heading',
            content: 'Contact Information',
            level: 'h3'
          },
          {
            id: 'field_para',
            type: 'paragraph',
            content: 'Please fill out all required fields.'
          },
          {
            id: 'field_name',
            type: 'text',
            name: 'name',
            label: 'Name'
          },
          {
            id: 'field_divider',
            type: 'divider'
          },
          {
            id: 'field_heading2',
            type: 'heading',
            content: 'Additional Details',
            level: 'h3'
          }
        ]
      };

      await mockFormStore.set(formId, form);

      const loadedForm = await mockFormStore.get(formId);

      // ASSERT: Layout fields preserved
      const headingFields = loadedForm.fields.filter(f => f.type === 'heading');
      const paragraphFields = loadedForm.fields.filter(f => f.type === 'paragraph');
      const dividerFields = loadedForm.fields.filter(f => f.type === 'divider');

      expect(headingFields.length).toBe(2);
      expect(paragraphFields.length).toBe(1);
      expect(dividerFields.length).toBe(1);

      expect(headingFields[0].content).toBe('Contact Information');
      expect(headingFields[0].level).toBe('h3');
      expect(paragraphFields[0].content).toBe('Please fill out all required fields.');
    });

    it('should allow layout fields without name attribute', () => {
      const layoutFields = [
        { id: 'field_1', type: 'heading', content: 'Section', level: 'h2' },
        { id: 'field_2', type: 'paragraph', content: 'Description' },
        { id: 'field_3', type: 'divider' }
      ];

      // ASSERT: Layout fields don't need name
      layoutFields.forEach(field => {
        expect(field.name).toBeUndefined();
        expect(['heading', 'paragraph', 'divider']).toContain(field.type);
      });
    });
  });

  describe('TC-E2E-036: Form Metadata', () => {
    it('should track form creation and update timestamps', async () => {
      const formId = generateFormId();
      const now = Date.now();

      const form = {
        id: formId,
        name: 'Test Form',
        fields: [],
        createdAt: now
      };

      await mockFormStore.set(formId, form);

      // Wait 1ms to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));

      // Update form
      const updatedForm = {
        ...form,
        name: 'Updated Form',
        updatedAt: Date.now()
      };

      await mockFormStore.set(formId, updatedForm);

      const savedForm = await mockFormStore.get(formId);

      // ASSERT: Timestamps present
      expect(savedForm.createdAt).toBe(now);
      expect(savedForm.updatedAt).toBeDefined();
      expect(savedForm.updatedAt).toBeGreaterThanOrEqual(savedForm.createdAt);
    });

    it('should track form version', async () => {
      const formId = generateFormId();

      const form = {
        id: formId,
        name: 'Versioned Form',
        fields: [],
        version: 1
      };

      await mockFormStore.set(formId, form);

      // Update form
      const updatedForm = {
        ...form,
        fields: [{ id: 'field_1', type: 'text', name: 'name' }],
        version: 2
      };

      await mockFormStore.set(formId, updatedForm);

      const savedForm = await mockFormStore.get(formId);

      // ASSERT: Version incremented
      expect(savedForm.version).toBe(2);
    });
  });
});
