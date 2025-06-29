import express from 'express';
import asyncWrapper from '../middlewares/asyncWrapper.js';
import { validateRequiredFields } from '../middlewares/validateRequest.js';
import {
  getRules,
  addRule,
  updateRule,
  deleteRule,
  getPriorities,
  setPriorities,
  validateRules
} from '../controller/rules.controller.js';

const router = express.Router();

// Rules management
router.get('/', asyncWrapper(getRules));
router.post('/add', validateRequiredFields(['type']), asyncWrapper(addRule));
router.put('/:id', asyncWrapper(updateRule));
router.delete('/:id', asyncWrapper(deleteRule));
router.post('/validate', asyncWrapper(validateRules));

// Priorities management
router.get('/priorities', asyncWrapper(getPriorities));
router.post('/priorities', asyncWrapper(setPriorities));

export default router;