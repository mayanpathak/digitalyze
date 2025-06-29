import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import redisService from './redis.service.js';

/**
 * Header mappings for normalizing varied column names to standard schema
 */
const headerMappings = {
  clients: {
    'Client Id': 'ClientID',
    'client_id': 'ClientID',
    'id': 'ClientID',
    'client_name': 'ClientName',
    'name': 'ClientName',
    'priority': 'PriorityLevel',
    'priority_level': 'PriorityLevel',
    'requested tasks': 'RequestedTaskIDs',
    'requested_tasks': 'RequestedTaskIDs',
    'task_ids': 'RequestedTaskIDs',
    'tasks': 'RequestedTaskIDs',
    'group': 'GroupTag',
    'group_tag': 'GroupTag',
    'tag': 'GroupTag',
    'attributes': 'AttributesJSON',
    'attributes_json': 'AttributesJSON',
    'metadata': 'AttributesJSON',
  },
  workers: {
    'Worker Id': 'WorkerID',
    'worker_id': 'WorkerID',
    'id': 'WorkerID',
    'name': 'WorkerName',
    'worker_name': 'WorkerName',
    'skills': 'Skills',
    'skill_set': 'Skills',
    'capabilities': 'Skills',
    'slots': 'AvailableSlots',
    'available_slots': 'AvailableSlots',
    'availability': 'AvailableSlots',
    'max load': 'MaxLoadPerPhase',
    'max_load': 'MaxLoadPerPhase',
    'max_load_per_phase': 'MaxLoadPerPhase',
    'capacity': 'MaxLoadPerPhase',
    'group': 'WorkerGroup',
    'worker_group': 'WorkerGroup',
    'team': 'WorkerGroup',
    'qualification': 'QualificationLevel',
    'qualification_level': 'QualificationLevel',
    'level': 'QualificationLevel',
  },
  tasks: {
    'Task Id': 'TaskID',
    'task_id': 'TaskID',
    'id': 'TaskID',
    'name': 'TaskName',
    'task_name': 'TaskName',
    'title': 'TaskName',
    'category': 'Category',
    'type': 'Category',
    'task_type': 'Category',
    'duration': 'Duration',
    'time': 'Duration',
    'estimated_duration': 'Duration',
    'required skills': 'RequiredSkills',
    'required_skills': 'RequiredSkills',
    'skills_needed': 'RequiredSkills',
    'skills': 'RequiredSkills',
    'preferred phases': 'PreferredPhases',
    'preferred_phases': 'PreferredPhases',
    'phases': 'PreferredPhases',
    'max concurrent': 'MaxConcurrent',
    'max_concurrent': 'MaxConcurrent',
    'concurrency': 'MaxConcurrent',
  }
};

/**
 * Flexible required fields - only truly essential identifiers
 * At least one field from each array must be present
 */
const requiredFields = {
  clients: {
    identifier: ['ClientID', 'ID', 'Name', 'ClientName', 'CustomerID', 'AccountID', 'Reference', 'Code'],
    optional: ['PriorityLevel', 'Priority', 'Importance', 'Budget', 'Email']
  },
  workers: {
    identifier: ['WorkerID', 'ID', 'Name', 'WorkerName', 'EmployeeID', 'StaffID', 'PersonID', 'ResourceID'],
    optional: ['Skills', 'Abilities', 'AvailableSlots', 'MaxLoadPerPhase', 'Email']
  },
  tasks: {
    identifier: ['TaskID', 'ID', 'Name', 'TaskName', 'JobID', 'ProjectID', 'AssignmentID', 'ItemID'],
    optional: ['Duration', 'RequiredSkills', 'MaxConcurrent', 'PreferredPhases']
  }
};

/**
 * Parses a CSV or XLSX file and returns structured data with Redis caching
 * @param {string} filePath - Path to the file to parse
 * @param {'clients'|'workers'|'tasks'} entity - Type of entity being parsed
 * @param {boolean} strict - Whether to throw errors or continue gracefully
 * @returns {Promise<Array<Object>>} Parsed and normalized data
 */
