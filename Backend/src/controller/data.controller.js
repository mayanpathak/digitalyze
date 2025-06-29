// controllers/data.controller.js

import ResponseBuilder from '../utils/responseBuilder.js';
import { convertToCSV } from '../utils/csvUtils.js';
import { createZipArchive, writeJsonFile } from '../utils/fileUtils.js';
import { validateRecords } from '../services/validation.service.js';
import { EnhancedValidationService } from '../services/enhanced-validation.service.js';
import dataStore from '../../dataStore.js';
import redisService from '../services/redis.service.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get data for a specific entity with Redis-first strategy
 */
export const getData = async (req, res) => {
  try {
    const { entity } = req.params;
    const { page = 1, limit = 100, fields } = req.query;

    // Validate entity
    if (!dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid entity: ${entity}`)
      );
    }

    // Try Redis first for cached data, fallback to dataStore
    let data;
    if (redisService.isAvailable()) {
      try {
        const cacheKey = `entity_data_${entity}`;
        const cachedData = await redisService.getCache(cacheKey);
        if (cachedData) {
          console.log(`[Data Controller] ✅ Redis cache hit for entity data: ${entity}`);
          data = cachedData;
        } else {
          console.log(`[Data Controller] 📭 Redis cache miss for entity data: ${entity}`);
          data = dataStore.getData(entity);
          // Cache the data for future requests
          await redisService.setCache(cacheKey, data, 300); // 5 minutes cache
          console.log(`[Data Controller] ✅ Cached entity data in Redis: ${entity}`);
        }
      } catch (cacheError) {
        console.warn(`[Data Controller] ⚠️ Redis error, falling back to dataStore:`, cacheError.message);
        data = dataStore.getData(entity);
      }
    } else {
      console.log(`[Data Controller] ⚠️ Redis unavailable, using dataStore for: ${entity}`);
      data = dataStore.getData(entity);
    }

    const totalRecords = data.length;

    // Apply field filtering if requested
    if (fields) {
      const fieldList = fields.split(',').map(f => f.trim());
      data = data.map(record => {
        const filtered = {};
        fieldList.forEach(field => {
          if (record[field] !== undefined) {
            filtered[field] = record[field];
          }
        });
        return filtered;
      });
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedData = data.slice(startIndex, endIndex);

    // Build pagination info
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalRecords,
      hasNext: endIndex < totalRecords,
      hasPrev: page > 1
    };

    res.json(ResponseBuilder.paginated(paginatedData, pagination));

  } catch (error) {
    console.error('Error getting data:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to retrieve data', error.message)
    );
  }
};

/**
 * Get a single record by ID
 */
export const getRecord = async (req, res) => {
  try {
    const { entity, id } = req.params;

    // Validate entity
    if (!dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid entity: ${entity}`)
      );
    }

    // Get all records for the entity
    const records = dataStore.getData(entity);
    const idField = entity === 'clients' ? 'ClientID' : 
                   entity === 'workers' ? 'WorkerID' : 'TaskID';
    
    // Find the record by ID
    const record = records.find(record => 
      record.id === id || 
      record[idField] === id || 
      String(record[idField]) === String(id) ||
      Number(record[idField]) === Number(id)
    );

    if (!record) {
      return res.status(404).json(
        ResponseBuilder.notFound('Record', id)
      );
    }

    res.json(ResponseBuilder.success(
      record,
      'Record retrieved successfully'
    ));

  } catch (error) {
    console.error(`Error getting record [Entity: ${req.params.entity}, ID: ${req.params.id}]:`, error);
    res.status(500).json(
      ResponseBuilder.error('Failed to get record', error.message)
    );
  }
};

/**
 * Create a new record
 */
