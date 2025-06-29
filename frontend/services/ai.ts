import api, { apiWithLongTimeout } from './api';
import { AIQueryResult, AIRule, AIInsight, EntityType } from '../types';

interface AIFixError {
  id: string;
  field: string;
  error: string;
  severity?: string;
  type?: string;
  row?: number;
}

interface AIFixResponse {
  fixes: Array<{
    rowId: string;
    field: string;
    currentValue: any;
    suggestedValue: any;
    reason: string;
    confidence: number;
    originalValidationId?: string;
  }>;
}

interface AIValidationResult {
  issues?: Array<{
    rowId: string;
    field: string;
    message: string;
    severity: string;
    confidence: number;
    suggestedValue?: any;
  }>;
  summary?: {
    totalRecords: number;
    issuesFound: number;
  };
}

interface RuleRecommendation {
  type: 'coRun' | 'phaseWindow' | 'loadLimit' | 'slotRestriction' | 'precedenceOverride';
  priority: 'high' | 'medium' | 'low';
  reason: string;
  suggestedRule: any;
  expectedBenefit: string;
  confidence: number;
}

interface RuleRecommendationsResponse {
  success: boolean;
  recommendations: RuleRecommendation[];
  fromCache?: boolean;
}

export const aiService = {
  // Chat with data - conversational AI insights
  async chat(message: string, context?: any): Promise<any> {
    try {
      console.log('[AI Service] Chat message:', message);
      const response = await apiWithLongTimeout.post('/ai/chat', { message, context });
      return response.data.success ? response.data.data : response.data;
    } catch (error: any) {
      console.error('[AI Service] Chat failed:', error.response?.data || error.message);
      throw error;
    }
  },

  // Natural language query
  async query(prompt: string): Promise<AIQueryResult> {
    try {
      console.log('[AI Service] Executing query:', prompt);
      const response = await apiWithLongTimeout.post('/ai/query', { query: prompt });
      return response.data.success ? response.data.data : response.data;
    } catch (error: any) {
      console.error('[AI Service] Query failed:', error.response?.data || error.message);
      throw error;
    }
  },

  // Generate rule from natural language
  async generateRule(description: string): Promise<AIRule> {
    try {
      console.log('[AI Service] Generating rule:', description);
      const response = await apiWithLongTimeout.post('/ai/rule', { description });
      return response.data.success ? response.data.data : response.data;
    } catch (error: any) {
      console.error('[AI Service] Rule generation failed:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get AI rule recommendations
  async getRuleRecommendations(): Promise<RuleRecommendation[]> {
    try {
      console.log('[AI Service] Getting rule recommendations');
      const response = await apiWithLongTimeout.get('/ai/rule-recommendations');
      
      if (response.data.success) {
        const recommendations = response.data.data?.recommendations || response.data.recommendations || [];
        console.log('[AI Service] Retrieved', recommendations.length, 'recommendations');
        return recommendations;
      }
      console.log('[AI Service] Response not successful, returning empty array');
      return [];
    } catch (error: any) {
      console.error('[AI Service] Rule recommendations failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      // Log specific error details for debugging
      if (error.response?.status === 400) {
        console.log('[AI Service] 400 error - likely no data uploaded yet');
      }
      
      throw error;
    }
  },

  // Fix data errors using AI
  async fixErrors(entity: EntityType, errors: AIFixError[]): Promise<AIFixResponse> {
    try {
      console.log(`[AI Service] Fixing errors for ${entity}:`, errors.length);
      const response = await apiWithLongTimeout.post('/ai/fix-errors', { entity, errors });
      return response.data.success ? response.data.data : response.data;
    } catch (error: any) {
      console.error(`[AI Service] Fix errors failed for ${entity}:`, error.response?.data || error.message);
      throw error;
    }
  },

  // Extended AI validation
  async validateExtended(entity: EntityType, data?: any[]): Promise<AIInsight[]> {
    try {
      console.log(`[AI Service] Extended validation for ${entity}`);
      // Backend only needs entity, it gets data from its own dataStore
      const response = await api.post('/ai/validate-extended', { entity });
      
      if (response.data.success) {
        const validationResult: AIValidationResult = response.data.data;
        
        // Transform backend validation result to AIInsight[] format
        const insights: AIInsight[] = [];
        
        if (validationResult.issues && Array.isArray(validationResult.issues)) {
          validationResult.issues.forEach((issue) => {
            let type: 'warning' | 'suggestion' | 'info' = 'info';
            
            // Map severity to insight type
            if (issue.severity === 'high') {
              type = 'warning';
            } else if (issue.severity === 'medium') {
              type = 'suggestion';
            } else {
              type = 'info';
            }
            
            insights.push({
              type,
              title: `${issue.field} Issue`,
              description: issue.message,
              data: {
                rowId: issue.rowId,
                field: issue.field,
                severity: issue.severity,
                confidence: issue.confidence,
                suggestedValue: issue.suggestedValue
              }
            });
          });
        }
        
        // Add summary as an info insight if available
        if (validationResult.summary) {
          insights.push({
            type: 'info',
            title: 'Validation Summary',
            description: `Analyzed ${validationResult.summary.totalRecords} records and found ${validationResult.summary.issuesFound} issues.`,
            data: validationResult.summary
          });
        }
        
        return insights;
      }
      
      // If validation failed, return error as insight
      return [{
        type: 'warning',
        title: 'Validation Failed',
        description: response.data.message || response.data.error || 'AI validation encountered an error',
        data: { error: response.data.error }
      }];
    } catch (error: any) {
      console.error(`[AI Service] Extended validation failed for ${entity}:`, error.response?.data || error.message);
      return [{
        type: 'warning',
        title: 'Validation Error',
        description: error.response?.data?.message || error.message || 'AI validation encountered an error',
        data: { error: error.message }
      }];
    }
  },

  // Get AI insights
  async getInsights(entity: EntityType = 'tasks'): Promise<any> {
    try {
      console.log(`[AI Service] Getting insights for ${entity}`);
      const response = await api.post('/ai/insights', { entity });
      return response.data.success ? response.data.data : response.data;
    } catch (error: any) {
      console.error(`[AI Service] Get insights failed for ${entity}:`, error.response?.data || error.message);
      throw error;
    }
  },
};