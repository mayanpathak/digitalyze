const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
  
    // Multer file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large',
        message: 'File size exceeds the maximum allowed limit'
      });
    }
  
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        message: 'Number of files exceeds the maximum allowed limit'
      });
    }
  
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field',
        message: 'Unexpected file field in upload'
      });
    }
  
    // Validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: err.message,
        details: err.details || []
      });
    }
  
    // JSON parsing errors
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON',
        message: 'Request body contains invalid JSON'
      });
    }
  
    // Custom application errors
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: err.message || 'Application Error',
        message: err.details || err.message
      });
    }
  
    // Default server error
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  };
  
  export default errorHandler;
  