export const createRecord = async (req, res) => {
  try {
    const { entity } = req.params;
    const recordData = req.body;

    // Validate entity
    if (!dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid entity: ${entity}`)
      );
    }

    // Generate ID if not provided
    const idField = entity === 'clients' ? 'ClientID' : 
                   entity === 'workers' ? 'WorkerID' : 'TaskID';
    
    if (!recordData[idField]) {
      // Generate a unique ID
      const existingRecords = dataStore.getData(entity);
      const maxId = existingRecords.reduce((max, record) => {
        const currentId = parseInt(String(record[idField]).replace(/\D/g, '')) || 0;
        return Math.max(max, currentId);
      }, 0);
      
      const prefix = entity === 'clients' ? 'CLIENT' : 
                    entity === 'workers' ? 'WORKER' : 'TASK';
      recordData[idField] = `${prefix}${String(maxId + 1).padStart(3, '0')}`;
    }

    // Add metadata
    const newRecord = {
      ...recordData,
      id: dataStore.generateId(entity),
      _metadata: {
        processedAt: new Date().toISOString(),
        source: 'manual_entry',
        entity: entity
      }
    };

    // Add to existing data
    const existingData = dataStore.getData(entity);
    existingData.push(newRecord);
    dataStore.setData(entity, existingData, 'manual_entry');

    // Invalidate Redis cache for this entity
    if (redisService.isAvailable()) {
      try {
        const cacheKey = `entity_data_${entity}`;
        await redisService.delCache(cacheKey);
        console.log(`[Data Controller] ✅ Invalidated Redis cache for entity: ${entity}`);
      } catch (cacheError) {
        console.warn(`[Data Controller] ⚠️ Failed to invalidate Redis cache:`, cacheError.message);
      }
    }

    res.status(201).json(ResponseBuilder.success(
      newRecord,
      'Record created successfully'
    ));

  } catch (error) {
    console.error(`Error creating record [Entity: ${req.params.entity}]:`, error);
    console.error('Create payload:', JSON.stringify(req.body, null, 2));
    res.status(500).json(
      ResponseBuilder.error('Failed to create record', error.message)
    );
  }
};

/**
 * Update a specific record with Redis cache invalidation
 */
export const updateRecord = async (req, res) => {
  try {
    const { entity, id } = req.params;
    const updates = req.body;

    // Validate entity
    if (!dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid entity: ${entity}`)
      );
    }

    // Update record in dataStore (authoritative source)
    const updatedRecord = dataStore.updateRecord(entity, id, updates);

    // Invalidate Redis cache for this entity
    if (redisService.isAvailable()) {
      try {
        const cacheKey = `entity_data_${entity}`;
        await redisService.delCache(cacheKey);
        console.log(`[Data Controller] ✅ Invalidated Redis cache for entity: ${entity}`);
      } catch (cacheError) {
        console.warn(`[Data Controller] ⚠️ Failed to invalidate Redis cache:`, cacheError.message);
      }
    }

    res.json(ResponseBuilder.success(
      updatedRecord,
      'Record updated successfully'
    ));

  } catch (error) {
    console.error(`Error updating record [Entity: ${entity}, ID: ${id}]:`, error);
    console.error('Update payload:', JSON.stringify(updates, null, 2));
   
    if (error.message.includes('not found')) {
      return res.status(404).json(
        ResponseBuilder.notFound('Record', req.params.id)
      );
    }

    res.status(500).json(
      ResponseBuilder.error('Failed to update record', error.message)
    );
  }
};

/**
 * Delete a specific record with Redis cache invalidation
 */
