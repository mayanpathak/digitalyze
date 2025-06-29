import { validationResult } from 'express-validator';

/**
 * Middleware to handle validation results from express-validator
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Request validation failed',
      details: errors.array()
    });
  }
  
  next();
};

/**
 * Custom validation middleware for specific business rules
 */
export const validateEntity = (entity) => {
  return (req, res, next) => {
    const validEntities = ['clients', 'workers', 'tasks'];
    
    if (!validEntities.includes(entity)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Entity',
        message: `Entity must be one of: ${validEntities.join(', ')}`
      });
    }
    
    req.entity = entity;
    next();
  };
};

/**
 * Middleware to validate required fields in request body
 */
export const validateRequiredFields = (requiredFields) => {
  return (req, res, next) => {
    const missingFields = [];
    
    requiredFields.forEach(field => {
      if (!req.body[field]) {
        missingFields.push(field);
      }
    });
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing Required Fields',
        message: `The following fields are required: ${missingFields.join(', ')}`,
        missingFields
      });
    }
    
    next();
  };
};

export default {
  handleValidationErrors,
  validateEntity,
  validateRequiredFields
};