// import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
// import toast from 'react-hot-toast';

// // Create axios instance with different timeout configurations
// export const api = axios.create({
//   baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
//   timeout: 30000, // Default timeout
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// // Create specialized instances for different use cases
// export const apiWithLongTimeout = axios.create({
//   baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
//   timeout: 120000, // 2 minutes for AI operations
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// export const apiWithShortTimeout = axios.create({
//   baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
//   timeout: 10000, // 10 seconds for quick operations
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// // Request interceptor for all instances
// const requestInterceptor = (config: any) => {
//   // Add auth token if available
//   const token = localStorage.getItem('auth_token');
//   if (token) {
//     config.headers = config.headers || {};
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// };

// const requestErrorInterceptor = (error: any) => {
//   return Promise.reject(error);
// };

// // Response interceptor for all instances
// const responseInterceptor = (response: any) => {
//   return response;
// };

// const responseErrorInterceptor = (error: any) => {
//   let message = error.response?.data?.message || 
//                 error.response?.data?.error || 
//                 error.message || 
//                 'An error occurred';
  
//   // Ensure message is always a string
//   if (typeof message === 'object') {
//     message = message.message || JSON.stringify(message);
//   }
  
//   // Don't show toast for certain endpoints
//   const skipToast = ['/api/upload/status', '/api/data/', '/ai/'].some((path: string) => 
//     error.config?.url?.includes(path)
//   );
  
//   if (!skipToast) {
//     toast.error(String(message));
//   }
  
//   return Promise.reject(error);
// };

// // Apply interceptors to all instances
// api.interceptors.request.use(requestInterceptor, requestErrorInterceptor);
// api.interceptors.response.use(responseInterceptor, responseErrorInterceptor);

// apiWithLongTimeout.interceptors.request.use(requestInterceptor, requestErrorInterceptor);
// apiWithLongTimeout.interceptors.response.use(responseInterceptor, responseErrorInterceptor);

// apiWithShortTimeout.interceptors.request.use(requestInterceptor, requestErrorInterceptor);
// apiWithShortTimeout.interceptors.response.use(responseInterceptor, responseErrorInterceptor);

// // Helper function to standardize response handling
// export const handleApiResponse = <T>(response: any): T => {
//   if (response.data && typeof response.data === 'object') {
//     // Check for standard success response format
//     if (response.data.success !== undefined) {
//       return response.data.success ? response.data.data : response.data;
//     }
//     // Check for direct data response
//     if (response.data.data !== undefined) {
//       return response.data.data;
//     }
//   }
//   // Return the response data as-is
//   return response.data;
// };

// export const systemService = {
//   // Get system health status
//   async getHealth(): Promise<any> {
//     try {
//       const response = await apiWithShortTimeout.get('/health');
//       return response.data;
//     } catch (error: any) {
//       // Return a structured error response instead of throwing
//       return {
//         status: 'ERROR',
//         timestamp: new Date().toISOString(),
//         message: 'Health check failed',
//         services: {
//           redis: {
//             connected: false,
//             available: false,
//             keyCount: 0,
//             error: 'Service unavailable'
//           },
//           dataStore: {
//             status: 'unknown',
//             message: 'Unable to check dataStore status'
//           }
//         }
//       };
//     }
//   },

//   // Get AI service health
//   async getAIHealth(): Promise<any> {
//     try {
//       const response = await apiWithShortTimeout.get('/ai/health');
//       return response.data;
//     } catch (error: any) {
//       // Return a structured error response instead of throwing
//       return {
//         success: false,
//         error: error.response?.status === 503 ? 'AI service unavailable' : error.message || 'AI health check failed',
//         status: error.response?.status || 500
//       };
//     }
//   },

//   // Test API connection
//   async testConnection(): Promise<boolean> {
//     try {
//       await apiWithShortTimeout.get('/health');
//       return true;
//     } catch (error) {
//       return false;
//     }
//   }
// };

// export const validationService = {
//   // Get validation summary for dashboard
//   async getValidationSummary(): Promise<any> {
//     try {
//       const response = await api.get('/data/validation-summary');
//       return handleApiResponse(response);
//     } catch (error: any) {
//       console.error('Failed to get validation summary:', error);
//       throw error;
//     }
//   },

