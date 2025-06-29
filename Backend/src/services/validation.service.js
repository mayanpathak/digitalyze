/**
 * Validation Service for AI-Enabled Resource Allocation System
 * 
 * This module validates structured data for clients, workers, and tasks entities.
 * Performs field validation, cross-entity checks, and constraint validation.
 * 
 * @module validation.service
 */

import crypto from 'crypto';
import redisService from './redis.service.js';

// Severity mapping for different validation error types
const severityMap = {
    MissingField: 'high',
    TypeError: 'medium',
    RangeError: 'medium',
    UnknownReference: 'high',
    LogicalConflict: 'high',
    DuplicateID: 'high',
    CircularReference: 'high',
    WorkerOverload: 'medium',
    SkillGap: 'high',
    ConcurrencyIssue: 'medium',
    RuleConflict: 'medium'
  };
  
  // Required fields for each entity type
  const requiredFields = {
    clients: ['ClientID', 'PriorityLevel'],
    workers: ['WorkerID', 'Skills', 'AvailableSlots', 'MaxLoadPerPhase'],
    tasks: ['TaskID', 'Duration', 'RequiredSkills']
  };
  
  /**
   * Main validation function that orchestrates all validation checks with Redis caching
   * 
   * @param {Array} data - Array of records for specific entity
   * @param {string} entityType - Type of entity ('clients' | 'workers' | 'tasks')
   * @param {Object} fullDataStore - Complete data store with all entities
   * @param {Array} fullDataStore.clients - All client records
   * @param {Array} fullDataStore.workers - All worker records  
   * @param {Array} fullDataStore.tasks - All task records
   * @param {Array} fullDataStore.rules - Custom validation rules
   * @returns {Array} Array of validation error objects
   */
  export async function validateRecords(data, entityType, fullDataStore = {}) {
    try {
      if (!data || !Array.isArray(data)) {
        return [{
          row: 0,
          field: 'data',
          message: 'Invalid data format - expected array',
          type: 'TypeError',
          severity: severityMap.TypeError
        }];
      }
  
      // Generate cache key based on data and entity type
      const dataHash = crypto.createHash('md5').update(JSON.stringify({
        data: data.slice(0, 10), // Sample for hash to avoid huge strings
        entityType,
        dataLength: data.length,
        timestamp: Math.floor(Date.now() / (1000 * 60 * 10)) // 10-minute cache windows
      })).digest('hex');
      
      const cacheKey = `validation_${entityType}_${dataHash}`;
      
      // Try Redis cache first
      if (redisService.isAvailable()) {
        try {
          const cachedValidation = await redisService.getCachedValidationResults(cacheKey);
          if (cachedValidation) {
            console.log(`[Validation Service] ✅ Redis cache hit for validation: ${entityType}`);
            return cachedValidation;
          }
          console.log(`[Validation Service] 📭 Redis cache miss for validation: ${entityType}`);
        } catch (cacheError) {
          console.warn(`[Validation Service] ⚠️ Redis cache error for validation:`, cacheError.message);
        }
      } else {
        console.log(`[Validation Service] ⚠️ Redis unavailable, proceeding with validation: ${entityType}`);
      }
  
      const errors = [];
  
      // Perform entity-specific validations
      switch (entityType) {
        case 'clients':
          errors.push(...validateClients(data, fullDataStore.tasks || []));
          break;
        case 'workers':
          errors.push(...validateWorkers(data));
          break;
        case 'tasks':
          errors.push(...validateTasks(data));
          break;
        default:
          return [{
            row: 0,
            field: 'entityType',
            message: `Unknown entity type: ${entityType}`,
            type: 'TypeError',
            severity: severityMap.TypeError
          }];
      }
  
      // Perform cross-entity validations if full data store is available
      if (fullDataStore.clients && fullDataStore.workers && fullDataStore.tasks) {
        errors.push(...validateCrossEntityRules(
          fullDataStore.clients,
          fullDataStore.workers,
          fullDataStore.tasks,
          fullDataStore.rules || []
        ));
      }
  
      // Cache the validation results in Redis
      if (redisService.isAvailable()) {
        try {
          await redisService.cacheValidationResults(cacheKey, errors);
          console.log(`[Validation Service] ✅ Cached validation results in Redis: ${entityType}`);
        } catch (cacheError) {
          console.warn(`[Validation Service] ⚠️ Failed to cache validation results:`, cacheError.message);
        }
      }
  
      return errors;
    } catch (error) {
      console.error(`[Validation Service] Error in validateRecords:`, error.message);
      return [{
        row: 0,
        field: 'system',
        message: `Validation system error: ${error.message}`,
        type: 'SystemError',
        severity: 'high'
      }];
    }
  }
  
  /**
   * Validates client records
   * 
   * @param {Array} clients - Array of client records
   * @param {Array} tasks - Array of task records for reference validation
   * @returns {Array} Array of validation errors
   */
  export function validateClients(clients, tasks = []) {
    const errors = [];
    const clientIds = new Set();
    const taskIds = new Set(tasks.map(t => t.TaskID));
  
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      const rowIndex = i + 1;
  
      // Required field validation
      errors.push(...validateRequiredFields(client, requiredFields.clients, rowIndex));
  
      // Duplicate ID check
      if (client.ClientID) {
        if (clientIds.has(client.ClientID)) {
          errors.push({
            row: rowIndex,
            field: 'ClientID',
            message: `Duplicate ClientID: ${client.ClientID}`,
            type: 'DuplicateID',
            severity: severityMap.DuplicateID
          });
        }
        clientIds.add(client.ClientID);
      }
  
      // Priority level validation (1-5)
      if (client.PriorityLevel !== undefined) {
        if (!validateType(client.PriorityLevel, 'number')) {
          errors.push({
            row: rowIndex,
            field: 'PriorityLevel',
            message: 'PriorityLevel must be a number',
            type: 'TypeError',
            severity: severityMap.TypeError
          });
        } else if (!validateRange(client.PriorityLevel, 1, 5)) {
          errors.push({
            row: rowIndex,
            field: 'PriorityLevel',
            message: 'PriorityLevel must be between 1 and 5',
            type: 'RangeError',
            severity: severityMap.RangeError
          });
        }
      }
  
      // RequestedTaskIDs validation
      if (client.RequestedTaskIDs) {
        const requestedTasks = arrayifyCommaString(client.RequestedTaskIDs);
        for (const taskId of requestedTasks) {
          if (!taskIds.has(taskId)) {
            errors.push({
              row: rowIndex,
              field: 'RequestedTaskIDs',
              message: `TaskID ${taskId} not found in tasks`,
              type: 'UnknownReference',
              severity: severityMap.UnknownReference
            });
          }
        }
      }
  
      // AttributesJSON validation
      if (client.AttributesJSON && !isValidJSON(client.AttributesJSON)) {
        errors.push({
          row: rowIndex,
          field: 'AttributesJSON',
          message: 'Invalid JSON format in AttributesJSON',
          type: 'TypeError',
          severity: severityMap.TypeError
        });
      }
    }
  
    return errors;
  }
  
  /**
   * Validates worker records
   * 
   * @param {Array} workers - Array of worker records
   * @returns {Array} Array of validation errors
   */
  export function validateWorkers(workers) {
    const errors = [];
    const workerIds = new Set();
  
    for (let i = 0; i < workers.length; i++) {
      const worker = workers[i];
      const rowIndex = i + 1;
  
      // Required field validation
      errors.push(...validateRequiredFields(worker, requiredFields.workers, rowIndex));
  
      // Duplicate ID check
      if (worker.WorkerID) {
        if (workerIds.has(worker.WorkerID)) {
          errors.push({
            row: rowIndex,
            field: 'WorkerID',
            message: `Duplicate WorkerID: ${worker.WorkerID}`,
            type: 'DuplicateID',
            severity: severityMap.DuplicateID
          });
        }
        workerIds.add(worker.WorkerID);
      }
  
      // Skills validation
      if (worker.Skills) {
        const skills = arrayifyCommaString(worker.Skills);
        if (skills.length === 0) {
          errors.push({
            row: rowIndex,
            field: 'Skills',
            message: 'Worker must have at least one skill',
            type: 'LogicalConflict',
            severity: severityMap.LogicalConflict
          });
        }
      }
  
      // AvailableSlots validation
      if (worker.AvailableSlots) {
        const slots = parseSlots(worker.AvailableSlots);
        if (!Array.isArray(slots) || slots.some(slot => !Number.isInteger(slot))) {
          errors.push({
            row: rowIndex,
            field: 'AvailableSlots',
            message: 'AvailableSlots must be an array of integers',
            type: 'TypeError',
            severity: severityMap.TypeError
          });
        }
      }
  
      // MaxLoadPerPhase validation
      if (worker.MaxLoadPerPhase !== undefined) {
        if (!validateType(worker.MaxLoadPerPhase, 'number')) {
          errors.push({
            row: rowIndex,
            field: 'MaxLoadPerPhase',
            message: 'MaxLoadPerPhase must be a number',
            type: 'TypeError',
            severity: severityMap.TypeError
          });
        } else if (worker.MaxLoadPerPhase < 0) {
          errors.push({
            row: rowIndex,
            field: 'MaxLoadPerPhase',
            message: 'MaxLoadPerPhase must be >= 0',
            type: 'RangeError',
            severity: severityMap.RangeError
          });
        }
      }
  
      // Worker overload check
      if (worker.AvailableSlots && worker.MaxLoadPerPhase) {
        const slots = parseSlots(worker.AvailableSlots);
        if (Array.isArray(slots) && slots.length < worker.MaxLoadPerPhase) {
          errors.push({
            row: rowIndex,
            field: 'MaxLoadPerPhase',
            message: 'MaxLoadPerPhase exceeds available slots',
            type: 'WorkerOverload',
            severity: severityMap.WorkerOverload
          });
        }
      }
    }
  
    return errors;
  }
  
  /**
   * Validates task records
   * 
   * @param {Array} tasks - Array of task records
   * @returns {Array} Array of validation errors
   */
  export function validateTasks(tasks) {
    const errors = [];
    const taskIds = new Set();
  
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const rowIndex = i + 1;
  
      // Required field validation
      errors.push(...validateRequiredFields(task, requiredFields.tasks, rowIndex));
  
      // Duplicate ID check
      if (task.TaskID) {
        if (taskIds.has(task.TaskID)) {
          errors.push({
            row: rowIndex,
            field: 'TaskID',
            message: `Duplicate TaskID: ${task.TaskID}`,
            type: 'DuplicateID',
            severity: severityMap.DuplicateID
          });
        }
        taskIds.add(task.TaskID);
      }
  
      // Duration validation
      if (task.Duration !== undefined) {
        if (!validateType(task.Duration, 'number')) {
          errors.push({
            row: rowIndex,
            field: 'Duration',
            message: 'Duration must be a number',
            type: 'TypeError',
            severity: severityMap.TypeError
          });
        } else if (task.Duration < 1) {
          errors.push({
            row: rowIndex,
            field: 'Duration',
            message: 'Duration must be >= 1',
            type: 'RangeError',
            severity: severityMap.RangeError
          });
        }
      }
  
      // RequiredSkills validation
      if (task.RequiredSkills) {
        const skills = arrayifyCommaString(task.RequiredSkills);
        if (skills.length === 0) {
          errors.push({
            row: rowIndex,
            field: 'RequiredSkills',
            message: 'Task must require at least one skill',
            type: 'LogicalConflict',
            severity: severityMap.LogicalConflict
          });
        }
      }
  
      // MaxConcurrent validation
      if (task.MaxConcurrent !== undefined && !validateType(task.MaxConcurrent, 'number')) {
        errors.push({
          row: rowIndex,
          field: 'MaxConcurrent',
          message: 'MaxConcurrent must be a number',
          type: 'TypeError',
          severity: severityMap.TypeError
        });
      }
  
      // PreferredPhases validation
      if (task.PreferredPhases) {
        const phases = parseRange(task.PreferredPhases);
        if (!Array.isArray(phases)) {
          errors.push({
            row: rowIndex,
            field: 'PreferredPhases',
            message: 'Invalid PreferredPhases format',
            type: 'TypeError',
            severity: severityMap.TypeError
          });
        }
      }
    }
  
    return errors;
  }
  
  /**
   * Validates cross-entity rules and relationships
   * 
   * @param {Array} clients - Array of client records
   * @param {Array} workers - Array of worker records
   * @param {Array} tasks - Array of task records
   * @param {Array} rules - Array of custom validation rules
   * @returns {Array} Array of validation errors
   */
  export function validateCrossEntityRules(clients, workers, tasks, rules = []) {
    const errors = [];
  
    // Skill coverage matrix validation
    errors.push(...validateSkillCoverage(tasks, workers));
  
    // Phase slot saturation validation
    errors.push(...validatePhaseSlotSaturation(tasks, workers));
  
    // Circular co-run detection
    errors.push(...detectCircularCoRuns(tasks));
  
    // Max concurrent feasibility
    errors.push(...validateMaxConcurrentFeasibility(tasks, workers));
  
    // Custom rule validations
    errors.push(...validateCoRunRules(tasks, rules));
    errors.push(...validatePhaseWindowRules(tasks, rules));
    errors.push(...validateLoadLimits(workers, rules));
  
    return errors;
  }
  
  /**
   * Validates that all task skills are covered by at least one worker
   * 
   * @param {Array} tasks - Array of task records
   * @param {Array} workers - Array of worker records
   * @returns {Array} Array of validation errors
   */
  function validateSkillCoverage(tasks, workers) {
    const errors = [];
    const workerSkills = new Set();
  
    // Collect all worker skills
    workers.forEach(worker => {
      if (worker.Skills) {
        arrayifyCommaString(worker.Skills).forEach(skill => workerSkills.add(skill));
      }
    });
  
    // Check each task's required skills
    tasks.forEach((task, index) => {
      if (task.RequiredSkills) {
        const requiredSkills = arrayifyCommaString(task.RequiredSkills);
        const missingSkills = requiredSkills.filter(skill => !workerSkills.has(skill));
        
        if (missingSkills.length > 0) {
          errors.push({
            row: index + 1,
            field: 'RequiredSkills',
            message: `Skills not available in workforce: ${missingSkills.join(', ')}`,
            type: 'SkillGap',
            severity: severityMap.SkillGap
          });
        }
      }
    });
  
    return errors;
  }
  
  /**
   * Validates phase slot saturation
   * 
   * @param {Array} tasks - Array of task records
   * @param {Array} workers - Array of worker records
   * @returns {Array} Array of validation errors
   */
  function validatePhaseSlotSaturation(tasks, workers) {
    const errors = [];
    const phaseCapacity = {};
  
    // Calculate total capacity per phase
    workers.forEach(worker => {
      if (worker.AvailableSlots && worker.MaxLoadPerPhase) {
        const slots = parseSlots(worker.AvailableSlots);
        if (Array.isArray(slots)) {
          slots.forEach(phase => {
            phaseCapacity[phase] = (phaseCapacity[phase] || 0) + worker.MaxLoadPerPhase;
          });
        }
      }
    });
  
    // Calculate demand per phase
    const phaseDemand = {};
    tasks.forEach((task, index) => {
      if (task.PreferredPhases && task.Duration) {
        const phases = parseRange(task.PreferredPhases);
        if (Array.isArray(phases)) {
          phases.forEach(phase => {
            phaseDemand[phase] = (phaseDemand[phase] || 0) + task.Duration;
          });
        }
      }
    });
  
    // Check for oversaturation
    Object.keys(phaseDemand).forEach(phase => {
      const demand = phaseDemand[phase];
      const capacity = phaseCapacity[phase] || 0;
      
      if (demand > capacity) {
        errors.push({
          row: 0,
          field: 'PhaseCapacity',
          message: `Phase ${phase} oversaturated: demand ${demand} exceeds capacity ${capacity}`,
          type: 'LogicalConflict',
          severity: severityMap.LogicalConflict
        });
      }
    });
  
    return errors;
  }
  
  /**
   * Detects circular co-run dependencies using DFS
   * 
   * @param {Array} tasks - Array of task records
   * @returns {Array} Array of validation errors
   */
  function detectCircularCoRuns(tasks) {
    const errors = [];
    const graph = {};
    const visited = new Set();
    const recStack = new Set();
  
    // Build dependency graph
    tasks.forEach(task => {
      if (task.CoRunWith) {
        graph[task.TaskID] = arrayifyCommaString(task.CoRunWith);
      }
    });
  
    // DFS to detect cycles
    function hasCycle(node) {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;
  
      visited.add(node);
      recStack.add(node);
  
      const neighbors = graph[node] || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) return true;
      }
  
      recStack.delete(node);
      return false;
    }
  
    // Check each task for circular dependencies
    Object.keys(graph).forEach(taskId => {
      if (hasCycle(taskId)) {
        const taskIndex = tasks.findIndex(t => t.TaskID === taskId);
        errors.push({
          row: taskIndex + 1,
          field: 'CoRunWith',
          message: `Circular co-run dependency detected for task ${taskId}`,
          type: 'CircularReference',
          severity: severityMap.CircularReference
        });
      }
    });
  
    return errors;
  }
  
  /**
   * Validates max concurrent feasibility
   * 
   * @param {Array} tasks - Array of task records
   * @param {Array} workers - Array of worker records
   * @returns {Array} Array of validation errors
   */
  function validateMaxConcurrentFeasibility(tasks, workers) {
    const errors = [];
  
    tasks.forEach((task, index) => {
      if (task.MaxConcurrent && task.RequiredSkills) {
        const requiredSkills = arrayifyCommaString(task.RequiredSkills);
        const qualifiedWorkers = workers.filter(worker => {
          if (!worker.Skills) return false;
          const workerSkills = arrayifyCommaString(worker.Skills);
          return requiredSkills.every(skill => workerSkills.includes(skill));
        });
  
        if (task.MaxConcurrent > qualifiedWorkers.length) {
          errors.push({
            row: index + 1,
            field: 'MaxConcurrent',
            message: `MaxConcurrent (${task.MaxConcurrent}) exceeds qualified workers (${qualifiedWorkers.length})`,
            type: 'ConcurrencyIssue',
            severity: severityMap.ConcurrencyIssue
          });
        }
      }
    });
  
    return errors;
  }
  
  /**
   * Validates co-run rules
   * 
   * @param {Array} tasks - Array of task records
   * @param {Array} rules - Array of custom rules
   * @returns {Array} Array of validation errors
   */
  function validateCoRunRules(tasks, rules) {
    const errors = [];
    // Implementation for custom co-run rule validation
    // This would depend on the specific rule format
    return errors;
  }
  
  /**
   * Validates phase window rules
   * 
   * @param {Array} tasks - Array of task records
   * @param {Array} rules - Array of custom rules
   * @returns {Array} Array of validation errors
   */
  function validatePhaseWindowRules(tasks, rules) {
    const errors = [];
    // Implementation for phase window rule validation
    // This would depend on the specific rule format
    return errors;
  }
  
  /**
   * Validates load limit rules
   * 
   * @param {Array} workers - Array of worker records
   * @param {Array} rules - Array of custom rules
   * @returns {Array} Array of validation errors
   */
  function validateLoadLimits(workers, rules) {
    const errors = [];
    // Implementation for load limit rule validation
    // This would depend on the specific rule format
    return errors;
  }
  
  // Utility Functions
  
  /**
   * Validates required fields for a record
   * 
   * @param {Object} record - Record to validate
   * @param {Array} requiredFields - Array of required field names
   * @param {number} rowIndex - Row index for error reporting
   * @returns {Array} Array of validation errors
   */
  function validateRequiredFields(record, requiredFields, rowIndex) {
    const errors = [];
    
    requiredFields.forEach(field => {
      if (!record[field] || record[field] === '') {
        errors.push({
          row: rowIndex,
          field,
          message: `Required field '${field}' is missing`,
          type: 'MissingField',
          severity: severityMap.MissingField
        });
      }
    });
    
    return errors;
  }
  
  /**
   * Validates type of a value
   * 
   * @param {*} value - Value to validate
   * @param {string} expectedType - Expected type
   * @returns {boolean} True if type matches
   */
  function validateType(value, expectedType) {
    return typeof value === expectedType;
  }
  
  /**
   * Validates if a number is within a range
   * 
   * @param {number} value - Value to validate
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {boolean} True if within range
   */
  function validateRange(value, min, max) {
    return value >= min && value <= max;
  }
  
  /**
   * Parses a range string like "1-3" into an array [1, 2, 3]
   * 
   * @param {string} rangeStr - Range string to parse
   * @returns {Array|null} Array of numbers or null if invalid
   */
  function parseRange(rangeStr) {
    if (!rangeStr || typeof rangeStr !== 'string') return null;
    
    if (rangeStr.includes('-')) {
      const [start, end] = rangeStr.split('-').map(Number);
      if (isNaN(start) || isNaN(end) || start > end) return null;
      
      const result = [];
      for (let i = start; i <= end; i++) {
        result.push(i);
      }
      return result;
    } else {
      const num = Number(rangeStr);
      return isNaN(num) ? null : [num];
    }
  }
  
  /**
   * Converts comma-separated string to array
   * 
   * @param {string} str - Comma-separated string
   * @returns {Array} Array of trimmed strings
   */
  function arrayifyCommaString(str) {
    if (!str || typeof str !== 'string') return [];
    return str.split(',').map(item => item.trim()).filter(item => item);
  }
  
  /**
   * Validates if a string is valid JSON
   * 
   * @param {string} str - String to validate
   * @returns {boolean} True if valid JSON
   */
  function isValidJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Parses slots from various formats (array, string, etc.)
   * 
   * @param {*} slots - Slots data to parse
   * @returns {Array|null} Array of slot numbers or null if invalid
   */
  function parseSlots(slots) {
    if (Array.isArray(slots)) return slots;
    if (typeof slots === 'string') {
      try {
        const parsed = JSON.parse(slots);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        // Try comma-separated format
        return arrayifyCommaString(slots).map(Number).filter(n => !isNaN(n));
      }
    }
    return null;
  }
  
  // All validation functions are already exported individually above