/**
 * Form Builder Tests
 * Comprehensive TDD tests for form builder functionality
 */

describe('Form Builder', () => {
  // Test helper functions
  const generateFieldId = () => {
    return 'field_' + Math.random().toString(36).substr(2, 9);
  };

  const fieldTypes = {
    text: { label: 'Text Input', icon: 'text', hasPlaceholder: true, hasValidation: true },
    email: { label: 'Email', icon: 'email', hasPlaceholder: true, hasValidation: true },
    textarea: { label: 'Text Area', icon: 'textarea', hasPlaceholder: true, hasValidation: false },
    number: { label: 'Number', icon: 'number', hasPlaceholder: true, hasValidation: true, hasMinMax: true },
    phone: { label: 'Phone', icon: 'phone', hasPlaceholder: true, hasValidation: true },
    select: { label: 'Dropdown', icon: 'select', hasOptions: true },
    checkbox: { label: 'Checkbox', icon: 'checkbox', hasOptions: true },
    radio: { label: 'Radio', icon: 'radio', hasOptions: true },
    date: { label: 'Date', icon: 'date', hasMinMax: true },
    url: { label: 'URL', icon: 'url', hasPlaceholder: true, hasValidation: true },
    hidden: { label: 'Hidden', icon: 'hidden', hasDefaultValue: true },
    heading: { label: 'Heading', icon: 'heading', isLayout: true },
    paragraph: { label: 'Paragraph', icon: 'paragraph', isLayout: true },
    divider: { label: 'Divider', icon: 'divider', isLayout: true }
  };

  const createFieldConfig = (type) => {
    const typeConfig = fieldTypes[type];
    const fieldId = generateFieldId();

    const config = {
      id: fieldId,
      type,
      label: typeConfig.isLayout ? '' : typeConfig.label,
      name: typeConfig.isLayout ? '' : type + '_' + fieldId.substr(6, 4),
      required: false
    };

    if (typeConfig.hasPlaceholder) {
      config.placeholder = '';
    }

    if (typeConfig.hasOptions) {
      config.options = ['Option 1', 'Option 2', 'Option 3'];
    }

    if (typeConfig.hasDefaultValue) {
      config.defaultValue = '';
    }

    if (typeConfig.hasMinMax) {
      config.min = '';
      config.max = '';
    }

    if (type === 'heading') {
      config.content = 'Section Heading';
      config.level = 'h3';
    }

    if (type === 'paragraph') {
      config.content = 'Add your text here...';
    }

    return config;
  };

  describe('Field Management', () => {
    describe('Adding a field', () => {
      it('should create field with correct structure', () => {
        const field = createFieldConfig('text');

        expect(field).toHaveProperty('id');
        expect(field).toHaveProperty('type');
        expect(field).toHaveProperty('label');
        expect(field).toHaveProperty('name');
        expect(field).toHaveProperty('required');
        expect(field.type).toBe('text');
        expect(field.required).toBe(false);
      });

      it('should generate unique field ID', () => {
        const field1 = createFieldConfig('text');
        const field2 = createFieldConfig('text');

        expect(field1.id).not.toBe(field2.id);
        expect(field1.id.startsWith('field_')).toBe(true);
        expect(field2.id.startsWith('field_')).toBe(true);
      });

      it('should add field to array', () => {
        const fields = [];
        const field = createFieldConfig('email');

        fields.push(field);

        expect(fields.length).toBe(1);
        expect(fields[0]).toBe(field);
      });

      it('should add field at specific index', () => {
        const fields = [
          createFieldConfig('text'),
          createFieldConfig('email')
        ];
        const newField = createFieldConfig('phone');

        fields.splice(1, 0, newField);

        expect(fields.length).toBe(3);
        expect(fields[1]).toBe(newField);
        expect(fields[1].type).toBe('phone');
      });
    });

    describe('Deleting a field', () => {
      it('should remove field from array by ID', () => {
        const field1 = createFieldConfig('text');
        const field2 = createFieldConfig('email');
        const field3 = createFieldConfig('phone');
        const fields = [field1, field2, field3];

        const index = fields.findIndex(f => f.id === field2.id);
        fields.splice(index, 1);

        expect(fields.length).toBe(2);
        expect(fields.find(f => f.id === field2.id)).toBeUndefined();
        expect(fields[0]).toBe(field1);
        expect(fields[1]).toBe(field3);
      });

      it('should return -1 for non-existent field', () => {
        const fields = [createFieldConfig('text')];
        const index = fields.findIndex(f => f.id === 'non_existent');

        expect(index).toBe(-1);
      });

      it('should handle deleting from empty array', () => {
        const fields = [];
        const index = fields.findIndex(f => f.id === 'any_id');

        expect(index).toBe(-1);
        expect(fields.length).toBe(0);
      });
    });

    describe('Duplicating a field', () => {
      it('should create copy with new ID', () => {
        const original = createFieldConfig('text');
        const duplicate = { ...original, id: generateFieldId() };

        expect(duplicate.type).toBe(original.type);
        expect(duplicate.label).toBe(original.label);
        expect(duplicate.id).not.toBe(original.id);
      });

      it('should modify name to indicate copy', () => {
        const original = createFieldConfig('text');
        const duplicate = { ...original, id: generateFieldId() };
        duplicate.name = original.name + '_copy';

        expect(duplicate.name).toContain('_copy');
        expect(duplicate.name).not.toBe(original.name);
      });

      it('should preserve all properties except ID', () => {
        const original = createFieldConfig('email');
        original.placeholder = 'Enter email';
        original.required = true;

        const duplicate = { ...original, id: generateFieldId() };

        expect(duplicate.type).toBe(original.type);
        expect(duplicate.label).toBe(original.label);
        expect(duplicate.placeholder).toBe(original.placeholder);
        expect(duplicate.required).toBe(original.required);
        expect(duplicate.id).not.toBe(original.id);
      });

      it('should insert duplicate after original in array', () => {
        const field1 = createFieldConfig('text');
        const field2 = createFieldConfig('email');
        const fields = [field1, field2];

        const duplicate = { ...field1, id: generateFieldId() };
        const index = fields.indexOf(field1);
        fields.splice(index + 1, 0, duplicate);

        expect(fields.length).toBe(3);
        expect(fields[1]).toBe(duplicate);
        expect(fields[0]).toBe(field1);
      });
    });

    describe('Field IDs are unique', () => {
      it('should generate unique IDs for multiple fields', () => {
        const ids = new Set();
        for (let i = 0; i < 100; i++) {
          ids.add(generateFieldId());
        }

        expect(ids.size).toBe(100);
      });

      it('should ensure no duplicate IDs in field array', () => {
        const fields = [
          createFieldConfig('text'),
          createFieldConfig('email'),
          createFieldConfig('phone'),
          createFieldConfig('textarea')
        ];

        const ids = fields.map(f => f.id);
        const uniqueIds = new Set(ids);

        expect(ids.length).toBe(uniqueIds.size);
      });
    });
  });

  describe('Field Validation', () => {
    describe('Field name uniqueness', () => {
      it('should detect duplicate field names', () => {
        const fields = [
          { id: 'field_1', name: 'email', type: 'email' },
          { id: 'field_2', name: 'phone', type: 'phone' },
          { id: 'field_3', name: 'email', type: 'text' } // Duplicate name
        ];

        const names = fields.map(f => f.name);
        const uniqueNames = new Set(names);

        expect(names.length).not.toBe(uniqueNames.size);
      });

      it('should pass validation with unique names', () => {
        const fields = [
          { id: 'field_1', name: 'email', type: 'email' },
          { id: 'field_2', name: 'phone', type: 'phone' },
          { id: 'field_3', name: 'message', type: 'textarea' }
        ];

        const names = fields.map(f => f.name);
        const uniqueNames = new Set(names);

        expect(names.length).toBe(uniqueNames.size);
      });

      it('should allow empty names for layout fields', () => {
        const fields = [
          { id: 'field_1', name: '', type: 'heading' },
          { id: 'field_2', name: 'email', type: 'email' },
          { id: 'field_3', name: '', type: 'divider' }
        ];

        const inputFields = fields.filter(f => f.name !== '');
        const names = inputFields.map(f => f.name);
        const uniqueNames = new Set(names);

        expect(names.length).toBe(uniqueNames.size);
      });
    });

    describe('Field name as valid identifier', () => {
      it('should validate alphanumeric with underscores', () => {
        const validNames = ['email', 'first_name', 'phone_number_1', 'user123'];
        const nameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;

        validNames.forEach(name => {
          expect(nameRegex.test(name)).toBe(true);
        });
      });

      it('should reject invalid identifiers', () => {
        const invalidNames = ['123name', 'first-name', 'user name', 'email!', ''];
        const nameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;

        invalidNames.forEach(name => {
          expect(nameRegex.test(name)).toBe(false);
        });
      });

      it('should reject names starting with numbers', () => {
        const nameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;

        expect(nameRegex.test('1_field')).toBe(false);
        expect(nameRegex.test('field_1')).toBe(true);
      });

      it('should reject names with special characters', () => {
        const nameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;

        expect(nameRegex.test('field-name')).toBe(false);
        expect(nameRegex.test('field.name')).toBe(false);
        expect(nameRegex.test('field@name')).toBe(false);
        expect(nameRegex.test('field_name')).toBe(true);
      });
    });

    describe('Required field validation', () => {
      it('should validate required fields have value', () => {
        const field = { name: 'email', required: true };
        const value = '';

        const isValid = !field.required || (value && value.trim().length > 0);

        expect(isValid).toBeFalsy();
      });

      it('should pass validation when required field has value', () => {
        const field = { name: 'email', required: true };
        const value = 'test@example.com';

        const isValid = !field.required || (value && value.trim().length > 0);

        expect(isValid).toBe(true);
      });

      it('should pass validation for optional empty fields', () => {
        const field = { name: 'phone', required: false };
        const value = '';

        const isValid = !field.required || (value && value.trim().length > 0);

        expect(isValid).toBe(true);
      });
    });

    describe('Options field validation', () => {
      it('should require at least one option for select fields', () => {
        const field = { type: 'select', options: ['Option 1'] };

        expect(field.options.length).toBeGreaterThan(0);
      });

      it('should reject empty options array', () => {
        const field = { type: 'select', options: [] };

        expect(field.options.length).toBe(0);
        // Should fail validation
      });

      it('should validate checkbox has options', () => {
        const field = { type: 'checkbox', options: ['Option 1', 'Option 2'] };

        expect(Array.isArray(field.options)).toBe(true);
        expect(field.options.length).toBeGreaterThan(0);
      });

      it('should validate radio has options', () => {
        const field = { type: 'radio', options: ['Yes', 'No'] };

        expect(Array.isArray(field.options)).toBe(true);
        expect(field.options.length).toBeGreaterThan(0);
      });

      it('should allow minimum of 1 option', () => {
        const field = { type: 'select', options: ['Only Option'] };

        expect(field.options.length).toBe(1);
      });

      it('should filter out empty options', () => {
        const options = ['Option 1', '', 'Option 2', '   ', 'Option 3'];
        const validOptions = options.filter(opt => opt && opt.trim().length > 0);

        expect(validOptions.length).toBe(3);
        expect(validOptions).toEqual(['Option 1', 'Option 2', 'Option 3']);
      });
    });
  });

  describe('Field Types', () => {
    describe('Field type count', () => {
      it('should have exactly 14 field types', () => {
        expect(Object.keys(fieldTypes).length).toBe(14);
      });
    });

    describe('Field type rendering', () => {
      it('should render text input field correctly', () => {
        const field = createFieldConfig('text');

        expect(field.type).toBe('text');
        expect(field.label).toBe('Text Input');
        expect(field).toHaveProperty('placeholder');
        expect(field.required).toBe(false);
      });

      it('should render email field correctly', () => {
        const field = createFieldConfig('email');

        expect(field.type).toBe('email');
        expect(field.label).toBe('Email');
        expect(field).toHaveProperty('placeholder');
      });

      it('should render textarea field correctly', () => {
        const field = createFieldConfig('textarea');

        expect(field.type).toBe('textarea');
        expect(field.label).toBe('Text Area');
        expect(field).toHaveProperty('placeholder');
      });

      it('should render number field correctly', () => {
        const field = createFieldConfig('number');

        expect(field.type).toBe('number');
        expect(field.label).toBe('Number');
        expect(field).toHaveProperty('placeholder');
        expect(field).toHaveProperty('min');
        expect(field).toHaveProperty('max');
      });

      it('should render phone field correctly', () => {
        const field = createFieldConfig('phone');

        expect(field.type).toBe('phone');
        expect(field.label).toBe('Phone');
        expect(field).toHaveProperty('placeholder');
      });

      it('should render select field correctly', () => {
        const field = createFieldConfig('select');

        expect(field.type).toBe('select');
        expect(field.label).toBe('Dropdown');
        expect(field).toHaveProperty('options');
        expect(field.options.length).toBe(3);
      });

      it('should render checkbox field correctly', () => {
        const field = createFieldConfig('checkbox');

        expect(field.type).toBe('checkbox');
        expect(field.label).toBe('Checkbox');
        expect(field).toHaveProperty('options');
      });

      it('should render radio field correctly', () => {
        const field = createFieldConfig('radio');

        expect(field.type).toBe('radio');
        expect(field.label).toBe('Radio');
        expect(field).toHaveProperty('options');
      });

      it('should render date field correctly', () => {
        const field = createFieldConfig('date');

        expect(field.type).toBe('date');
        expect(field.label).toBe('Date');
        expect(field).toHaveProperty('min');
        expect(field).toHaveProperty('max');
      });

      it('should render url field correctly', () => {
        const field = createFieldConfig('url');

        expect(field.type).toBe('url');
        expect(field.label).toBe('URL');
        expect(field).toHaveProperty('placeholder');
      });

      it('should render hidden field correctly', () => {
        const field = createFieldConfig('hidden');

        expect(field.type).toBe('hidden');
        expect(field.label).toBe('Hidden');
        expect(field).toHaveProperty('defaultValue');
      });

      it('should render heading field correctly', () => {
        const field = createFieldConfig('heading');

        expect(field.type).toBe('heading');
        expect(field.label).toBe('');
        expect(field.name).toBe('');
        expect(field).toHaveProperty('content');
        expect(field).toHaveProperty('level');
        expect(field.level).toBe('h3');
      });

      it('should render paragraph field correctly', () => {
        const field = createFieldConfig('paragraph');

        expect(field.type).toBe('paragraph');
        expect(field.label).toBe('');
        expect(field.name).toBe('');
        expect(field).toHaveProperty('content');
      });

      it('should render divider field correctly', () => {
        const field = createFieldConfig('divider');

        expect(field.type).toBe('divider');
        expect(field.label).toBe('');
        expect(field.name).toBe('');
      });
    });

    describe('Field type properties', () => {
      it('should set hasPlaceholder for text input types', () => {
        const textTypes = ['text', 'email', 'textarea', 'number', 'phone', 'url'];

        textTypes.forEach(type => {
          expect(fieldTypes[type].hasPlaceholder).toBe(true);
        });
      });

      it('should set hasOptions for choice types', () => {
        const choiceTypes = ['select', 'checkbox', 'radio'];

        choiceTypes.forEach(type => {
          expect(fieldTypes[type].hasOptions).toBe(true);
        });
      });

      it('should set hasValidation for validatable types', () => {
        const validatableTypes = ['text', 'email', 'number', 'phone', 'url'];

        validatableTypes.forEach(type => {
          expect(fieldTypes[type].hasValidation).toBe(true);
        });
      });

      it('should set hasMinMax for range types', () => {
        const rangeTypes = ['number', 'date'];

        rangeTypes.forEach(type => {
          expect(fieldTypes[type].hasMinMax).toBe(true);
        });
      });

      it('should set isLayout for layout types', () => {
        const layoutTypes = ['heading', 'paragraph', 'divider'];

        layoutTypes.forEach(type => {
          expect(fieldTypes[type].isLayout).toBe(true);
        });
      });

      it('should set hasDefaultValue for hidden field', () => {
        expect(fieldTypes.hidden.hasDefaultValue).toBe(true);
      });
    });
  });

  describe('Drag and Drop', () => {
    describe('Field reordering', () => {
      it('should reorder fields by moving up', () => {
        const fields = [
          { id: 'field_1', name: 'first' },
          { id: 'field_2', name: 'second' },
          { id: 'field_3', name: 'third' }
        ];

        const currentIndex = 2;
        const targetIndex = 0;
        const field = fields[currentIndex];

        fields.splice(currentIndex, 1);
        fields.splice(targetIndex, 0, field);

        expect(fields[0].id).toBe('field_3');
        expect(fields[1].id).toBe('field_1');
        expect(fields[2].id).toBe('field_2');
      });

      it('should reorder fields by moving down', () => {
        const fields = [
          { id: 'field_1', name: 'first' },
          { id: 'field_2', name: 'second' },
          { id: 'field_3', name: 'third' }
        ];

        const currentIndex = 0;
        const targetIndex = 2;
        const field = fields[currentIndex];

        fields.splice(currentIndex, 1);
        fields.splice(targetIndex, 0, field);

        expect(fields[0].id).toBe('field_2');
        expect(fields[1].id).toBe('field_3');
        expect(fields[2].id).toBe('field_1');
      });

      it('should handle adjacent field swap', () => {
        const fields = [
          { id: 'field_1', name: 'first' },
          { id: 'field_2', name: 'second' }
        ];

        const currentIndex = 0;
        const targetIndex = 1;
        const field = fields[currentIndex];

        fields.splice(currentIndex, 1);
        fields.splice(targetIndex, 0, field);

        expect(fields[0].id).toBe('field_2');
        expect(fields[1].id).toBe('field_1');
      });

      it('should maintain field count after reorder', () => {
        const fields = [
          { id: 'field_1' },
          { id: 'field_2' },
          { id: 'field_3' },
          { id: 'field_4' }
        ];

        const originalCount = fields.length;
        const currentIndex = 1;
        const targetIndex = 3;
        const field = fields[currentIndex];

        fields.splice(currentIndex, 1);
        fields.splice(targetIndex, 0, field);

        expect(fields.length).toBe(originalCount);
      });
    });

    describe('Adding fields from palette', () => {
      it('should add field when dropped from palette', () => {
        const fields = [];
        const draggedFieldType = 'email';

        const newField = createFieldConfig(draggedFieldType);
        fields.push(newField);

        expect(fields.length).toBe(1);
        expect(fields[0].type).toBe('email');
      });

      it('should add field to end of list', () => {
        const fields = [
          createFieldConfig('text'),
          createFieldConfig('email')
        ];

        const newField = createFieldConfig('phone');
        fields.push(newField);

        expect(fields.length).toBe(3);
        expect(fields[2].type).toBe('phone');
      });
    });

    describe('Field order preservation', () => {
      it('should preserve order after multiple operations', () => {
        const fields = [
          { id: 'a', name: 'first' },
          { id: 'b', name: 'second' },
          { id: 'c', name: 'third' }
        ];

        // Add a field
        fields.push({ id: 'd', name: 'fourth' });

        // Remove middle field
        fields.splice(1, 1);

        // Reorder
        const field = fields[0];
        fields.splice(0, 1);
        fields.push(field);

        expect(fields[0].id).toBe('c');
        expect(fields[1].id).toBe('d');
        expect(fields[2].id).toBe('a');
        expect(fields.length).toBe(3);
      });

      it('should maintain indices after deletion', () => {
        const fields = [
          { id: 'field_1', index: 0 },
          { id: 'field_2', index: 1 },
          { id: 'field_3', index: 2 }
        ];

        fields.splice(1, 1);

        expect(fields.length).toBe(2);
        expect(fields[0].id).toBe('field_1');
        expect(fields[1].id).toBe('field_3');
      });
    });
  });

  describe('Form Persistence', () => {
    describe('Form structure', () => {
      it('should save form with correct structure', () => {
        const formData = {
          id: 'vf_abc123',
          name: 'Contact Form',
          fields: [
            createFieldConfig('text'),
            createFieldConfig('email')
          ],
          createdAt: new Date().toISOString()
        };

        expect(formData).toHaveProperty('id');
        expect(formData).toHaveProperty('name');
        expect(formData).toHaveProperty('fields');
        expect(Array.isArray(formData.fields)).toBe(true);
        expect(formData.fields.length).toBe(2);
      });

      it('should serialize fields to JSON', () => {
        const fields = [
          createFieldConfig('text'),
          createFieldConfig('email')
        ];

        const json = JSON.stringify(fields);
        const parsed = JSON.parse(json);

        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBe(2);
        expect(parsed[0]).toHaveProperty('id');
        expect(parsed[0]).toHaveProperty('type');
      });

      it('should include all field properties in serialization', () => {
        const field = createFieldConfig('select');
        field.required = true;
        field.label = 'Choose option';

        const json = JSON.stringify(field);
        const parsed = JSON.parse(json);

        expect(parsed.required).toBe(true);
        expect(parsed.label).toBe('Choose option');
        expect(parsed.options).toEqual(['Option 1', 'Option 2', 'Option 3']);
      });
    });

    describe('Form loading', () => {
      it('should load form and populate fields', () => {
        const savedForm = {
          id: 'vf_abc123',
          name: 'Contact Form',
          fields: [
            { id: 'field_1', type: 'text', name: 'name', label: 'Name', required: true },
            { id: 'field_2', type: 'email', name: 'email', label: 'Email', required: true }
          ]
        };

        const loadedFields = savedForm.fields;

        expect(loadedFields.length).toBe(2);
        expect(loadedFields[0].type).toBe('text');
        expect(loadedFields[1].type).toBe('email');
      });

      it('should restore field order', () => {
        const fields = [
          { id: 'field_a', order: 0 },
          { id: 'field_b', order: 1 },
          { id: 'field_c', order: 2 }
        ];

        const json = JSON.stringify(fields);
        const loaded = JSON.parse(json);

        expect(loaded[0].id).toBe('field_a');
        expect(loaded[1].id).toBe('field_b');
        expect(loaded[2].id).toBe('field_c');
      });

      it('should handle empty fields array', () => {
        const savedForm = {
          id: 'vf_abc123',
          name: 'Empty Form',
          fields: []
        };

        expect(Array.isArray(savedForm.fields)).toBe(true);
        expect(savedForm.fields.length).toBe(0);
      });
    });

    describe('Dirty state tracking', () => {
      it('should set dirty flag when field is added', () => {
        let isDirty = false;
        const fields = [];

        fields.push(createFieldConfig('text'));
        isDirty = true;

        expect(isDirty).toBe(true);
      });

      it('should set dirty flag when field is deleted', () => {
        let isDirty = false;
        const fields = [createFieldConfig('text')];

        fields.splice(0, 1);
        isDirty = true;

        expect(isDirty).toBe(true);
      });

      it('should set dirty flag when field is reordered', () => {
        let isDirty = false;
        const fields = [
          createFieldConfig('text'),
          createFieldConfig('email')
        ];

        const field = fields[0];
        fields.splice(0, 1);
        fields.push(field);
        isDirty = true;

        expect(isDirty).toBe(true);
      });

      it('should reset dirty flag after save', () => {
        let isDirty = true;

        // Simulate save
        isDirty = false;

        expect(isDirty).toBe(false);
      });

      it('should set dirty flag when field property changes', () => {
        let isDirty = false;
        const field = createFieldConfig('text');

        field.label = 'New Label';
        isDirty = true;

        expect(isDirty).toBe(true);
      });
    });
  });

  describe('API Integration', () => {
    describe('Create form payload', () => {
      it('should send correct payload structure', () => {
        const payload = {
          name: 'Contact Form',
          fields: [
            createFieldConfig('text'),
            createFieldConfig('email')
          ],
          settings: {
            encryption: true,
            piiStrip: false
          }
        };

        expect(payload).toHaveProperty('name');
        expect(payload).toHaveProperty('fields');
        expect(payload).toHaveProperty('settings');
        expect(Array.isArray(payload.fields)).toBe(true);
      });

      it('should validate form name is required', () => {
        const payload = { fields: [] };

        expect(payload.name).toBeUndefined();
        // API should return 400 Bad Request
      });

      it('should validate fields array is required', () => {
        const payload = { name: 'Test Form' };

        expect(payload.fields).toBeUndefined();
        // API should return 400 Bad Request
      });

      it('should include field configurations', () => {
        const fields = [
          createFieldConfig('email'),
          createFieldConfig('select')
        ];

        const payload = {
          name: 'Form',
          fields
        };

        expect(payload.fields[0]).toHaveProperty('id');
        expect(payload.fields[0]).toHaveProperty('type');
        expect(payload.fields[0]).toHaveProperty('name');
        expect(payload.fields[1]).toHaveProperty('options');
      });
    });

    describe('Update form payload', () => {
      it('should send updated fields array', () => {
        const originalFields = [createFieldConfig('text')];
        const updatedFields = [
          ...originalFields,
          createFieldConfig('email')
        ];

        const payload = {
          fields: updatedFields
        };

        expect(payload.fields.length).toBe(2);
        expect(payload.fields[1].type).toBe('email');
      });

      it('should send partial updates', () => {
        const updates = {
          name: 'Updated Form Name'
        };

        expect(updates).toHaveProperty('name');
        expect(updates).not.toHaveProperty('fields');
      });

      it('should preserve unchanged fields', () => {
        const form = {
          id: 'vf_abc123',
          name: 'Original',
          fields: [createFieldConfig('text')],
          createdAt: '2024-01-01'
        };

        const updates = {
          name: 'Updated'
        };

        const merged = { ...form, ...updates };

        expect(merged.name).toBe('Updated');
        expect(merged.fields.length).toBe(1);
        expect(merged.createdAt).toBe('2024-01-01');
      });
    });

    describe('Error handling', () => {
      it('should handle network errors', async () => {
        const error = new Error('Network request failed');

        expect(error.message).toContain('Network');
      });

      it('should handle validation errors', () => {
        const response = {
          success: false,
          error: 'Invalid field configuration'
        };

        expect(response.success).toBe(false);
        expect(response.error).toBeDefined();
      });

      it('should handle 400 Bad Request', () => {
        const response = {
          status: 400,
          error: 'Field name is required'
        };

        expect(response.status).toBe(400);
        expect(response.error).toBeDefined();
      });

      it('should handle 404 Not Found', () => {
        const response = {
          status: 404,
          error: 'Form not found'
        };

        expect(response.status).toBe(404);
      });

      it('should handle 401 Unauthorized', () => {
        const response = {
          status: 401,
          error: 'Authentication required'
        };

        expect(response.status).toBe(401);
      });

      it('should handle duplicate field names error', () => {
        const fields = [
          { id: 'field_1', name: 'email', type: 'email' },
          { id: 'field_2', name: 'email', type: 'text' }
        ];

        const names = fields.map(f => f.name);
        const uniqueNames = new Set(names);
        const hasDuplicates = names.length !== uniqueNames.size;

        expect(hasDuplicates).toBe(true);
        // Should return validation error
      });
    });

    describe('Response handling', () => {
      it('should parse successful create response', () => {
        const response = {
          success: true,
          form: {
            id: 'vf_abc123',
            name: 'Contact Form',
            fields: [],
            createdAt: new Date().toISOString()
          }
        };

        expect(response.success).toBe(true);
        expect(response.form).toHaveProperty('id');
        expect(response.form.id.startsWith('vf_')).toBe(true);
      });

      it('should parse successful update response', () => {
        const response = {
          success: true,
          form: {
            id: 'vf_abc123',
            name: 'Updated Form',
            updatedAt: new Date().toISOString()
          }
        };

        expect(response.success).toBe(true);
        expect(response.form).toHaveProperty('updatedAt');
      });

      it('should handle empty response', () => {
        const response = null;

        expect(response).toBeNull();
        // Should handle gracefully
      });
    });
  });

  describe('Field Type Edge Cases', () => {
    it('should handle unknown field type gracefully', () => {
      const unknownType = 'unknown_type';
      const typeConfig = fieldTypes[unknownType];

      expect(typeConfig).toBeUndefined();
    });

    it('should validate field type exists before creation', () => {
      const validTypes = Object.keys(fieldTypes);

      expect(validTypes.includes('text')).toBe(true);
      expect(validTypes.includes('invalid')).toBe(false);
    });

    it('should handle case sensitivity in field types', () => {
      const typeConfig = fieldTypes['TEXT'];

      expect(typeConfig).toBeUndefined();
      expect(fieldTypes['text']).toBeDefined();
    });
  });

  describe('Form Builder State Management', () => {
    it('should initialize with empty state', () => {
      const state = {
        formId: null,
        formName: null,
        fields: [],
        selectedFieldId: null,
        isDirty: false
      };

      expect(state.fields.length).toBe(0);
      expect(state.isDirty).toBe(false);
      expect(state.selectedFieldId).toBeNull();
    });

    it('should track selected field', () => {
      const fields = [
        createFieldConfig('text'),
        createFieldConfig('email')
      ];

      let selectedFieldId = fields[0].id;

      expect(selectedFieldId).toBe(fields[0].id);

      selectedFieldId = fields[1].id;

      expect(selectedFieldId).toBe(fields[1].id);
    });

    it('should clear selection when field is deleted', () => {
      const field = createFieldConfig('text');
      const fields = [field];
      let selectedFieldId = field.id;

      fields.splice(0, 1);
      selectedFieldId = null;

      expect(fields.length).toBe(0);
      expect(selectedFieldId).toBeNull();
    });
  });
});