export const deleteRecord = async (req, res) => {
  try {
    const { entity, id } = req.params;

    // Validate entity
    if (!dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid entity: ${entity}`)
      );
    }

    // Delete record from dataStore (authoritative source)
    const deletedRecord = dataStore.deleteRecord(entity, id);

    // Invalidate Redis cache for this entity
    if (redisService.isAvailable()) {
      try {
        const cacheKey = `entity_data_${entity}`;
        await redisService.delCache(cacheKey);
        console.log(`[Data Controller] ✅ Invalidated Redis cache for entity: ${entity}`);
      } catch (cacheError) {
        console.warn(`[Data Controller] ⚠️ Failed to invalidate Redis cache:`, cacheError.message);
      }
    }

    res.json(ResponseBuilder.success(
      { deletedRecord },
      'Record deleted successfully'
    ));

  } catch (error) {
    console.error('Error deleting record:', error);
   
    if (error.message.includes('not found')) {
      return res.status(404).json(
        ResponseBuilder.notFound('Record', req.params.id)
      );
    }

    res.status(500).json(
      ResponseBuilder.error('Failed to delete record', error.message)
    );
  }
};

/**
 * Search records
 */
export const searchRecords = async (req, res) => {
  try {
    const { entity } = req.params;
    const { q: query, fields, page = 1, limit = 50 } = req.query;

    // Validate entity
    if (!dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid entity: ${entity}`)
      );
    }

    // Parse search fields
    const searchFields = fields ? fields.split(',').map(f => f.trim()) : [];

    // Perform search
    const searchResults = dataStore.searchRecords(entity, query, searchFields);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedResults = searchResults.slice(startIndex, endIndex);

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total: searchResults.length,
      hasNext: endIndex < searchResults.length,
      hasPrev: page > 1
    };

    res.json(ResponseBuilder.paginated(paginatedResults, pagination));

  } catch (error) {
    console.error('Error searching records:', error);
    res.status(500).json(
      ResponseBuilder.error('Search failed', error.message)
    );
  }
};

/**
 * Validate data for an entity with Redis caching
 */
