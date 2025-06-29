// controllers/upload.controller.js
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import ResponseBuilder from '../utils/responseBuilder.js';
import { parseCSV, parseExcel, validateDataStructure } from '../utils/csvUtils.js';
import { getFileExtension, cleanupFiles, getFileStats } from '../utils/fileUtils.js';
import { processUploadedData } from '../services/parser.service.js';
import dataStore from '../../dataStore.js';
import redisService from '../services/redis.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Upload and process files with Redis cache management
 */
export const uploadFiles = async (req, res) => {
  const uploadedFiles = [];
  const processingResults = {};
  const errors = [];
  const entitiesToInvalidate = new Set();

  try {
    console.log('[Upload Controller] Request received');
    console.log('[Upload Controller] Files in request:', req.files ? Object.keys(req.files) : 'none');
    console.log('[Upload Controller] Body:', req.body);
    
    // Check if files were uploaded
    if (!req.files || Object.keys(req.files).length === 0) {
      console.log('[Upload Controller] No files found in request');
      return res.status(400).json(
        ResponseBuilder.error('No files uploaded', 'Please select files to upload')
      );
    }

    // Process each entity type
    for (const [entity, files] of Object.entries(req.files)) {
      console.log(`[Upload Controller] Processing entity: ${entity}, files:`, files?.length || 0);
      
      if (files && files.length > 0) {
        const file = files[0]; // Take first file for each entity
        console.log(`[Upload Controller] Processing file: ${file.originalname}, size: ${file.size}`);
        
        try {
          // Get file info
          const fileInfo = {
            originalName: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
            entity: entity
          };

          uploadedFiles.push(fileInfo);

          // Parse the file based on extension (this will use Redis caching internally)
          const extension = getFileExtension(file.originalname);
          let parseResult;

          if (extension === '.csv') {
            parseResult = await parseCSV(file.path);
          } else if (extension === '.xlsx' || extension === '.xls') {
            parseResult = await parseExcel(file.path);
          } else {
            throw new Error(`Unsupported file format: ${extension}`);
          }

          // Validate data structure with smart entity detection
          console.log(`[Upload Controller] Validating data structure for ${entity}`);
          console.log(`[Upload Controller] First row keys:`, Object.keys(parseResult.data[0] || {}));
          
          const structureErrors = validateDataStructure(parseResult.data, entity);
          
          // Separate critical errors from suggestions
          const criticalErrors = structureErrors.filter(err => err.type !== 'suggestion');
          const suggestions = structureErrors.filter(err => err.type === 'suggestion');
          
          if (criticalErrors.length > 0) {
            console.log(`[Upload Controller] Critical validation errors:`, criticalErrors);
            errors.push({
              entity,
              file: file.originalname,
              errors: criticalErrors,
              suggestions: suggestions.length > 0 ? suggestions : undefined
            });
            continue;
          }
          
          // Log suggestions but don't block upload
          if (suggestions.length > 0) {
            console.log(`[Upload Controller] Suggestions for ${entity}:`, suggestions);
          }

          // Process and normalize data (this will use Redis caching internally)
          const processedData = await processUploadedData(parseResult.data, entity);

          // Store in data store (authoritative source)
          dataStore.setData(entity, processedData, file.originalname);
          
          // Mark entity for cache invalidation
          entitiesToInvalidate.add(entity);

          // Store processing results
          processingResults[entity] = {
            filename: file.originalname,
            recordCount: processedData.length,
            parseErrors: parseResult.errors,
            processed: true
          };

        } catch (error) {
          console.error(`Error processing ${entity} file:`, error);
          errors.push({
            entity,
            file: file.originalname,
            error: error.message
          });
        }
      }
    }

    // Invalidate Redis caches for updated entities
    if (redisService.isAvailable() && entitiesToInvalidate.size > 0) {
      try {
        for (const entity of entitiesToInvalidate) {
          const cacheKey = `entity_data_${entity}`;
          await redisService.delCache(cacheKey);
          console.log(`[Upload Controller] ✅ Invalidated Redis cache for uploaded entity: ${entity}`);
        }
        
        // Also clear validation caches since data changed
        await redisService.clearCachePattern('validate:*');
        console.log(`[Upload Controller] ✅ Cleared validation caches after data upload`);
      } catch (cacheError) {
        console.warn(`[Upload Controller] ⚠️ Failed to invalidate caches after upload:`, cacheError.message);
      }
    }

    // Response based on results
    if (errors.length > 0 && Object.keys(processingResults).length === 0) {
      // All files failed
      return res.status(400).json(
        ResponseBuilder.error('File processing failed', errors)
      );
    }

    // At least some files processed successfully
    const response = ResponseBuilder.success(
      {
        processed: processingResults,
        files: uploadedFiles.map(f => ({
          entity: f.entity,
          originalName: f.originalName,
          size: f.size,
          status: processingResults[f.entity] ? 'processed' : 'failed'
        })),
        cacheInvalidated: Array.from(entitiesToInvalidate)
      },
      'Files uploaded and processed',
      {
        totalFiles: uploadedFiles.length,
        successfulProcessing: Object.keys(processingResults).length,
        errors: errors.length > 0 ? errors : undefined
      }
    );

    res.status(200).json(response);

  } catch (error) {
    console.error('Upload error:', error);
    
    // Cleanup uploaded files on error
    const filePaths = uploadedFiles.map(f => f.path);
    await cleanupFiles(filePaths);

    res.status(500).json(
      ResponseBuilder.error('Upload processing failed', error.message)
    );
  }
};

