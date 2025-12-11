/**
 * @jest-environment jsdom
 */

import { describe, it, expect } from '@jest/globals';
import {
  detectPII,
  validateNoPII,
  stripPII,
  createPIISchema
} from '../pii.js';

describe('PII Detection Module', () => {
  describe('detectPII', () => {
    describe('Field Name Detection', () => {
      it('should detect email field name', () => {
        const result = detectPII({ email: 'test' });

        expect(result.hasPII).toBe(true);
        expect(result.fields).toContainEqual(
          expect.objectContaining({ field: 'email', reason: 'field_name_suggests_pii' })
        );
      });

      it('should detect name variations', () => {
        const variations = ['name', 'firstName', 'first_name', 'lastName', 'fullName'];

        variations.forEach(fieldName => {
          const result = detectPII({ [fieldName]: 'John' });
          expect(result.hasPII).toBe(true);
        });
      });

      it('should detect phone field variations', () => {
        const variations = ['phone', 'telephone', 'mobile', 'cell'];

        variations.forEach(fieldName => {
          const result = detectPII({ [fieldName]: '123' });
          expect(result.hasPII).toBe(true);
        });
      });

      it('should detect SSN field names', () => {
        const result = detectPII({ ssn: '123-45-6789' });

        expect(result.hasPII).toBe(true);
      });

      it('should detect address-related fields', () => {
        const addressFields = ['address', 'street', 'city', 'state', 'zip', 'zipcode', 'postal'];

        addressFields.forEach(field => {
          const result = detectPII({ [field]: 'value' });
          expect(result.hasPII).toBe(true);
        });
      });

      it('should detect password fields', () => {
        const result = detectPII({ password: 'secret123' });

        expect(result.hasPII).toBe(true);
      });

      it('should be case-insensitive for field names', () => {
        const result = detectPII({ EMAIL: 'test', NAME: 'John' });

        expect(result.hasPII).toBe(true);
        expect(result.fields.length).toBe(2);
      });

      it('should detect fields with underscores and hyphens', () => {
        const result = detectPII({
          'first-name': 'John',
          'last_name': 'Doe',
          'e-mail': 'test@test.com'
        });

        expect(result.hasPII).toBe(true);
        expect(result.fields.length).toBe(3);
      });
    });

    describe('Pattern Detection', () => {
      it('should detect email patterns', () => {
        const result = detectPII({ message: 'Contact me at john@example.com please' });

        expect(result.hasPII).toBe(true);
        expect(result.patterns).toContainEqual(
          expect.objectContaining({ field: 'message', type: 'email' })
        );
      });

      it('should detect US phone numbers', () => {
        const phoneFormats = [
          '555-123-4567',
          '(555) 123-4567',
          '555.123.4567',
          '+1 555-123-4567',
          '5551234567'
        ];

        phoneFormats.forEach(phone => {
          const result = detectPII({ text: phone });
          expect(result.hasPII).toBe(true);
          expect(result.patterns).toContainEqual(
            expect.objectContaining({ type: 'phone' })
          );
        });
      });

      it('should detect SSN patterns', () => {
        const ssnFormats = ['123-45-6789', '123 45 6789', '123.45.6789'];

        ssnFormats.forEach(ssn => {
          const result = detectPII({ data: ssn });
          expect(result.hasPII).toBe(true);
          expect(result.patterns).toContainEqual(
            expect.objectContaining({ type: 'ssn' })
          );
        });
      });

      it('should detect credit card patterns', () => {
        const ccFormats = [
          '4111-1111-1111-1111',
          '4111 1111 1111 1111',
          '4111111111111111'
        ];

        ccFormats.forEach(cc => {
          const result = detectPII({ payment: cc });
          expect(result.hasPII).toBe(true);
          expect(result.patterns).toContainEqual(
            expect.objectContaining({ type: 'creditCard' })
          );
        });
      });

      it('should detect IPv4 addresses', () => {
        const result = detectPII({ log: 'User IP: 192.168.1.100' });

        expect(result.hasPII).toBe(true);
        expect(result.patterns).toContainEqual(
          expect.objectContaining({ type: 'ipv4' })
        );
      });

      it('should detect ZIP codes', () => {
        const result = detectPII({ location: 'Area 90210 is nice' });

        expect(result.hasPII).toBe(true);
        expect(result.patterns).toContainEqual(
          expect.objectContaining({ type: 'zipCode' })
        );
      });

      it('should detect ZIP+4 format', () => {
        const result = detectPII({ zip: '90210-1234' });

        expect(result.hasPII).toBe(true);
      });

      it('should detect date of birth patterns', () => {
        const dobFormats = ['01/15/1990', '1-15-1990', '12/31/2000'];

        dobFormats.forEach(dob => {
          const result = detectPII({ birthday: dob });
          expect(result.hasPII).toBe(true);
        });
      });
    });

    describe('Clean Data', () => {
      it('should return hasPII=false for clean data', () => {
        const result = detectPII({
          subject: 'General inquiry',
          message: 'I have a question about your product',
          rating: 5
        });

        expect(result.hasPII).toBe(false);
        expect(result.fields).toEqual([]);
        expect(result.patterns).toEqual([]);
      });

      it('should handle empty object', () => {
        const result = detectPII({});

        expect(result.hasPII).toBe(false);
      });

      it('should handle non-string values', () => {
        const result = detectPII({
          count: 42,
          active: true,
          items: ['a', 'b', 'c'],
          nested: { value: 123 }
        });

        expect(result.hasPII).toBe(false);
      });
    });

    describe('Multiple Detections', () => {
      it('should detect multiple PII types in same submission', () => {
        const result = detectPII({
          email: 'john@example.com',
          phone: '555-123-4567',
          ssn: '123-45-6789',
          message: 'My card is 4111-1111-1111-1111'
        });

        expect(result.hasPII).toBe(true);
        expect(result.fields.length).toBeGreaterThan(0);
        expect(result.patterns.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateNoPII', () => {
    it('should pass for clean data', () => {
      const result = validateNoPII({
        subject: 'Question',
        message: 'Hello, I have a question'
      });

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should throw error for PII in strict mode', () => {
      expect(() => {
        validateNoPII({ email: 'test@test.com' });
      }).toThrow('PII detected');
    });

    it('should include violations in error', () => {
      try {
        validateNoPII({ phone: '555-123-4567' });
        fail('Should have thrown');
      } catch (error) {
        expect(error.code).toBe('PII_DETECTED');
        expect(error.violations).toBeDefined();
      }
    });

    it('should allow specific fields when allowFields is specified', () => {
      const result = validateNoPII(
        { email: 'test@test.com', name: 'John' },
        { allowFields: ['email', 'name'] }
      );

      expect(result.valid).toBe(true);
    });

    it('should not throw in non-strict mode', () => {
      const result = validateNoPII(
        { email: 'test@test.com' },
        { strict: false }
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('stripPII', () => {
    it('should redact PII field names', async () => {
      const result = await stripPII({
        email: 'john@example.com',
        name: 'John Doe',
        message: 'Hello'
      });

      expect(result.data.email).toBe('[REDACTED]');
      expect(result.data.name).toBe('[REDACTED]');
      expect(result.data.message).toBe('Hello');
    });

    it('should redact PII patterns in values', async () => {
      const result = await stripPII({
        note: 'Call me at 555-123-4567 or email john@test.com'
      });

      expect(result.data.note).not.toContain('555-123-4567');
      expect(result.data.note).not.toContain('john@test.com');
      expect(result.data.note).toContain('[REDACTED]');
    });

    it('should use custom redaction marker', async () => {
      const result = await stripPII(
        { email: 'test@test.com' },
        { redactionMarker: '***' }
      );

      expect(result.data.email).toBe('***');
    });

    it('should preserve specified fields', async () => {
      const result = await stripPII(
        { email: 'test@test.com', phone: '555-1234' },
        { preserveFields: ['email'] }
      );

      expect(result.data.email).toBe('test@test.com');
      expect(result.data.phone).toBe('[REDACTED]');
    });

    it('should track stripped fields', async () => {
      const result = await stripPII({
        email: 'test@test.com',
        name: 'John',
        subject: 'Hello'
      });

      expect(result.strippedFields).toContain('email');
      expect(result.strippedFields).toContain('name');
      expect(result.strippedFields).not.toContain('subject');
    });

    it('should set wasModified flag correctly', async () => {
      const cleanResult = await stripPII({ message: 'Hello' });
      const dirtyResult = await stripPII({ email: 'test@test.com' });

      expect(cleanResult.wasModified).toBe(false);
      expect(dirtyResult.wasModified).toBe(true);
    });

    it('should handle multiple patterns in same value', async () => {
      const result = await stripPII({
        info: 'Email: test@test.com, Phone: 555-123-4567, SSN: 123-45-6789'
      });

      expect(result.data.info).not.toContain('test@test.com');
      expect(result.data.info).not.toContain('555-123-4567');
      expect(result.data.info).not.toContain('123-45-6789');
    });

    it('should not modify original object', async () => {
      const original = { email: 'test@test.com' };
      await stripPII(original);

      expect(original.email).toBe('test@test.com');
    });
  });

  describe('createPIISchema', () => {
    it('should create a validator function', () => {
      const validator = createPIISchema({
        subject: { noPII: true },
        message: { noPII: true }
      });

      expect(typeof validator).toBe('function');
    });

    it('should validate clean data against schema', () => {
      const validator = createPIISchema({
        subject: { noPII: true },
        message: { noPII: true }
      });

      const result = validator({
        subject: 'Question',
        message: 'Hello there'
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect PII in noPII fields', () => {
      const validator = createPIISchema({
        notes: { noPII: true }
      });

      const result = validator({
        notes: 'My email is test@example.com'
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('email');
    });

    it('should warn about unknown fields', () => {
      const validator = createPIISchema({
        subject: { noPII: true }
      });

      const result = validator({
        subject: 'Hello',
        unknownField: 'data'
      });

      expect(result.warnings).toContain('Unknown field: unknownField');
    });

    it('should allow PII in fields not marked noPII', () => {
      const validator = createPIISchema({
        contactEmail: { noPII: false },
        notes: { noPII: true }
      });

      const result = validator({
        contactEmail: 'test@example.com',
        notes: 'General inquiry'
      });

      expect(result.valid).toBe(true);
    });

    it('should detect multiple PII types', () => {
      const validator = createPIISchema({
        bio: { noPII: true }
      });

      const result = validator({
        bio: 'Call 555-123-4567 or email me@test.com, SSN: 123-45-6789'
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', () => {
      const result = detectPII({ field: null });

      expect(result.hasPII).toBe(false);
    });

    it('should handle undefined values', () => {
      const result = detectPII({ field: undefined });

      expect(result.hasPII).toBe(false);
    });

    it('should handle empty strings', () => {
      const result = detectPII({ email: '' });

      // Field name still suggests PII
      expect(result.hasPII).toBe(true);
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000) + 'test@example.com' + 'b'.repeat(10000);
      const result = detectPII({ text: longString });

      expect(result.hasPII).toBe(true);
      expect(result.patterns).toContainEqual(
        expect.objectContaining({ type: 'email' })
      );
    });

    it('should handle special characters in field names', () => {
      const result = detectPII({
        'user.email': 'test',
        'contact[phone]': '123'
      });

      expect(result.hasPII).toBe(true);
    });
  });
});