export async function parseFile(filePath, entity, strict = false) {
  try {
    // Generate file hash for caching
    const fileBuffer = await fs.readFile(filePath);
    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const cacheKey = `${entity}_${fileHash}`;
    
    // Try Redis cache first
    if (redisService.isAvailable()) {
      try {
        const cachedResult = await redisService.getCachedParsedFile(cacheKey);
        if (cachedResult) {
          console.log(`✅ Redis cache hit for parsed file: ${path.basename(filePath)}`);
          return cachedResult;
        }
        console.log(`📭 Redis cache miss for parsed file: ${path.basename(filePath)}`);
      } catch (cacheError) {
        console.warn(`⚠️ Redis cache error for file parsing:`, cacheError.message);
      }
    } else {
      console.log(`⚠️ Redis unavailable, parsing file without cache: ${path.basename(filePath)}`);
    }

    const fileExtension = path.extname(filePath).toLowerCase();
    let rawData;

    // Parse based on file type
    if (fileExtension === '.csv') {
      rawData = await parseCSV(filePath);
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      rawData = await parseXLSX(filePath);
    } else {
      throw new Error(`Unsupported file format: ${fileExtension}`);
    }

    // Process the parsed data
    const result = parseEntityData(rawData, entity, strict);
    
    if (strict && result.invalidRows.length > 0) {
      throw new Error(`Parsing failed: ${result.invalidRows.length} invalid rows found`);
    }

    console.log(`✅ Successfully parsed ${result.validRows.length} valid rows, ${result.invalidRows.length} invalid rows skipped`);
    
    // Cache the successful result in Redis
    if (redisService.isAvailable()) {
      try {
        await redisService.cacheParsedFile(cacheKey, result.validRows);
        console.log(`✅ Cached parsed file result in Redis: ${path.basename(filePath)}`);
      } catch (cacheError) {
        console.warn(`⚠️ Failed to cache parsed file result:`, cacheError.message);
      }
    }
    
    return result.validRows;

  } catch (error) {
    console.error(`❌ Error parsing file ${filePath}:`, error.message);
    if (strict) throw error;
    return [];
  }
}

/**
 * Parses CSV file using Papa Parse
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Array<Object>>} Raw parsed data
 */
async function parseCSV(filePath) {
  const fileContent = await fs.readFile(filePath, 'utf8');
  
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep everything as strings initially
      delimitersToGuess: [',', ';', '\t', '|'],
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('⚠️ CSV parsing warnings:', results.errors);
        }
        resolve(results.data);
      },
      error: reject
    });
  });
}

/**
 * Parses XLSX file using xlsx library
 * @param {string} filePath - Path to XLSX file
 * @returns {Promise<Array<Object>>} Raw parsed data
 */
async function parseXLSX(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  // Use the first worksheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with header row
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    defval: '',
    blankrows: false
  });
  
  if (jsonData.length === 0) return [];
  
  // Convert array format to object format
  const headers = jsonData[0];
  const rows = jsonData.slice(1);
  
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });
}

/**
 * Processes raw parsed data and normalizes it based on entity type
 * @param {Array<Object>} rawData - Raw parsed data
 * @param {'clients'|'workers'|'tasks'} entity - Entity type
 * @param {boolean} strict - Strict mode flag
 * @returns {Object} Object with validRows and invalidRows arrays
 */
export function parseEntityData(rawData, entity, strict = false) {
  if (!Array.isArray(rawData) || rawData.length === 0) {
    return { validRows: [], invalidRows: [] };
  }

  const validRows = [];
  const invalidRows = [];
  
  // Get first row to analyze headers
  const rawHeaders = Object.keys(rawData[0]);
  const mappedHeaders = getParsedHeaders(rawHeaders, entity);
  logUnmappedHeaders(rawHeaders, entity);

  // Process each row
  rawData.forEach((row, index) => {
    try {
      // Skip completely empty rows
      if (isEmptyRow(row)) {
        return;
      }

      // Map headers to standard format
      const mappedRow = {};
      Object.entries(row).forEach(([key, value]) => {
        const standardKey = mappedHeaders[key] || key;
        mappedRow[standardKey] = value;
      });

      // Normalize the record
      const normalizedRow = normalizeRecord(mappedRow, entity);
      
      // Validate the record
      if (isValidRecord(normalizedRow, entity)) {
        validRows.push(normalizedRow);
      } else {
        console.warn(`⚠️ Invalid row ${index + 1}:`, normalizedRow);
        invalidRows.push({ ...normalizedRow, _rowIndex: index + 1, _error: 'Validation failed' });
      }
    } catch (error) {
      console.warn(`⚠️ Error processing row ${index + 1}:`, error.message);
      invalidRows.push({ ...row, _rowIndex: index + 1, _error: error.message });
    }
  });

  return { validRows, invalidRows };
}

