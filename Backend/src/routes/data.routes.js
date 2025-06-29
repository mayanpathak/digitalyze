// routes/data.routes.js
import express from 'express';
import asyncWrapper from '../middlewares/asyncWrapper.js';
import { validateEntity } from '../middlewares/validateRequest.js';
import {
  getData,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  searchRecords,
  validateData,
  getDataStats,
  exportData,
  exportSingleEntity,
  clearData,
  validateEnhanced,
  getValidationSummary,
  applyFixes
} from '../controller/data.controller.js';

const router = express.Router();

// Enhanced validation endpoints (must come before entity-specific routes)
router.get('/validation-summary', asyncWrapper(getValidationSummary));
router.post('/validate-enhanced', asyncWrapper(validateEnhanced));
router.post('/apply-fixes', asyncWrapper(applyFixes));

// Get all data for an entity
router.get('/:entity', asyncWrapper(getData));

// Search records in an entity (must come before /:entity/:id)
router.get('/:entity/search', asyncWrapper(searchRecords));

// Get data statistics (must come before /:entity/:id)
router.get('/:entity/stats', asyncWrapper(getDataStats));

// Export single entity as CSV (must come before /:entity/:id)
router.get('/:entity/export', asyncWrapper(exportSingleEntity));

// Get single entity by ID (must come after specific routes)
router.get('/:entity/:id', asyncWrapper(getRecord));

// Validate data for an entity
router.post('/:entity/validate', asyncWrapper(validateData));

// Create new entity record
router.post('/:entity', asyncWrapper(createRecord));

// Update a specific record
router.patch('/:entity/:id', asyncWrapper(updateRecord));

// Delete a specific record
router.delete('/:entity/:id', asyncWrapper(deleteRecord));

// Export data
router.post('/export', asyncWrapper(exportData));

// Clear all data for an entity
router.delete('/:entity', asyncWrapper(clearData));

export default router;