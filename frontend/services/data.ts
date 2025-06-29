import api, { handleApiResponse } from './api';
import { ApiResponse, PaginatedResponse, EntityType, EntityData, EntityFilters, BackendPaginatedResponse } from '../types';

export const dataService = {
  // Get all entities with pagination and filters
  async getEntities(
    entity: EntityType, 
    page: number = 1, 
    limit: number = 50, 
    filters: EntityFilters = {}
  ): Promise<PaginatedResponse<EntityData>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
      ),
    });

    const response = await api.get(`/data/${entity}?${params}`);
    
    // Handle backend response format
    if (response.data.success) {
      const backendResponse = response.data as BackendPaginatedResponse<EntityData>;
      return {
        items: backendResponse.data || [],
        total: backendResponse.pagination?.total || 0,
        page: backendResponse.pagination?.page || page,
        limit: backendResponse.pagination?.limit || limit,
        totalPages: backendResponse.pagination?.totalPages || Math.ceil((backendResponse.pagination?.total || 0) / limit)
      };
    }
    
    // Fallback for different response format
    return {
      items: Array.isArray(response.data) ? response.data : [],
      total: Array.isArray(response.data) ? response.data.length : 0,
      page: page,
      limit: limit,
      totalPages: 1
    };
  },

  // Get single entity by ID
  async getEntity(entity: EntityType, id: string): Promise<EntityData> {
    try {
      console.log(`[Data Service] Getting ${entity} record with ID: ${id}`);
      const response = await api.get(`/data/${entity}/${id}`);
      return handleApiResponse<EntityData>(response);
    } catch (error: any) {
      console.error(`[Data Service] Failed to get ${entity} record ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  // Create new entity
  async createEntity(entity: EntityType, data: Partial<EntityData>): Promise<EntityData> {
    try {
      console.log(`[Data Service] Creating ${entity} record:`, data);
      const response = await api.post(`/data/${entity}`, data);
      return handleApiResponse<EntityData>(response);
    } catch (error: any) {
      console.error(`[Data Service] Failed to create ${entity} record:`, error.response?.data || error.message);
      throw error;
    }
  },

  // Update entity
  async updateEntity(entity: EntityType, id: string, data: Partial<EntityData>): Promise<EntityData> {
    console.log(`[Data Service] Updating ${entity} record with ID: ${id}`, data);
    try {
      const response = await api.patch(`/data/${entity}/${id}`, data);
      return handleApiResponse<EntityData>(response);
    } catch (error: any) {
      console.error(`[Data Service] Failed to update ${entity} record ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  // Delete entity
  async deleteEntity(entity: EntityType, id: string): Promise<void> {
    await api.delete(`/data/${entity}/${id}`);
  },

  // Search entities
  async searchEntities(entity: EntityType, query: string): Promise<EntityData[]> {
    try {
      console.log(`[Data Service] Searching ${entity} with query: ${query}`);
      const params = new URLSearchParams({ q: query });
      const response = await api.get(`/data/${entity}/search?${params}`);
      const data = handleApiResponse<EntityData[]>(response);
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      console.error(`[Data Service] Search failed for ${entity}:`, error.response?.data || error.message);
      throw error;
    }
  },

  // Validate entity data
  async validateEntity(entity: EntityType, data: Partial<EntityData>): Promise<ApiResponse<any>> {
    const response = await api.post(`/data/${entity}/validate`, data);
    return response.data;
  },

  // Get entity statistics
  async getEntityStats(entity: EntityType): Promise<any> {
    const response = await api.get(`/data/${entity}/stats`);
    return response.data.success ? response.data.data : response.data;
  },

  // Export data
  async exportData(config: any): Promise<Blob> {
    const response = await api.post('/data/export', config, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Export single entity as CSV
  async exportSingleEntity(entity: EntityType): Promise<Blob> {
    const response = await api.get(`/data/${entity}/export`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Get validation errors for entity
  async getValidationErrors(entity: EntityType): Promise<any[]> {
    const response = await api.post(`/data/${entity}/validate`);
    if (response.data.success && response.data.data && response.data.data.errors) {
      // Transform backend validation errors to frontend format
      return response.data.data.errors.map((error: any) => ({
        id: `${entity}-${error.row || 'unknown'}`, // Generate ID from entity and row
        field: error.field,
        value: null, // Backend doesn't provide current value
        error: error.message,
        suggested_fix: null, // No suggested fix from validation service
        severity: error.severity,
        type: error.type,
        row: error.row
      }));
    }
    return [];
  },
};