//   // Run enhanced validation across all entities
//   async runEnhancedValidation(options: { cacheResults?: boolean } = {}): Promise<any> {
//     try {
//       const response = await apiWithLongTimeout.post('/data/validate-enhanced', options);
//       return handleApiResponse(response);
//     } catch (error: any) {
//       console.error('Enhanced validation failed:', error);
//       throw error;
//     }
//   },

//   // Apply suggested fixes
//   async applyFixes(fixes: any[]): Promise<any> {
//     try {
//       const response = await api.post('/data/apply-fixes', { fixes });
//       return handleApiResponse(response);
//     } catch (error: any) {
//       console.error('Failed to apply fixes:', error);
//       throw error;
//     }
//   }
// };

// export default api;




import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import toast from 'react-hot-toast';

// Backend base URL hardcoded
const BASE_URL = 'https://digitalyze-rb7o.onrender.com/api';

// Create axios instance with different timeout configurations
export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // Default timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create specialized instances for different use cases
export const apiWithLongTimeout = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 2 minutes for AI operations
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiWithShortTimeout = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // 10 seconds for quick operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for all instances
const requestInterceptor = (config: any) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

const requestErrorInterceptor = (error: any) => {
  return Promise.reject(error);
};

// Response interceptor for all instances
const responseInterceptor = (response: any) => {
  return response;
};

const responseErrorInterceptor = (error: any) => {
  let message = error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                'An error occurred';

  if (typeof message === 'object') {
    message = message.message || JSON.stringify(message);
  }

  const skipToast = ['/api/upload/status', '/api/data/', '/ai/'].some((path: string) =>
    error.config?.url?.includes(path)
  );

  if (!skipToast) {
    toast.error(String(message));
  }

  return Promise.reject(error);
};

// Apply interceptors to all instances
api.interceptors.request.use(requestInterceptor, requestErrorInterceptor);
api.interceptors.response.use(responseInterceptor, responseErrorInterceptor);

apiWithLongTimeout.interceptors.request.use(requestInterceptor, requestErrorInterceptor);
apiWithLongTimeout.interceptors.response.use(responseInterceptor, responseErrorInterceptor);

apiWithShortTimeout.interceptors.request.use(requestInterceptor, requestErrorInterceptor);
apiWithShortTimeout.interceptors.response.use(responseInterceptor, responseErrorInterceptor);

// Helper function to standardize response handling
export const handleApiResponse = <T>(response: any): T => {
  if (response.data && typeof response.data === 'object') {
    if (response.data.success !== undefined) {
      return response.data.success ? response.data.data : response.data;
    }
    if (response.data.data !== undefined) {
      return response.data.data;
    }
  }
  return response.data;
};

export const systemService = {
  async getHealth(): Promise<any> {
    try {
      const response = await apiWithShortTimeout.get('/health');
      return response.data;
    } catch (error: any) {
      return {
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        message: 'Health check failed',
        services: {
          redis: {
            connected: false,
            available: false,
            keyCount: 0,
            error: 'Service unavailable'
          },
          dataStore: {
            status: 'unknown',
            message: 'Unable to check dataStore status'
          }
        }
      };
    }
  },

  async getAIHealth(): Promise<any> {
    try {
      const response = await apiWithShortTimeout.get('/ai/health');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.status === 503 ? 'AI service unavailable' : error.message || 'AI health check failed',
        status: error.response?.status || 500
      };
    }
  },

  async testConnection(): Promise<boolean> {
    try {
      await apiWithShortTimeout.get('/health');
      return true;
    } catch (error) {
      return false;
    }
  }
};

export const validationService = {
  async getValidationSummary(): Promise<any> {
    try {
      const response = await api.get('/data/validation-summary');
      return handleApiResponse(response);
    } catch (error: any) {
      console.error('Failed to get validation summary:', error);
      throw error;
    }
  },

  async runEnhancedValidation(options: { cacheResults?: boolean } = {}): Promise<any> {
    try {
      const response = await apiWithLongTimeout.post('/data/validate-enhanced', options);
      return handleApiResponse(response);
    } catch (error: any) {
      console.error('Enhanced validation failed:', error);
      throw error;
    }
  },

  async applyFixes(fixes: any[]): Promise<any> {
    try {
      const response = await api.post('/data/apply-fixes', { fixes });
      return handleApiResponse(response);
    } catch (error: any) {
      console.error('Failed to apply fixes:', error);
      throw error;
    }
  }
};

export default api;
