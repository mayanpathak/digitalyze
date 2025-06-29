import express from 'express';
import asyncWrapper from '../middlewares/asyncWrapper.js';
import { validateRequiredFields } from '../middlewares/validateRequest.js';
import {
  chatWithData,
  queryData,
  generateRule,
  getRuleRecommendations,
  validateExtended,
  fixErrors,
  enhanceData,
  generateInsights,
  getAIHealth
} from '../controller/ai.controller.js';

const router = express.Router();

// AI service health check
router.get('/health', asyncWrapper(getAIHealth));

// Chat with data - conversational AI insights
router.post('/chat', validateRequiredFields(['message']), asyncWrapper(chatWithData));

// Natural language query
router.post('/query', validateRequiredFields(['query']), asyncWrapper(queryData));

// Natural language rule generation
router.post('/rule', validateRequiredFields(['description']), asyncWrapper(generateRule));

// Get AI rule recommendations
router.get('/rule-recommendations', asyncWrapper(getRuleRecommendations));

// Extended AI validation
router.post('/validate-extended', asyncWrapper(validateExtended));

// AI-powered error fixing
router.post('/fix-errors', validateRequiredFields(['errors']), asyncWrapper(fixErrors));

// Data enhancement suggestions
router.post('/enhance', asyncWrapper(enhanceData));

// Generate insights
router.post('/insights', asyncWrapper(generateInsights));

export default router;