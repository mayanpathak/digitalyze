/**
 * Validation utility functions
 */

export class ValidationUtils {
  
  /**
   * Check if a value is a valid number
   */
  static isValidNumber(value, min = null, max = null) {
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    if (min !== null && num < min) return false;
    if (max !== null && num > max) return false;
    return true;
  }

  /**
   * Check if a value is a valid integer
   */
  static isValidInteger(value, min = null, max = null) {
    const num = parseInt(value);
    if (isNaN(num) || num !== parseFloat(value)) return false;
    if (min !== null && num < min) return false;
    if (max !== null && num > max) return false;
    return true;
  }

  /**
   * Validate JSON format
   */
  static isValidJSON(value) {
    try {
      JSON.parse(value);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Parse array from string or JSON
   */
  static parseArray(value) {
    if (Array.isArray(value)) return value;
    
    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Fall back to comma-separated values
      if (typeof value === 'string') {
        return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
      }
    }
    
    return [];
  }

  /**
   * Validate email format
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format
   */
  static isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  /**
   * Check if string is empty or whitespace only
   */
  static isEmpty(value) {
    return !value || (typeof value === 'string' && value.trim().length === 0);
  }

  /**
   * Normalize string for comparison
   */
  static normalizeString(value) {
    if (!value) return '';
    return value.toString().trim().toLowerCase();
  }

  /**
   * Check for duplicate values in array
   */
  static findDuplicates(array, keyExtractor = null) {
    const seen = new Set();
    const duplicates = new Set();
    
    array.forEach((item, index) => {
      const key = keyExtractor ? keyExtractor(item, index) : item;
      if (seen.has(key)) {
        duplicates.add(key);
      } else {
        seen.add(key);
      }
    });
    
    return Array.from(duplicates);
  }

  /**
   * Validate date format
   */
  static isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  /**
   * Check if date is in the future
   */
  static isFutureDate(dateString) {
    if (!this.isValidDate(dateString)) return false;
    const date = new Date(dateString);
    return date > new Date();
  }

  /**
   * Validate URL format
   */
  static isValidURL(url) {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if value is within allowed options
   */
  static isValidOption(value, allowedOptions) {
    return allowedOptions.includes(value);
  }

  /**
   * Validate priority level (1-5)
   */
  static isValidPriority(priority) {
    return this.isValidInteger(priority, 1, 5);
  }

  /**
   * Generate validation error object
   */
  static createValidationError(id, type, severity, entity, field, message, suggestedFix, additionalData = {}) {
    return {
      id,
      type,
      severity,
      entity,
      field,
      message,
      suggestedFix,
      timestamp: new Date().toISOString(),
      ...additionalData
    };
  }

  /**
   * Sanitize string for safe output
   */
  static sanitizeString(value) {
    if (!value) return '';
    return value.toString()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .trim();
  }

  /**
   * Check if two arrays have common elements
   */
  static hasCommonElements(array1, array2) {
    const set1 = new Set(array1.map(item => this.normalizeString(item)));
    return array2.some(item => set1.has(this.normalizeString(item)));
  }

  /**
   * Calculate percentage
   */
  static calculatePercentage(part, total) {
    if (total === 0) return 0;
    return Math.round((part / total) * 100 * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Group validation errors by type
   */
  static groupErrorsByType(errors) {
    return errors.reduce((groups, error) => {
      const type = error.type || 'unknown';
      if (!groups[type]) groups[type] = [];
      groups[type].push(error);
      return groups;
    }, {});
  }

  /**
   * Group validation errors by entity
   */
  static groupErrorsByEntity(errors) {
    return errors.reduce((groups, error) => {
      const entity = error.entity || 'unknown';
      if (!groups[entity]) groups[entity] = [];
      groups[entity].push(error);
      return groups;
    }, {});
  }

  /**
   * Group validation errors by severity
   */
  static groupErrorsBySeverity(errors) {
    return errors.reduce((groups, error) => {
      const severity = error.severity || 'unknown';
      if (!groups[severity]) groups[severity] = [];
      groups[severity].push(error);
      return groups;
    }, {});
  }

  /**
   * Get validation summary statistics
   */
  static getValidationSummary(errors, warnings = []) {
    const allIssues = [...errors, ...warnings];
    
    return {
      totalIssues: allIssues.length,
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      byType: this.groupErrorsByType(allIssues),
      byEntity: this.groupErrorsByEntity(allIssues),
      bySeverity: this.groupErrorsBySeverity(allIssues),
      errorRate: this.calculatePercentage(errors.length, allIssues.length),
      warningRate: this.calculatePercentage(warnings.length, allIssues.length)
    };
  }

  /**
   * Filter errors by criteria
   */
  static filterErrors(errors, criteria = {}) {
    return errors.filter(error => {
      if (criteria.entity && error.entity !== criteria.entity) return false;
      if (criteria.type && error.type !== criteria.type) return false;
      if (criteria.severity && error.severity !== criteria.severity) return false;
      if (criteria.field && error.field !== criteria.field) return false;
      return true;
    });
  }

  /**
   * Sort errors by priority (errors first, then warnings)
   */
  static sortErrorsByPriority(errors) {
    const severityOrder = { 'error': 0, 'warning': 1, 'info': 2 };
    
    return errors.sort((a, b) => {
      const aSeverity = severityOrder[a.severity] || 3;
      const bSeverity = severityOrder[b.severity] || 3;
      
      if (aSeverity !== bSeverity) {
        return aSeverity - bSeverity;
      }
      
      // Secondary sort by entity
      if (a.entity !== b.entity) {
        return a.entity.localeCompare(b.entity);
      }
      
      // Tertiary sort by type
      return (a.type || '').localeCompare(b.type || '');
    });
  }

  /**
   * Check if validation result is acceptable (no errors, warnings OK)
   */
  static isValidationAcceptable(validationResult, allowWarnings = true) {
    if (!validationResult) return false;
    
    const hasErrors = validationResult.errors && validationResult.errors.length > 0;
    const hasWarnings = validationResult.warnings && validationResult.warnings.length > 0;
    
    if (hasErrors) return false;
    if (hasWarnings && !allowWarnings) return false;
    
    return true;
  }

  /**
   * Generate fix suggestions based on error type
   */
  static generateFixSuggestions(error) {
    const suggestions = [];
    
    switch (error.type) {
      case 'missing_required_column':
        suggestions.push(`Add the '${error.field}' column to your CSV file`);
        suggestions.push(`Ensure column headers match exactly: ${error.field}`);
        break;
        
      case 'duplicate_id':
        suggestions.push(`Remove duplicate entries with ID: ${error.recordId}`);
        suggestions.push(`Use unique identifiers for each record`);
        break;
        
      case 'malformed_data':
        suggestions.push(`Fix data format for field '${error.field}'`);
        suggestions.push(`Check data type requirements for this field`);
        break;
        
      case 'out_of_range':
        suggestions.push(`Adjust value to be within valid range`);
        suggestions.push(`Check field constraints and limits`);
        break;
        
      case 'skill_coverage_gap':
        suggestions.push(`Add workers with the required skill`);
        suggestions.push(`Modify task requirements to use available skills`);
        break;
        
      case 'phase_slot_saturation':
        suggestions.push(`Add more workers for the overloaded phase`);
        suggestions.push(`Redistribute tasks across different phases`);
        break;
        
      default:
        suggestions.push(`Review the data for field '${error.field || 'unknown'}'`);
        suggestions.push(`Consult documentation for proper formatting`);
    }
    
    return suggestions;
  }
} 