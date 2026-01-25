/**
 * Centralized API Error Handler
 * Safely extracts error messages from various API response formats
 * Prevents "Objects are not valid as a React child" errors
 */

export const getErrorMessage = (error, defaultMessage = 'Ha ocurrido un error') => {
  // If it's already a string, return it
  if (typeof error === 'string') {
    return error;
  }

  // If null or undefined
  if (!error) {
    return defaultMessage;
  }

  // Handle Axios error responses
  if (error.response) {
    const data = error.response.data;
    
    // FastAPI validation error format
    if (data?.detail) {
      // If detail is a string, return it
      if (typeof data.detail === 'string') {
        return data.detail;
      }
      // If detail is an array (validation errors), format them
      if (Array.isArray(data.detail)) {
        return data.detail
          .map(err => {
            if (typeof err === 'string') return err;
            if (err?.msg) return err.msg;
            if (err?.message) return err.message;
            return JSON.stringify(err);
          })
          .join(', ');
      }
      // If detail is an object, try to extract message
      if (typeof data.detail === 'object') {
        return data.detail.message || data.detail.msg || JSON.stringify(data.detail);
      }
    }
    
    // Other common response formats
    if (data?.message && typeof data.message === 'string') {
      return data.message;
    }
    if (data?.error && typeof data.error === 'string') {
      return data.error;
    }
    if (data?.msg && typeof data.msg === 'string') {
      return data.msg;
    }
    
    // Last resort for response data
    if (typeof data === 'string') {
      return data;
    }
  }

  // Handle standard Error objects
  if (error.message && typeof error.message === 'string') {
    return error.message;
  }

  // Handle objects with msg property
  if (error.msg && typeof error.msg === 'string') {
    return error.msg;
  }

  // Fallback
  return defaultMessage;
};

export default getErrorMessage;
