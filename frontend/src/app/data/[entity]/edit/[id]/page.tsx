'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { dataService } from '../../../../../../services/data';
import { EntityType } from '../../../../../../types';

export default function EditEntityPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const entity = params.entity as EntityType;
  const id = params.id as string;

  const [formData, setFormData] = useState<any>({});

  // Fetch the entity data
  const { data: entityData, isLoading } = useQuery({
    queryKey: ['entity', entity, id],
    queryFn: () => dataService.getEntity(entity, id),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => dataService.updateEntity(entity, id, data),
    onSuccess: () => {
      toast.success(`${entity.slice(0, -1)} updated successfully`);
      queryClient.invalidateQueries({ queryKey: ['entities', entity] });
      queryClient.invalidateQueries({ queryKey: ['entity', entity, id] });
      router.push(`/data/${entity}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Update failed');
    },
  });

  // Initialize form data when entity data loads
  useEffect(() => {
    if (entityData) {
      const data = { ...entityData };
      
      // Handle special cases for different entity types
      if (entity === 'workers' && (data as any).skills && Array.isArray((data as any).skills)) {
        (data as any).skills = (data as any).skills.join(', ');
      }
      
      if (entity === 'tasks' && (data as any).deadline) {
        (data as any).deadline = new Date((data as any).deadline).toISOString().split('T')[0];
      }
      
      setFormData(data);
    }
  }, [entityData, entity]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = { ...formData };
    
    // Transform data based on entity type
    if (entity === 'workers' && submitData.skills && typeof submitData.skills === 'string') {
      submitData.skills = submitData.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    
    updateMutation.mutate(submitData);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="loading-skeleton h-8 w-64"></div>
        <div className="card">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="loading-skeleton h-12"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!entityData) {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl text-gray-400 mb-4">❌</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Entity Not Found</h3>
        <p className="text-gray-600 mb-4">
          The {entity.slice(0, -1)} you're looking for doesn't exist.
        </p>
        <Link href={`/data/${entity}`} className="btn-primary">
          Back to {entity}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-4">
          <li>
            <Link href="/" className="text-gray-400 hover:text-gray-500">
              Dashboard
            </Link>
          </li>
          <li>
            <span className="text-gray-400">/</span>
          </li>
          <li>
            <Link href={`/data/${entity}`} className="text-gray-400 hover:text-gray-500 capitalize">
              {entity}
            </Link>
          </li>
          <li>
            <span className="text-gray-400">/</span>
          </li>
          <li>
            <span className="text-gray-900">Edit</span>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 capitalize">
            Edit {entity.slice(0, -1)}
          </h1>
          <p className="text-gray-600 mt-1">
            Update the {entity.slice(0, -1)} information
          </p>
        </div>
        <Link href={`/data/${entity}`} className="btn-secondary">
          Back to List
        </Link>
      </div>

      {/* Form */}
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Common Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name{entity === 'tasks' ? ' (Title)' : ''}
            </label>
            <input
              value={formData.name || formData.title || ''}
              onChange={(e) => handleInputChange(entity === 'tasks' ? 'title' : 'name', e.target.value)}
              className="input-field"
              placeholder={`${entity.slice(0, -1)} ${entity === 'tasks' ? 'title' : 'name'}`}
              required
            />
          </div>

          {/* Email field for clients and workers */}
          {(entity === 'clients' || entity === 'workers') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="input-field"
                placeholder="email@example.com"
                required
              />
            </div>
          )}

          {/* Description for tasks */}
          {entity === 'tasks' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="input-field"
                rows={3}
                placeholder="Task description"
                required
              />
            </div>
          )}

          {/* Priority field for clients and tasks */}
          {(entity === 'clients' || entity === 'tasks') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority (1-10)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.priority || 5}
                onChange={(e) => handleInputChange('priority', parseInt(e.target.value))}
                className="input-field"
                required
              />
            </div>
          )}

          {/* Budget for clients */}
          {entity === 'clients' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Budget
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.budget || 0}
                onChange={(e) => handleInputChange('budget', parseFloat(e.target.value))}
                className="input-field"
                placeholder="0.00"
                required
              />
            </div>
          )}

          {/* Worker specific fields */}
          {entity === 'workers' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Skills (comma-separated)
                </label>
                <input
                  value={formData.skills || ''}
                  onChange={(e) => handleInputChange('skills', e.target.value)}
                  className="input-field"
                  placeholder="JavaScript, React, Node.js"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hourly Rate
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.hourlyRate || 0}
                  onChange={(e) => handleInputChange('hourlyRate', parseFloat(e.target.value))}
                  className="input-field"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Availability
                </label>
                <select
                  value={formData.availability || 'available'}
                  onChange={(e) => handleInputChange('availability', e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>
            </>
          )}

          {/* Task specific fields */}
          {entity === 'tasks' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID
                  </label>
                  <input
                    value={formData.clientId || ''}
                    onChange={(e) => handleInputChange('clientId', e.target.value)}
                    className="input-field"
                    placeholder="Client ID"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Worker ID (Optional)
                  </label>
                  <input
                    value={formData.workerId || ''}
                    onChange={(e) => handleInputChange('workerId', e.target.value)}
                    className="input-field"
                    placeholder="Worker ID"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.estimatedHours || 0}
                    onChange={(e) => handleInputChange('estimatedHours', parseFloat(e.target.value))}
                    className="input-field"
                    placeholder="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status || 'pending'}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deadline
                </label>
                <input
                  type="date"
                  value={formData.deadline || ''}
                  onChange={(e) => handleInputChange('deadline', e.target.value)}
                  className="input-field"
                  required
                />
              </div>
            </>
          )}

          {/* Form Actions */}
          <div className="flex gap-4 pt-6 border-t">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-primary"
            >
              {updateMutation.isPending ? 'Updating...' : 'Update'}
            </button>
            <Link href={`/data/${entity}`} className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
} 