export const validateData = async (req, res) => {
  try {
    const { entity } = req.params;

    // Validate entity
    if (!dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid entity: ${entity}`)
      );
    }

    // Get data from Redis-first strategy or dataStore
    let data;
    if (redisService.isAvailable()) {
      try {
        const cacheKey = `entity_data_${entity}`;
        const cachedData = await redisService.getCache(cacheKey);
        if (cachedData) {
          console.log(`[Data Controller] ✅ Using cached data for validation: ${entity}`);
          data = cachedData;
        } else {
          data = dataStore.getData(entity);
        }
      } catch (cacheError) {
        console.warn(`[Data Controller] ⚠️ Redis error during validation, using dataStore:`, cacheError.message);
        data = dataStore.getData(entity);
      }
    } else {
      data = dataStore.getData(entity);
    }

    if (data.length === 0) {
      return res.json(ResponseBuilder.success(
        { errors: [], summary: { totalRecords: 0, errorCount: 0 } },
        'No data to validate'
      ));
    }

    // Perform validation (this will use Redis caching internally)
    const validationResults = await validateRecords(data, entity);

    // Store validation results in dataStore for backup
    dataStore.setValidationResults(entity, validationResults);

    // Build summary
    const summary = {
      totalRecords: data.length,
      errorCount: validationResults.length,
      errorTypes: [...new Set(validationResults.map(error => error.type))],
      severity: {
        high: validationResults.filter(e => e.severity === 'high').length,
        medium: validationResults.filter(e => e.severity === 'medium').length,
        low: validationResults.filter(e => e.severity === 'low').length
      }
    };

    res.json(ResponseBuilder.success(
      { errors: validationResults, summary },
      'Data validation completed'
    ));

  } catch (error) {
    console.error('Error validating data:', error);
    res.status(500).json(
      ResponseBuilder.error('Validation failed', error.message)
    );
  }
};

/**
 * Get data statistics
 */
export const getDataStats = async (req, res) => {
  try {
    const { entity } = req.params;

    // Validate entity
    if (!dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid entity: ${entity}`)
      );
    }

    const data = dataStore.getData(entity);
    const metadata = dataStore.getMetadata(entity);

    if (data.length === 0) {
      return res.json(ResponseBuilder.success(
        {
          total: 0,
          totalRecords: 0,
          uniqueIds: 0,
          commonFields: {},
          averages: {},
          metadata: metadata || {},
          // Entity-specific counts
          pending: 0,
          completed: 0,
          active: 0
        },
        'No data available for statistics'
      ));
    }

    // Calculate basic statistics
    const totalRecords = data.length;
    const uniqueIds = new Set(data.map(record => record.id || record.ID)).size;

    // Calculate most common field values
    const commonFields = {};
    const fieldCounts = {};

    // Analyze common categorical fields
    const categoricalFields = ['GroupTags', 'Skills', 'Type', 'Status', 'Priority'];
    
    categoricalFields.forEach(field => {
      fieldCounts[field] = {};
      data.forEach(record => {
        const value = record[field];
        if (value) {
          // Handle arrays (like Skills, GroupTags)
          if (Array.isArray(value)) {
            value.forEach(item => {
              fieldCounts[field][item] = (fieldCounts[field][item] || 0) + 1;
            });
          } else {
            fieldCounts[field][value] = (fieldCounts[field][value] || 0) + 1;
          }
        }
      });

      // Get top 5 most common values for each field
      commonFields[field] = Object.entries(fieldCounts[field])
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }));
    });

    // Calculate averages for numeric fields
    const averages = {};
    const numericFields = ['Duration', 'MaxLoad', 'Priority', 'EstimatedHours'];

    numericFields.forEach(field => {
      const values = data
        .map(record => parseFloat(record[field]))
        .filter(val => !isNaN(val));
      
      if (values.length > 0) {
        averages[field] = {
          average: Math.round((values.reduce((sum, val) => sum + val, 0) / values.length) * 100) / 100,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      }
    });

    // Entity-specific statistics
    let entitySpecificStats = {};
    
    switch (entity) {
      case 'tasks':
        const taskStatuses = data.reduce((acc, task) => {
          const status = task.Status || 'Unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
        entitySpecificStats.statusDistribution = taskStatuses;
        break;
        
      case 'workers':
        const workerTypes = data.reduce((acc, worker) => {
          const type = worker.Type || 'Unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
        entitySpecificStats.typeDistribution = workerTypes;
        break;
        
      case 'clients':
        const clientRegions = data.reduce((acc, client) => {
          const region = client.Region || 'Unknown';
          acc[region] = (acc[region] || 0) + 1;
          return acc;
        }, {});
        entitySpecificStats.regionDistribution = clientRegions;
        break;
    }

    // Calculate entity-specific counts for frontend
    let pending = 0, completed = 0, active = 0;
    
    if (entity === 'tasks') {
      pending = data.filter(task => task.Status === 'pending').length;
      completed = data.filter(task => task.Status === 'completed').length;
    } else if (entity === 'workers') {
      active = data.filter(worker => worker.Availability === 'available').length;
    } else if (entity === 'clients') {
      active = data.filter(client => client.PriorityLevel > 3).length; // High priority clients
    }

    const stats = {
      total: totalRecords, // Frontend expects 'total'
      totalRecords,
      uniqueIds,
      commonFields,
      averages,
      entitySpecific: entitySpecificStats,
      metadata: metadata || {},
      lastUpdated: new Date().toISOString(),
      // Entity-specific counts for dashboard
      pending,
      completed,
      active
    };

    res.json(ResponseBuilder.success(
      stats,
      'Data statistics retrieved successfully'
    ));

  } catch (error) {
    console.error('Error getting data statistics:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to retrieve statistics', error.message)
    );
  }
};

/**
 * Reset data for a specific entity (same as clearData but different endpoint)
 */
export const resetEntityData = async (req, res) => {
  try {
    const { entity } = req.params;

    // Validate entity
    if (!dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid entity: ${entity}`)
      );
    }

    // Get current record count before reset
    const currentData = dataStore.getData(entity);
    const recordCount = currentData.length;

    // Reset the entity data
    dataStore.resetData(entity);

    res.json(ResponseBuilder.success(
      {
        entity,
        recordsRemoved: recordCount,
        resetAt: new Date().toISOString()
      },
      `All data for ${entity} has been reset successfully`
    ));

  } catch (error) {
    console.error('Error resetting entity data:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to reset entity data', error.message)
    );
  }
};

/**
 * Export data for specific entities
 */
export const exportData = async (req, res) => {
  try {
    const { entities = ['clients', 'workers', 'tasks'], format = 'csv', downloadType = 'zip' } = req.body;
    
    // Validate entities
    for (const entity of entities) {
      if (!dataStore.isValidEntity(entity)) {
        return res.status(400).json(
          ResponseBuilder.error(`Invalid entity: ${entity}`)
        );
      }
    }
    
    const exportData = {};
    const exportFiles = [];
    const timestamp = Date.now();
    
    // If user wants individual files and only one entity is selected
    if (downloadType === 'individual' && entities.length === 1) {
      const entity = entities[0];
      const data = dataStore.getData(entity);
      
      if (format === 'csv') {
        const csvContent = convertToCSV(data);
        const fileName = `${entity}-${timestamp}.csv`;
        
        // Send CSV directly as download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(csvContent);
        return;
      } else {
        // JSON format for single entity
        const fileName = `${entity}-${timestamp}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.json(data);
        return;
      }
    }
    
    // Collect data for each entity (for ZIP or multiple individual files)
    for (const entity of entities) {
      const data = dataStore.getData(entity);
      exportData[entity] = data;
      
      if (format === 'csv') {
        const csvContent = convertToCSV(data);
        const fileName = `${entity}.csv`;
        const filePath = path.join(__dirname, '..', 'export', fileName);
        
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, csvContent);
        exportFiles.push(fileName);
      }
    }
    
    if (format === 'json') {
      // Create JSON export and send as download
      const fileName = `export-${timestamp}.json`;
      const filePath = path.join(__dirname, '..', 'export', fileName);
      
      await fs.ensureDir(path.dirname(filePath));
      await writeJsonFile(filePath, exportData);
      
      // Send file as download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.sendFile(path.resolve(filePath));
      
    } else {
      // Create ZIP archive for CSV files and send as download
      const zipFileName = `export-${timestamp}.zip`;
      const zipPath = path.join(__dirname, '..', 'export', zipFileName);
      const sourceDir = path.join(__dirname, '..', 'export');
      
      await createZipArchive(sourceDir, zipPath, exportFiles);
      
      // Send ZIP file as download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
      res.sendFile(path.resolve(zipPath));
    }
    
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to export data', error.message)
    );
  }
};