/**
 * Maps raw headers to standardized format using header mappings
 * @param {Array<string>} rawHeaders - Original headers from file
 * @param {'clients'|'workers'|'tasks'} entity - Entity type
 * @returns {Object} Header mapping object
 */
export function getParsedHeaders(rawHeaders, entity) {
  const mappings = headerMappings[entity] || {};
  const headerMap = {};
  
  rawHeaders.forEach(header => {
    const normalizedHeader = header.trim().toLowerCase();
    const mappedHeader = mappings[header] || mappings[normalizedHeader];
    headerMap[header] = mappedHeader || header;
  });
  
  return headerMap;
}

/**
 * Normalizes a single record based on entity type
 * @param {Object} record - Raw record object
 * @param {'clients'|'workers'|'tasks'} entity - Entity type
 * @returns {Object} Normalized record
 */
export function normalizeRecord(record, entity) {
  const normalized = { ...record };
  
  switch (entity) {
    case 'clients':
      return normalizeClientRecord(normalized);
    case 'workers':
      return normalizeWorkerRecord(normalized);
    case 'tasks':
      return normalizeTaskRecord(normalized);
    default:
      return normalized;
  }
}

/**
 * Normalizes client-specific fields
 */
function normalizeClientRecord(record) {
  const normalized = { ...record };
  
  // PriorityLevel: ensure 1-5 range
  if (normalized.PriorityLevel !== undefined) {
    const priority = parseInt(normalized.PriorityLevel);
    normalized.PriorityLevel = isNaN(priority) ? 1 : Math.max(1, Math.min(5, priority));
  }
  
  // RequestedTaskIDs: convert to array
  if (normalized.RequestedTaskIDs) {
    normalized.RequestedTaskIDs = parseArrayField(normalized.RequestedTaskIDs);
  }
  
  // AttributesJSON: parse JSON
  if (normalized.AttributesJSON) {
    normalized.AttributesJSON = parseJSONField(normalized.AttributesJSON);
  }
  
  return normalized;
}

/**
 * Normalizes worker-specific fields
 */
function normalizeWorkerRecord(record) {
  const normalized = { ...record };
  
  // Skills: convert to array
  if (normalized.Skills) {
    normalized.Skills = parseArrayField(normalized.Skills);
  }
  
  // AvailableSlots: parse array or range
  if (normalized.AvailableSlots) {
    normalized.AvailableSlots = parseNumericArrayField(normalized.AvailableSlots);
  }
  
  // MaxLoadPerPhase: ensure integer
  if (normalized.MaxLoadPerPhase !== undefined) {
    const maxLoad = parseInt(normalized.MaxLoadPerPhase);
    normalized.MaxLoadPerPhase = isNaN(maxLoad) ? 1 : Math.max(1, maxLoad);
  }
  
  // QualificationLevel: normalize to lowercase
  if (normalized.QualificationLevel) {
    normalized.QualificationLevel = normalized.QualificationLevel.toString().toLowerCase();
  }
  
  return normalized;
}

/**
 * Normalizes task-specific fields
 */
