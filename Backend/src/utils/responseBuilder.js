/**
 * Build standardized API responses
 */
class ResponseBuilder {
    /**
     * Success response
     */
    static success(data = null, message = 'Success', meta = {}) {
      return {
        success: true,
        message,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          ...meta
        }
      };
    }
  
    /**
     * Error response
     */
    static error(message = 'Error', details = null, code = null) {
      return {
        success: false,
        error: {
          message,
          details,
          code,
          timestamp: new Date().toISOString()
        }
      };
    }
  
    /**
     * Validation error response
     */
    static validationError(errors, message = 'Validation failed') {
      return {
        success: false,
        error: {
          message,
          type: 'validation_error',
          details: errors,
          timestamp: new Date().toISOString()
        }
      };
    }
  
    /**
     * Not found response
     */
    static notFound(resource = 'Resource', id = null) {
      return {
        success: false,
        error: {
          message: `${resource}${id ? ` with id '${id}'` : ''} not found`,
          type: 'not_found',
          timestamp: new Date().toISOString()
        }
      };
    }
  
    /**
     * Paginated response
     */
    static paginated(data, pagination) {
      return {
        success: true,
        data,
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 10,
          total: pagination.total || 0,
          totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
          hasNext: pagination.hasNext || false,
          hasPrev: pagination.hasPrev || false
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };
    }
  
    /**
     * File upload response
     */
    static fileUpload(files, message = 'Files uploaded successfully') {
      return {
        success: true,
        message,
        data: {
          files: Array.isArray(files) ? files : [files]
        },
        meta: {
          uploadCount: Array.isArray(files) ? files.length : 1,
          timestamp: new Date().toISOString()
        }
      };
    }
  
    /**
     * Processing response (for long-running operations)
     */
    static processing(jobId, message = 'Processing started') {
      return {
        success: true,
        message,
        data: {
          jobId,
          status: 'processing'
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };
    }
  
    /**
     * Bulk operation response
     */
    static bulkOperation(results, operation = 'bulk operation') {
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
  
      return {
        success: failed === 0,
        message: `${operation} completed`,
        data: {
          results,
          summary: {
            total: results.length,
            successful,
            failed
          }
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };
    }
  }
  
  export default ResponseBuilder;