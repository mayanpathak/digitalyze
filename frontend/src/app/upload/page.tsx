'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { uploadService, EntityType } from '../../../services/upload';
import { useUploadStore } from '../../../store/useUploadStore';

export default function UploadPage() {
  const queryClient = useQueryClient();
  const { files, addFile, removeFile, setUploadProgress } = useUploadStore();
  const [selectedDataType, setSelectedDataType] = useState<EntityType>('clients');
  
  const { data: uploadedFiles, isLoading } = useQuery({
    queryKey: ['uploaded-files'],
    queryFn: uploadService.getUploadedFiles,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, entityType }: { file: File; entityType: EntityType }) => 
      uploadService.uploadFile(file, entityType),
    onSuccess: (data, variables) => {
      addFile(data);
      toast.success(`${variables.entityType} file uploaded successfully!`);
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['uploaded-files'] });
      queryClient.invalidateQueries({ queryKey: ['entities', variables.entityType] });
      queryClient.invalidateQueries({ queryKey: ['entity-stats', variables.entityType] });
      
      // Also invalidate dashboard stats
      queryClient.invalidateQueries({ queryKey: ['entity-stats'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Upload failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: uploadService.deleteFile,
    onSuccess: (_, filename) => {
      removeFile(filename);
      toast.success('File deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['uploaded-files'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Delete failed');
    },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: (acceptedFiles) => {
      acceptedFiles.forEach((file) => {
        uploadMutation.mutate({ file, entityType: selectedDataType });
      });
    },
    onDropRejected: (rejectedFiles) => {
      rejectedFiles.forEach((file) => {
        const error = file.errors[0];
        toast.error(`${file.file.name}: ${error.message}`);
      });
    },
  });

  const handleDelete = (filename: string) => {
    if (confirm('Are you sure you want to delete this file?')) {
      deleteMutation.mutate(filename);
    }
  };

  const dataTypeOptions = [
    { value: 'clients' as EntityType, label: 'Clients', description: 'Client information and budgets' },
    { value: 'workers' as EntityType, label: 'Workers', description: 'Worker profiles and skills' },
    { value: 'tasks' as EntityType, label: 'Tasks', description: 'Task assignments and status' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Files</h1>
        <p className="text-gray-600 mt-2">
          Upload CSV or XLSX files for processing. Select the data type and upload your files.
        </p>
      </div>

      {/* Data Type Selection */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Select Data Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dataTypeOptions.map((option) => (
            <label
              key={option.value}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedDataType === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="dataType"
                value={option.value}
                checked={selectedDataType === option.value}
                onChange={(e) => setSelectedDataType(e.target.value as EntityType)}
                className="sr-only"
              />
              <div className="text-center">
                <h4 className="font-medium text-gray-900">{option.label}</h4>
                <p className="text-sm text-gray-600 mt-1">{option.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Dropzone */}
      <div className="card">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <div className="text-4xl text-gray-400 mb-4">📁</div>
          {isDragActive ? (
            <p className="text-blue-600">Drop the files here ...</p>
          ) : (
            <div>
              <p className="text-gray-600 mb-2">
                Drag & drop {selectedDataType} files here, or click to select files
              </p>
              <p className="text-sm text-gray-500">
                Supports CSV and XLSX files up to 10MB
              </p>
              <p className="text-sm text-blue-600 mt-2">
                Selected data type: <strong>{dataTypeOptions.find(opt => opt.value === selectedDataType)?.label}</strong>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {uploadMutation.isPending && (
        <div className="card">
          <h3 className="font-semibold mb-4">Uploading {selectedDataType} data...</h3>
          <div className="bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse w-1/2"></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Processing file and storing data...
          </p>
        </div>
      )}

      {/* Success Message */}
      {uploadMutation.isSuccess && (
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center">
            <div className="text-green-600 text-xl mr-3">✅</div>
            <div>
              <h3 className="font-semibold text-green-800">Upload Successful!</h3>
              <p className="text-green-700 text-sm">
                Your {selectedDataType} data has been processed and is now available in the data section.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Files */}
      <div className="card">
        <h3 className="font-semibold mb-4">Upload Status</h3>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="loading-skeleton h-16"></div>
            ))}
          </div>
        ) : uploadedFiles && uploadedFiles.length > 0 ? (
          <div className="space-y-3">
            {uploadedFiles.map((file) => (
              <div
                key={file.filename}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">📄</div>
                  <div>
                    <p className="font-medium">{file.originalName}</p>
                    <p className="text-sm text-gray-500">
                      {file.size > 0 ? `${(file.size / 1024).toFixed(1)} KB • ` : ''}
                      {new Date(file.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      file.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : file.status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {file.status}
                  </span>
                  <button
                    onClick={() => handleDelete(file.filename)}
                    disabled={deleteMutation.isPending}
                    className="text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl text-gray-300 mb-4">📂</div>
            <p className="text-gray-500">
              No files uploaded yet. Select a data type above and upload some files to get started.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              After uploading, your data will be available in the respective data sections.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}