/**
 * Get upload status and statistics with Redis-first strategy
 */
export const getUploadStatus = async (req, res) => {
  try {
    // Try Redis cache first for metadata
    let metadata, stats;
    
    if (redisService.isAvailable()) {
      try {
        const cacheKey = 'upload_status_metadata';
        const cachedStatus = await redisService.getCache(cacheKey);
        if (cachedStatus) {
          console.log(`[Upload Controller] ✅ Redis cache hit for upload status`);
          return res.json(ResponseBuilder.success(cachedStatus, 'Upload status retrieved from cache'));
        }
        console.log(`[Upload Controller] 📭 Redis cache miss for upload status`);
      } catch (cacheError) {
        console.warn(`[Upload Controller] ⚠️ Redis error for upload status:`, cacheError.message);
      }
    }

    // Fallback to dataStore
    metadata = dataStore.getMetadata();
    stats = dataStore.getStats();

    const uploadStatus = {
      entities: {},
      summary: {
        totalRecords: stats.totalRecords,
        entitiesWithData: Object.keys(stats.recordCounts).filter(
          entity => stats.recordCounts[entity] > 0
        ).length,
        lastUpdated: stats.lastUpdated ? new Date(stats.lastUpdated).toISOString() : null
      }
    };

    // Build entity status
    ['clients', 'workers', 'tasks'].forEach(entity => {
      uploadStatus.entities[entity] = {
        hasData: stats.recordCounts[entity] > 0,
        recordCount: stats.recordCounts[entity],
        fileName: metadata[entity].fileName,
        lastUpdated: metadata[entity].lastUpdated
      };
    });

    // Cache the status for future requests
    if (redisService.isAvailable()) {
      try {
        const cacheKey = 'upload_status_metadata';
        await redisService.setCache(cacheKey, uploadStatus, 60); // 1 minute cache
        console.log(`[Upload Controller] ✅ Cached upload status in Redis`);
      } catch (cacheError) {
        console.warn(`[Upload Controller] ⚠️ Failed to cache upload status:`, cacheError.message);
      }
    }

    res.json(ResponseBuilder.success(uploadStatus, 'Upload status retrieved'));

  } catch (error) {
    console.error('Error getting upload status:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to get upload status', error.message)
    );
  }
};

/**
 * Delete uploaded file
 */
export const deleteUploadedFile = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json(
        ResponseBuilder.error('Filename is required')
      );
    }

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const filePath = path.join(uploadsDir, filename);

    // Check if file exists
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json(
        ResponseBuilder.notFound('File', filename)
      );
    }

    // Get file stats before deletion
    const fileStats = await getFileStats(filePath);

    // Delete the file
    await fs.unlink(filePath);

    res.json(ResponseBuilder.success(
      {
        filename,
        deletedAt: new Date().toISOString(),
        size: fileStats.size
      },
      'File deleted successfully'
    ));

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to delete file', error.message)
    );
  }
};