/**
 * Export single entity as CSV (convenience endpoint)
 */
export const exportSingleEntity = async (req, res) => {
  try {
    const { entity } = req.params;
    
    // Validate entity
    if (!dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid entity: ${entity}`)
      );
    }
    
    const data = dataStore.getData(entity);
    const csvContent = convertToCSV(data);
    const fileName = `${entity}-${Date.now()}.csv`;
    
    // Send CSV directly as download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
    
  } catch (error) {
    console.error('Error exporting single entity:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to export entity', error.message)
    );
  }
};

/**
 * Clear all data for a specific entity
 */
export const clearData = async (req, res) => {
  try {
    const { entity } = req.params;

    // Validate entity
    if (!dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid entity: ${entity}`)
      );
    }

    // Get current record count before clearing
    const currentData = dataStore.getData(entity);
    const recordCount = currentData.length;

    // Clear the entity data
    dataStore.clearEntity(entity);

    res.json(ResponseBuilder.success(
      {
        entity,
        recordsCleared: recordCount,
        clearedAt: new Date().toISOString()
      },
      `All data for ${entity} has been cleared successfully`
    ));

  } catch (error) {
    console.error('Error clearing entity data:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to clear entity data', error.message)
    );
  }
};

/**
 * Enhanced validation - comprehensive data validation across all entities
 */
