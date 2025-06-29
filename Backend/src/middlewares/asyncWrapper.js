/**
 * Async wrapper middleware to handle async route handlers
 * Automatically catches errors and passes them to the error handler
 */
const asyncWrapper = (fn) => {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };
  
  export default asyncWrapper;
  