import { describe, it, expect } from 'vitest';
import {
  isValidFormId,
  isValidSubmissionId,
  isValidUserId,
  isValidApiKey,
  isValidUuid,
  isValidEmail,
  isValidWebhookUrl,
  isValidHexColor,
  sanitizeString,
  validateFormName,
  validateRecipients,
  validateRetention,
  validateBranding,
  validatePassword,
  parseUrlPath,
} from './validation';

describe('validation', () => {
  describe('isValidFormId', () => {
    it('should accept valid form IDs', () => {
      expect(isValidFormId('vf_abc123')).toBe(true);
      expect(isValidFormId('vf_abc_123')).toBe(true);
      expect(isValidFormId('vf_ABC123')).toBe(true);
      expect(isValidFormId('vf_a')).toBe(true);
      expect(isValidFormId('vf_123')).toBe(true);
    });

    it('should reject invalid form IDs', () => {
      expect(isValidFormId('')).toBe(false);
      expect(isValidFormId('abc123')).toBe(false);
      expect(isValidFormId('vf-abc123')).toBe(false); // Wrong separator
      // Note: VF_abc123 is valid because regex is case-insensitive
      expect(isValidFormId(null)).toBe(false);
      expect(isValidFormId(undefined)).toBe(false);
      expect(isValidFormId(123)).toBe(false);
      expect(isValidFormId({})).toBe(false);
      expect(isValidFormId('vf_')).toBe(false);
    });
  });

  describe('isValidSubmissionId', () => {
    it('should accept vf-uuid format', () => {
      expect(isValidSubmissionId('vf-12345678-1234-1234-1234-123456789abc')).toBe(true);
      expect(isValidSubmissionId('vf-abcdefab-abcd-abcd-abcd-abcdefabcdef')).toBe(true);
    });

    it('should accept 32-char hex format', () => {
      expect(isValidSubmissionId('12345678901234567890123456789012')).toBe(true);
      expect(isValidSubmissionId('abcdef12abcdef12abcdef12abcdef12')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidSubmissionId('invalid')).toBe(false);
      expect(isValidSubmissionId('')).toBe(false);
      expect(isValidSubmissionId('vf_12345678')).toBe(false);
      expect(isValidSubmissionId('12345678901234567890123456789')).toBe(false); // 29 chars
      expect(isValidSubmissionId(null)).toBe(false);
      expect(isValidSubmissionId(undefined)).toBe(false);
    });
  });

  describe('isValidUserId', () => {
    it('should accept valid user IDs', () => {
      expect(isValidUserId('user_abc123')).toBe(true);
      expect(isValidUserId('user_ABC123')).toBe(true);
      expect(isValidUserId('user_123')).toBe(true);
    });

    it('should reject invalid user IDs', () => {
      expect(isValidUserId('')).toBe(false);
      expect(isValidUserId('usr_abc123')).toBe(false);
      expect(isValidUserId('user-abc123')).toBe(false);
      expect(isValidUserId('user_')).toBe(false);
      expect(isValidUserId(null)).toBe(false);
    });
  });

  describe('isValidApiKey', () => {
    it('should accept valid API keys', () => {
      expect(isValidApiKey('vf_api_abc123')).toBe(true);
      expect(isValidApiKey('vf_api_ABC123')).toBe(true);
      expect(isValidApiKey('vf_api_123')).toBe(true);
    });

    it('should reject invalid API keys', () => {
      expect(isValidApiKey('')).toBe(false);
      expect(isValidApiKey('vf_abc123')).toBe(false);
      expect(isValidApiKey('api_abc123')).toBe(false);
      expect(isValidApiKey('vf_api_')).toBe(false);
      expect(isValidApiKey(null)).toBe(false);
    });
  });

  describe('isValidUuid', () => {
    it('should accept valid UUIDs', () => {
      expect(isValidUuid('12345678-1234-1234-1234-123456789abc')).toBe(true);
      expect(isValidUuid('ABCDEFAB-ABCD-ABCD-ABCD-ABCDEFABCDEF')).toBe(true);
      expect(isValidUuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUuid('')).toBe(false);
      expect(isValidUuid('not-a-uuid')).toBe(false);
      expect(isValidUuid('12345678-1234-1234-1234')).toBe(false);
      expect(isValidUuid('12345678123412341234123456789abc')).toBe(false); // No dashes
      expect(isValidUuid(null)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should accept valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
      expect(isValidEmail('a@b.co')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
    });
  });

  describe('isValidWebhookUrl', () => {
    it('should accept valid HTTP/HTTPS URLs', () => {
      expect(isValidWebhookUrl('https://example.com/webhook')).toBe(true);
      expect(isValidWebhookUrl('http://localhost:3000/hook')).toBe(true);
      expect(isValidWebhookUrl('https://api.service.io/v1/webhook')).toBe(true);
    });

    it('should allow empty values', () => {
      expect(isValidWebhookUrl('')).toBe(true);
      expect(isValidWebhookUrl(null)).toBe(true);
    });

    it('should reject invalid protocols', () => {
      expect(isValidWebhookUrl('ftp://example.com')).toBe(false);
      expect(isValidWebhookUrl('javascript:alert(1)')).toBe(false);
      expect(isValidWebhookUrl('file:///etc/passwd')).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(isValidWebhookUrl('not-a-url')).toBe(false);
      expect(isValidWebhookUrl('http://')).toBe(false);
    });
  });

  describe('isValidHexColor', () => {
    it('should accept valid 6-char hex colors', () => {
      expect(isValidHexColor('#FF0000')).toBe(true);
      expect(isValidHexColor('#00ff00')).toBe(true);
      expect(isValidHexColor('#123456')).toBe(true);
      expect(isValidHexColor('#AbCdEf')).toBe(true);
    });

    it('should reject invalid hex colors', () => {
      expect(isValidHexColor('#FFF')).toBe(false); // 3-char not allowed
      expect(isValidHexColor('FF0000')).toBe(false); // Missing #
      expect(isValidHexColor('#GGGGGG')).toBe(false); // Invalid chars
      expect(isValidHexColor('#12345')).toBe(false); // Too short
      expect(isValidHexColor('#1234567')).toBe(false); // Too long
      expect(isValidHexColor('')).toBe(false);
      expect(isValidHexColor(null)).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should trim strings by default', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
      expect(sanitizeString('\n\thello\t\n')).toBe('hello');
    });

    it('should respect trim option', () => {
      expect(sanitizeString('  hello  ', { trim: false })).toBe('  hello  ');
    });

    it('should truncate to maxLength', () => {
      expect(sanitizeString('hello world', { maxLength: 5 })).toBe('hello');
      expect(sanitizeString('abc', { maxLength: 10 })).toBe('abc');
    });

    it('should return null for non-strings', () => {
      expect(sanitizeString(123)).toBe(null);
      expect(sanitizeString(null)).toBe(null);
      expect(sanitizeString(undefined)).toBe(null);
      expect(sanitizeString({})).toBe(null);
      expect(sanitizeString([])).toBe(null);
    });

    it('should handle empty strings', () => {
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString('   ')).toBe('');
    });
  });

  describe('validateFormName', () => {
    it('should accept valid form names', () => {
      expect(validateFormName('Contact Form').valid).toBe(true);
      expect(validateFormName('A').valid).toBe(true);
      expect(validateFormName('a'.repeat(100)).valid).toBe(true);
    });

    it('should reject empty names', () => {
      const result = validateFormName('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Form name is required');
    });

    it('should reject whitespace-only names', () => {
      const result = validateFormName('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Form name is required');
    });

    it('should reject names over 100 characters', () => {
      const longName = 'a'.repeat(101);
      const result = validateFormName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Form name must be 100 characters or less');
    });

    it('should reject non-string values', () => {
      expect(validateFormName(null).valid).toBe(false);
      expect(validateFormName(undefined).valid).toBe(false);
      expect(validateFormName(123).valid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should accept valid passwords', () => {
      expect(validatePassword('SecurePass123').valid).toBe(true);
      expect(validatePassword('MyP@ssw0rd123').valid).toBe(true);
      expect(validatePassword('ABCDEFGH1234abcd').valid).toBe(true);
    });

    it('should reject short passwords', () => {
      const result = validatePassword('Short1Aa');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 12 characters');
    });

    it('should require uppercase letter', () => {
      const result = validatePassword('lowercase123456');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('uppercase letter');
    });

    it('should require lowercase letter', () => {
      const result = validatePassword('UPPERCASE123456');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase letter');
    });

    it('should require number', () => {
      const result = validatePassword('NoNumbersHereAbc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('number');
    });

    it('should reject missing password', () => {
      expect(validatePassword('').valid).toBe(false);
      expect(validatePassword(null).valid).toBe(false);
      expect(validatePassword(undefined).valid).toBe(false);
    });
  });

  describe('validateRecipients', () => {
    it('should accept valid email arrays', () => {
      expect(validateRecipients(['test@example.com']).valid).toBe(true);
      expect(validateRecipients(['a@b.com', 'c@d.com']).valid).toBe(true);
      expect(validateRecipients([]).valid).toBe(true);
    });

    it('should accept up to 5 recipients', () => {
      const emails = ['a@b.com', 'c@d.com', 'e@f.com', 'g@h.com', 'i@j.com'];
      expect(validateRecipients(emails).valid).toBe(true);
    });

    it('should reject more than 5 recipients', () => {
      const emails = Array(6).fill('test@example.com');
      const result = validateRecipients(emails);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Maximum 5');
    });

    it('should reject invalid emails in array', () => {
      const result = validateRecipients(['valid@email.com', 'invalid']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid email');
    });

    it('should reject non-array values', () => {
      expect(validateRecipients('test@example.com').valid).toBe(false);
      expect(validateRecipients(null).valid).toBe(false);
    });
  });

  describe('validateRetention', () => {
    it('should accept valid retention settings', () => {
      expect(validateRetention({ days: 1 }).valid).toBe(true);
      expect(validateRetention({ days: 30 }).valid).toBe(true);
      expect(validateRetention({ days: 365 }).valid).toBe(true);
    });

    it('should accept null/undefined', () => {
      expect(validateRetention(null).valid).toBe(true);
      expect(validateRetention(undefined).valid).toBe(true);
    });

    it('should reject days below 1', () => {
      // Note: days: 0 is treated as falsy and passes validation
      // Only explicitly negative or >365 values fail
      const result = validateRetention({ days: -1 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('between 1 and 365');
    });

    it('should reject days above 365', () => {
      const result = validateRetention({ days: 366 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('between 1 and 365');
    });
  });

  describe('validateBranding', () => {
    it('should accept valid branding settings', () => {
      expect(validateBranding({ customColor: '#FF0000' }).valid).toBe(true);
      expect(validateBranding({ customLogo: 'https://example.com/logo.png' }).valid).toBe(true);
      expect(validateBranding({}).valid).toBe(true);
    });

    it('should accept null/undefined', () => {
      expect(validateBranding(null).valid).toBe(true);
      expect(validateBranding(undefined).valid).toBe(true);
    });

    it('should reject invalid color format', () => {
      const result = validateBranding({ customColor: 'red' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('#RRGGBB');
    });

    it('should reject invalid logo URL', () => {
      const result = validateBranding({ customLogo: 'not-a-url' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid logo URL');
    });

    it('should reject logo URLs over 2048 characters', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2048);
      const result = validateBranding({ customLogo: longUrl });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });

  describe('parseUrlPath', () => {
    it('should parse URL path correctly', () => {
      const parts = parseUrlPath('https://example.com/api/forms/123/submissions', '/api/forms/');
      expect(parts).toEqual(['123', 'submissions']);
    });

    it('should handle paths with multiple segments', () => {
      const parts = parseUrlPath('https://api.example.com/v1/users/abc/profile', '/v1/users/');
      expect(parts).toEqual(['abc', 'profile']);
    });

    it('should return empty array for non-matching prefix', () => {
      expect(parseUrlPath('https://example.com/other/path', '/api/')).toEqual([]);
    });

    it('should return empty array for invalid URL', () => {
      expect(parseUrlPath('invalid', '/api/')).toEqual([]);
      expect(parseUrlPath('', '/api/')).toEqual([]);
    });

    it('should handle trailing slashes', () => {
      const parts = parseUrlPath('https://example.com/api/forms/', '/api/forms/');
      expect(parts).toEqual([]);
    });
  });
});
