import api from './api';
import { Rule, RulePriorities, ApiResponse } from '../types';

export const rulesService = {
  // Get all rules
  async getRules(): Promise<Rule[]> {
    try {
      const response = await api.get('/rules');
      return response.data.success ? response.data.data : response.data;
    } catch (error: any) {
      console.error('[Rules Service] Failed to get rules:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get single rule
  async getRule(id: string): Promise<Rule> {
    try {
      const response = await api.get(`/rules/${id}`);
      return response.data.success ? response.data.data : response.data;
    } catch (error: any) {
      console.error(`[Rules Service] Failed to get rule ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  // Add new rule
  async addRule(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rule> {
    try {
      console.log('[Rules Service] Adding rule:', rule);
      const response = await api.post('/rules/add', rule);
      return response.data.success ? response.data.data : response.data;
    } catch (error: any) {
      console.error('[Rules Service] Failed to add rule:', error.response?.data || error.message);
      throw error;
    }
  },

  // Update rule
  async updateRule(id: string, rule: Partial<Rule>): Promise<Rule> {
    try {
      console.log(`[Rules Service] Updating rule ${id}:`, rule);
      const response = await api.put(`/rules/${id}`, rule);
      return response.data.success ? response.data.data : response.data;
    } catch (error: any) {
      console.error(`[Rules Service] Failed to update rule ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  // Delete rule
  async deleteRule(id: string): Promise<void> {
    try {
      console.log(`[Rules Service] Deleting rule ${id}`);
      await api.delete(`/rules/${id}`);
    } catch (error: any) {
      console.error(`[Rules Service] Failed to delete rule ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  // Validate rules
  async validateRules(rules: Rule[]): Promise<ApiResponse<any>> {
    try {
      console.log('[Rules Service] Validating rules:', rules.length);
      const response = await api.post('/rules/validate', { rules });
      return response.data;
    } catch (error: any) {
      console.error('[Rules Service] Failed to validate rules:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get rule priorities
  async getPriorities(): Promise<RulePriorities> {
    try {
      const response = await api.get('/rules/priorities');
      return response.data.success ? response.data.data : response.data;
    } catch (error: any) {
      console.error('[Rules Service] Failed to get priorities:', error.response?.data || error.message);
      throw error;
    }
  },

  // Update rule priorities
  async updatePriorities(priorities: RulePriorities): Promise<RulePriorities> {
    try {
      console.log('[Rules Service] Updating priorities:', priorities);
      const response = await api.post('/rules/priorities', priorities);
      return response.data.success ? response.data.data : response.data;
    } catch (error: any) {
      console.error('[Rules Service] Failed to update priorities:', error.response?.data || error.message);
      throw error;
    }
  },
};