/**
 * Input validation and sanitization utilities
 *
 * Extracted from server.js
 */

const sanitizeHtml = require('sanitize-html');

/**
 * Validate email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize user input to prevent XSS
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} });
}

/**
 * Parse price string to number
 * Handles formats like "£12.99", "$15", "12.99"
 */
function priceStringToNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;

  const cleaned = value.replace(/[£$€,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Validate Stripe price ID format
 */
function isValidPriceId(priceId) {
  return typeof priceId === 'string' && priceId.startsWith('price_');
}

/**
 * Validate plan type
 */
function isValidPlanType(planType) {
  const validTypes = ['free', 'casual', 'pro', 'max', 'starter', 'business'];
  return typeof planType === 'string' && validTypes.includes(planType);
}

/**
 * Validate listing title
 */
function validateListingTitle(title) {
  if (!title || typeof title !== 'string') {
    return { valid: false, error: 'Title is required' };
  }
  if (title.trim().length === 0) {
    return { valid: false, error: 'Title cannot be empty' };
  }
  if (title.length > 500) {
    return { valid: false, error: 'Title must be 500 characters or less' };
  }
  return { valid: true };
}

/**
 * Validate listing description
 */
function validateListingDescription(description) {
  if (description && typeof description === 'string' && description.length > 10000) {
    return { valid: false, error: 'Description must be 10000 characters or less' };
  }
  return { valid: true };
}

module.exports = {
  validateEmail,
  sanitizeInput,
  priceStringToNumber,
  isValidPriceId,
  isValidPlanType,
  validateListingTitle,
  validateListingDescription,
};