function normalizeTaskRecord(record) {
  const normalized = { ...record };
  
  // Duration: ensure positive integer
  if (normalized.Duration !== undefined) {
    const duration = parseInt(normalized.Duration);
    normalized.Duration = isNaN(duration) ? 1 : Math.max(1, duration);
  }
  
  // RequiredSkills: convert to array
  if (normalized.RequiredSkills) {
    normalized.RequiredSkills = parseArrayField(normalized.RequiredSkills);
  }
  
  // PreferredPhases: handle ranges like "1-3" or arrays
  if (normalized.PreferredPhases) {
    normalized.PreferredPhases = parsePhaseField(normalized.PreferredPhases);
  }
  
  // MaxConcurrent: ensure positive integer
  if (normalized.MaxConcurrent !== undefined) {
    const maxConcurrent = parseInt(normalized.MaxConcurrent);
    normalized.MaxConcurrent = isNaN(maxConcurrent) ? 1 : Math.max(1, maxConcurrent);
  }
  
  return normalized;
}

/**
 * Flexible validation - only checks for essential identifier
 * @param {Object} record - Record to validate
 * @param {'clients'|'workers'|'tasks'} entity - Entity type
 * @returns {boolean} True if valid
 */
export function isValidRecord(record, entity) {
  const requirements = requiredFields[entity];
  if (!requirements) return true; // Unknown entity, allow it
  
  // Check that at least one identifier field exists and is not empty
  const hasIdentifier = requirements.identifier.some(field => 
    record[field] && record[field].toString().trim() !== ''
  );
  
  if (!hasIdentifier) {
    console.warn(`⚠️ Record missing identifier for ${entity}:`, record);
      return false;
  }
  
  // Very lenient validation - only check for obvious data integrity issues
  switch (entity) {
    case 'clients':
      // Only validate PriorityLevel if it exists
      if (record.PriorityLevel !== undefined && record.PriorityLevel !== null && record.PriorityLevel !== '') {
        const priority = parseInt(record.PriorityLevel);
        if (isNaN(priority) || priority < 1 || priority > 5) {
          console.warn(`⚠️ Invalid PriorityLevel for client: ${record.PriorityLevel}`);
          // Don't reject, just warn
        }
      }
      return true;
      
    case 'workers':
      // Only validate MaxLoadPerPhase if it exists
      if (record.MaxLoadPerPhase !== undefined && record.MaxLoadPerPhase !== null && record.MaxLoadPerPhase !== '') {
        const maxLoad = parseInt(record.MaxLoadPerPhase);
        if (isNaN(maxLoad) || maxLoad < 0) {
          console.warn(`⚠️ Invalid MaxLoadPerPhase for worker: ${record.MaxLoadPerPhase}`);
          // Don't reject, just warn
        }
      }
      return true;
      
    case 'tasks':
      // Only validate Duration if it exists
      if (record.Duration !== undefined && record.Duration !== null && record.Duration !== '') {
        const duration = parseInt(record.Duration);
        if (isNaN(duration) || duration < 0) {
          console.warn(`⚠️ Invalid Duration for task: ${record.Duration}`);
          // Don't reject, just warn
        }
      }
      return true;
      
    default:
      return true;
  }
}

/**
 * Logs headers that couldn't be mapped to standard format
 * @param {Array<string>} rawHeaders - Original headers
 * @param {'clients'|'workers'|'tasks'} entity - Entity type
 */
export function logUnmappedHeaders(rawHeaders, entity) {
  const mappings = headerMappings[entity] || {};
  const unmapped = [];
  
  rawHeaders.forEach(header => {
    const normalizedHeader = header.trim().toLowerCase();
    if (!mappings[header] && !mappings[normalizedHeader]) {
      unmapped.push(header);
    }
  });
  
  if (unmapped.length > 0) {
    console.warn(`⚠️ Unmapped headers for ${entity}:`, unmapped);
  }
}

// Utility functions for field parsing

/**
 * Parses comma or semicolon separated values into array
 */
function parseArrayField(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  
  const str = value.toString().trim();
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      return JSON.parse(str);
    } catch {
      // Fallback to manual parsing
      return str.slice(1, -1).split(',').map(s => s.trim()).filter(s => s);
    }
  }
  
  return str.split(/[,;]/).map(s => s.trim()).filter(s => s);
}

/**
 * Parses numeric arrays, supporting ranges like "1-3"
 */
