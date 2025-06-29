import api from './api';
import { UploadFile, UploadStatus } from '../types';

export type EntityType = 'clients' | 'workers' | 'tasks';

export const uploadService = {
  // Upload file with entity type
  async uploadFile(file: File, entityType: EntityType): Promise<UploadFile> {
    console.log('Uploading file:', file.name, 'as entity type:', entityType);
    
    const formData = new FormData();
    formData.append(entityType, file); // Use entity type as field name
    
    console.log('FormData created with field:', entityType);
    console.log('File size:', file.size, 'bytes');
    console.log('File type:', file.type);

    try {
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('Upload response:', response.data);
      
      // Backend returns data in ResponseBuilder format
      if (response.data.success) {
        // Extract file info from the response
        const uploadData = response.data.data;
        const fileInfo = uploadData.files?.find((f: any) => f.entity === entityType);
        const processingInfo = uploadData.processed?.[entityType];
        
        if (fileInfo || processingInfo) {
          return {
            filename: fileInfo?.originalName || processingInfo?.filename || file.name,
            originalName: fileInfo?.originalName || processingInfo?.filename || file.name,
            size: fileInfo?.size || file.size,
            uploadedAt: new Date().toISOString(),
            status: fileInfo?.status === 'processed' || processingInfo?.processed ? 'completed' : 'failed'
          };
        }
      }
      throw new Error(response.data.message || 'Upload failed');
    } catch (error: any) {
      console.error('Upload error:', error);
      console.error('Error response status:', error.response?.status);
      console.error('Error response data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Error message:', error.message);
      throw error;
    }
  },

  // Get upload status (using the general status endpoint)
  async getUploadStatus(filename: string): Promise<UploadStatus> {
    const response = await api.get('/upload/status');
    
    if (response.data.success) {
      const statusData = response.data.data;
      
      // Look for the file in entities
      for (const [entity, info] of Object.entries(statusData.entities || {})) {
        const entityInfo = info as any;
        if (entityInfo.fileName === filename || entityInfo.hasData) {
          return {
            filename,
            status: entityInfo.hasData ? 'completed' : 'failed',
            progress: entityInfo.hasData ? 100 : 0,
            message: entityInfo.hasData ? `${entityInfo.recordCount} records processed` : 'Processing failed'
          };
        }
      }
    }
    
    // Default status if not found
    return {
      filename,
      status: 'completed',
      progress: 100,
      message: 'File processed'
    };
  },

  // Delete uploaded file
  async deleteFile(filename: string): Promise<void> {
    const response = await api.delete(`/upload/${filename}`);
    if (!response.data.success) {
      throw new Error(response.data.message || 'Delete failed');
    }
  },

  // Get all uploaded files (using status endpoint)
  async getUploadedFiles(): Promise<UploadFile[]> {
    const response = await api.get('/upload/status');
    
    if (response.data.success) {
      const statusData = response.data.data;
      const files: UploadFile[] = [];
      
      // Convert entity status to file list
      Object.entries(statusData.entities || {}).forEach(([entity, info]: [string, any]) => {
        if (info.hasData && info.fileName) {
          files.push({
            filename: info.fileName,
            originalName: info.fileName,
            size: 0, // Size not available in status endpoint
            uploadedAt: info.lastUpdated || new Date().toISOString(),
            status: 'completed'
          });
        }
      });
      
      return files;
    }
    
    return [];
  },

  // Get upload status for all files
  async getAllUploadStatuses(): Promise<UploadStatus[]> {
    const response = await api.get('/upload/status');
    
    if (response.data.success) {
      const statusData = response.data.data;
      const statuses: UploadStatus[] = [];
      
      // Convert entity status to status list
      Object.entries(statusData.entities || {}).forEach(([entity, info]: [string, any]) => {
        if (info.hasData && info.fileName) {
          statuses.push({
            filename: info.fileName,
            status: 'completed',
            progress: 100,
            message: `${info.recordCount} records processed`
          });
        }
      });
      
      return statuses;
    }
    
    return [];
  },

  // Get comprehensive upload status (for settings page)
  async getStatus(): Promise<any> {
    const response = await api.get('/upload/status');
    
    if (response.data.success) {
      return response.data.data;
    }
    
    throw new Error(response.data.message || 'Failed to get upload status');
  },
};