export const validateEnhanced = async (req, res) => {
  try {
    const { cacheResults = true } = req.body;

    // Get all data
    const clientsData = dataStore.getData('clients');
    const workersData = dataStore.getData('workers');
    const tasksData = dataStore.getData('tasks');
    const rules = dataStore.getRules();

    // Check if we have any data to validate
    const totalRecords = clientsData.length + workersData.length + tasksData.length;
    if (totalRecords === 0) {
      return res.json(ResponseBuilder.success({
        isValid: true,
        errors: [],
        warnings: [],
        summary: {
          totalErrors: 0,
          totalWarnings: 0,
          totalRecords: 0,
          validationTypes: [],
          timestamp: new Date().toISOString()
        }
      }, 'No data to validate'));
    }

    // Try Redis cache first if enabled
    let cacheKey = null;
    if (cacheResults && redisService.isAvailable()) {
      const dataHash = crypto.createHash('md5')
        .update(JSON.stringify({ clientsData, workersData, tasksData, rules }))
        .digest('hex');
      cacheKey = `enhanced_validation_${dataHash}`;
      
      try {
        const cachedResult = await redisService.getCache(cacheKey);
        if (cachedResult) {
          console.log(`[Data Controller] ✅ Enhanced validation cache hit`);
          return res.json(ResponseBuilder.success(
            { ...cachedResult, fromCache: true },
            'Enhanced validation completed (cached)'
          ));
        }
      } catch (cacheError) {
        console.warn(`[Data Controller] ⚠️ Enhanced validation cache error:`, cacheError.message);
      }
    }

    // Run enhanced validation
    const validationResult = await EnhancedValidationService.validateAllData(
      clientsData, 
      workersData, 
      tasksData, 
      rules
    );

    // Add metadata
    const enhancedResult = {
      ...validationResult,
      metadata: {
        totalRecords,
        entitiesValidated: ['clients', 'workers', 'tasks'],
        rulesApplied: rules.length,
        validatedAt: new Date().toISOString(),
        fromCache: false
      }
    };

    // Cache the result if enabled
    if (cacheResults && cacheKey && redisService.isAvailable()) {
      try {
        await redisService.setCache(cacheKey, enhancedResult, 1800); // 30 minutes
        console.log(`[Data Controller] ✅ Enhanced validation result cached`);
      } catch (cacheError) {
        console.warn(`[Data Controller] ⚠️ Failed to cache validation result:`, cacheError.message);
      }
    }

    res.json(ResponseBuilder.success(
      enhancedResult,
      'Enhanced validation completed successfully'
    ));

  } catch (error) {
    console.error('Error in enhanced validation:', error);
    res.status(500).json(
      ResponseBuilder.error('Enhanced validation failed', error.message)
    );
  }
};

/**
 * Get validation summary for dashboard
 */
export const getValidationSummary = async (req, res) => {
  try {
    // Get all data
    const clientsData = dataStore.getData('clients');
    const workersData = dataStore.getData('workers');
    const tasksData = dataStore.getData('tasks');

    const summary = await EnhancedValidationService.getValidationSummary(
      clientsData, 
      workersData, 
      tasksData
    );

    res.json(ResponseBuilder.success(
      summary,
      'Validation summary generated successfully'
    ));

  } catch (error) {
    console.error('Error getting validation summary:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to get validation summary', error.message)
    );
  }
};

/**
 * Apply suggested fixes (placeholder for future auto-fix functionality)
 */
export const applyFixes = async (req, res) => {
  try {
    const { fixes } = req.body;

    if (!fixes || !Array.isArray(fixes)) {
      return res.status(400).json(
        ResponseBuilder.error('Fixes array is required')
      );
    }

    const results = [];
    for (const fix of fixes) {
      const result = await EnhancedValidationService.applyFix(fix);
      results.push(result);
    }

    res.json(ResponseBuilder.success(
      {
        appliedFixes: results,
        totalAttempted: fixes.length,
        successCount: results.filter(r => r.success).length
      },
      'Fix application completed'
    ));

  } catch (error) {
    console.error('Error applying fixes:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to apply fixes', error.message)
    );
  }
};

// All functions are already exported individually above