function parseNumericArrayField(value) {
  if (Array.isArray(value)) return value.map(v => parseInt(v)).filter(v => !isNaN(v));
  if (!value) return [];
  
  const str = value.toString().trim();
  
  // Handle JSON array format
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      return parsed.map(v => parseInt(v)).filter(v => !isNaN(v));
    } catch {
      // Fallback parsing
    }
  }
  
  // Handle range format "1-3"
  if (str.includes('-') && /^\d+\s*-\s*\d+$/.test(str)) {
    const [start, end] = str.split('-').map(s => parseInt(s.trim()));
    if (!isNaN(start) && !isNaN(end) && start <= end) {
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
  }
  
  // Handle comma-separated numbers
  return str.split(/[,;]/).map(s => parseInt(s.trim())).filter(v => !isNaN(v));
}

/**
 * Parses phase fields, supporting ranges and arrays
 */
function parsePhaseField(value) {
  return parseNumericArrayField(value);
}

/**
 * Safely parses JSON fields
 */
function parseJSONField(value) {
  if (typeof value === 'object') return value;
  if (!value || value.toString().trim() === '') return {};
  
  try {
    return JSON.parse(value.toString());
  } catch {
    console.warn('⚠️ Invalid JSON field, using empty object:', value);
    return {};
  }
}

/**
 * Checks if a row is completely empty
 */
function isEmptyRow(row) {
  return Object.values(row).every(value => 
    value === null || value === undefined || value.toString().trim() === ''
  );
}

/**
 * Process uploaded data and normalize it for storage with Redis caching
 * @param {Array} rawData - Raw parsed data from file
 * @param {'clients'|'workers'|'tasks'} entity - Entity type
 * @returns {Promise<Array>} Processed and normalized data
 */
export async function processUploadedData(rawData, entity) {
  try {
    console.log(`[Parser Service] Processing ${rawData.length} records for ${entity}`);
    
    // Generate data hash for caching
    const dataHash = crypto.createHash('md5').update(JSON.stringify(rawData)).digest('hex');
    const cacheKey = `processed_${entity}_${dataHash}`;
    
    // Try Redis cache first
    if (redisService.isAvailable()) {
      try {
        const cachedProcessed = await redisService.getCachedParsedFile(cacheKey);
        if (cachedProcessed) {
          console.log(`[Parser Service] ✅ Redis cache hit for processed data: ${entity}`);
          return cachedProcessed;
        }
        console.log(`[Parser Service] 📭 Redis cache miss for processed data: ${entity}`);
      } catch (cacheError) {
        console.warn(`[Parser Service] ⚠️ Redis cache error for processed data:`, cacheError.message);
      }
    }
    
    const result = parseEntityData(rawData, entity, false);
    
    // Add processing metadata to each record
    const processedData = result.validRows.map(record => ({
      ...record,
      _metadata: {
        processedAt: new Date().toISOString(),
        source: 'file_upload',
        entity: entity
      }
    }));
    
    // Cache the processed result in Redis
    if (redisService.isAvailable()) {
      try {
        await redisService.cacheParsedFile(cacheKey, processedData);
        console.log(`[Parser Service] ✅ Cached processed data in Redis: ${entity}`);
      } catch (cacheError) {
        console.warn(`[Parser Service] ⚠️ Failed to cache processed data:`, cacheError.message);
      }
    }
    
    console.log(`[Parser Service] Successfully processed ${processedData.length} records`);
    return processedData;
    
  } catch (error) {
    console.error(`[Parser Service] Error processing data for ${entity}:`, error);
    throw new Error(`Failed to process ${entity} data: ${error.message}`);
  }
}

/**
 * Sample usage and testing examples:
 * 
 * // Basic usage
 * const clients = await parseFile('/uploads/clients.csv', 'clients');
 * console.log('Parsed clients:', clients);
 * 
 * // Strict mode
 * try {
 *   const workers = await parseFile('/uploads/workers.xlsx', 'workers', true);
 * } catch (error) {
 *   console.error('Strict parsing failed:', error);
 * }
 * 
 * // Manual processing
 * const rawData = await parseCSV('/uploads/tasks.csv');
 * const { validRows, invalidRows } = parseEntityData(rawData, 'tasks');
 * console.log(`Valid: ${validRows.length}, Invalid: ${invalidRows.length}`);
 */