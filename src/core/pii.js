/**
 * VeilForms - PII Detection & Stripping Module
 * Validates and sanitizes form data before storage
 * Based on ZTA.io Zero Trust principles
 */

// Common PII patterns
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,
  ssn: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
  creditCard: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  ipv6: /\b(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}\b/g,
  // US ZIP codes
  zipCode: /\b\d{5}(?:-\d{4})?\b/g,
  // Date of birth patterns (various formats)
  dob: /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g,
};

// Field names that typically contain PII
const PII_FIELD_NAMES = [
  'email', 'mail', 'e-mail',
  'name', 'firstname', 'first_name', 'lastname', 'last_name', 'fullname', 'full_name',
  'phone', 'telephone', 'mobile', 'cell',
  'ssn', 'social', 'socialsecurity',
  'address', 'street', 'city', 'state', 'zip', 'zipcode', 'postal',
  'dob', 'birthday', 'birthdate', 'dateofbirth',
  'creditcard', 'cc', 'cardnumber', 'cvv', 'cvc',
  'password', 'pass', 'pwd',
  'ip', 'ipaddress',
];

/**
 * Detect PII in form data
 * @param {object} formData - The form submission data
 * @returns {object} - Detection results with found PII types
 */
export function detectPII(formData) {
  const detected = {
    hasPII: false,
    fields: [],
    patterns: [],
  };

  for (const [fieldName, value] of Object.entries(formData)) {
    const normalizedName = fieldName.toLowerCase().replace(/[-_\s]/g, '');

    // Check field name
    if (PII_FIELD_NAMES.some(pii => normalizedName.includes(pii))) {
      detected.hasPII = true;
      detected.fields.push({
        field: fieldName,
        reason: 'field_name_suggests_pii',
      });
    }

    // Check value patterns (only for strings)
    if (typeof value === 'string') {
      for (const [patternName, regex] of Object.entries(PII_PATTERNS)) {
        // Reset regex state
        regex.lastIndex = 0;
        if (regex.test(value)) {
          detected.hasPII = true;
          detected.patterns.push({
            field: fieldName,
            type: patternName,
          });
        }
      }
    }
  }

  return detected;
}

/**
 * Validate that form data contains no PII
 * Throws error if PII is detected
 * @param {object} formData - The form submission data
 * @param {object} options - Validation options
 * @returns {object} - Validated data if clean
 */
export function validateNoPII(formData, options = {}) {
  const { strict = true, allowFields = [] } = options;

  const detection = detectPII(formData);

  if (detection.hasPII) {
    // Filter out allowed fields
    const violations = [
      ...detection.fields.filter(f => !allowFields.includes(f.field)),
      ...detection.patterns.filter(p => !allowFields.includes(p.field)),
    ];

    if (violations.length > 0 && strict) {
      const error = new Error('PII detected in form submission');
      error.code = 'PII_DETECTED';
      error.violations = violations;
      throw error;
    }
  }

  return { valid: true, data: formData };
}

/**
 * Strip PII from form data before storage
 * Replaces detected PII with redaction markers
 * @param {object} formData - The form submission data
 * @param {object} options - Strip options
 * @returns {object} - Sanitized form data
 */
export async function stripPII(formData, options = {}) {
  const {
    redactionMarker = '[REDACTED]',
    preserveFields = [],
    hashInsteadOfRedact = false,
  } = options;

  const sanitized = { ...formData };
  const strippedFields = [];

  for (const [fieldName, value] of Object.entries(sanitized)) {
    // Skip preserved fields
    if (preserveFields.includes(fieldName)) continue;

    const normalizedName = fieldName.toLowerCase().replace(/[-_\s]/g, '');

    // Check if field name suggests PII
    const isPIIField = PII_FIELD_NAMES.some(pii => normalizedName.includes(pii));

    if (isPIIField) {
      if (hashInsteadOfRedact && typeof value === 'string') {
        // Hash the value for de-duplication without exposing PII
        sanitized[fieldName] = await hashValue(value);
      } else {
        sanitized[fieldName] = redactionMarker;
      }
      strippedFields.push(fieldName);
      continue;
    }

    // Check value patterns
    if (typeof value === 'string') {
      let cleanValue = value;
      for (const [patternName, regex] of Object.entries(PII_PATTERNS)) {
        regex.lastIndex = 0;
        if (regex.test(cleanValue)) {
          cleanValue = cleanValue.replace(regex, redactionMarker);
          if (!strippedFields.includes(fieldName)) {
            strippedFields.push(fieldName);
          }
        }
      }
      sanitized[fieldName] = cleanValue;
    }
  }

  return {
    data: sanitized,
    strippedFields,
    wasModified: strippedFields.length > 0,
  };
}

/**
 * Hash a value for anonymous comparison
 * @param {string} value - Value to hash
 * @returns {Promise<string>} - Hashed value
 */
async function hashValue(value) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return 'hash:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Create a PII-safe schema validator
 * Returns a function that validates form data against allowed fields
 * @param {object} schema - Field definitions with PII flags
 * @returns {function} - Validator function
 */
export function createPIISchema(schema) {
  return function validate(formData) {
    const errors = [];
    const warnings = [];

    for (const [fieldName, value] of Object.entries(formData)) {
      const fieldSchema = schema[fieldName];

      if (!fieldSchema) {
        warnings.push(`Unknown field: ${fieldName}`);
        continue;
      }

      if (fieldSchema.noPII && typeof value === 'string') {
        for (const [patternName, regex] of Object.entries(PII_PATTERNS)) {
          regex.lastIndex = 0;
          if (regex.test(value)) {
            errors.push(`Field "${fieldName}" contains ${patternName} but is marked as noPII`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  };
}
