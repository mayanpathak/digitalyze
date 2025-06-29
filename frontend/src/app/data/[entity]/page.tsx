'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { dataService } from '../../../../services/data';
import { useDataStore } from '../../../../store/useDataStore';
import EntityTable from '../../../../components/table/EntityTable';
import { EntityType, TableColumn } from '../../../../types';

const entityConfigs = {
  clients: {
    columns: [
      { key: 'ClientName', label: 'Name', editable: true, type: 'text' },
      { key: 'ClientEmail', label: 'Email', editable: true, type: 'email' },
      { key: 'PriorityLevel', label: 'Priority', editable: true, type: 'number' },
      { key: 'Budget', label: 'Budget', editable: true, type: 'number' },
      { key: '_metadata.processedAt', label: 'Uploaded', type: 'date' },
    ] as TableColumn[],
  },
  workers: {
    columns: [
      { key: 'WorkerName', label: 'Name', editable: true, type: 'text' },
      { key: 'WorkerEmail', label: 'Email', editable: true, type: 'email' },
      { key: 'Skills', label: 'Skills', editable: true, type: 'text' },
      { key: 'HourlyRate', label: 'Hourly Rate', editable: true, type: 'number' },
      { key: 'Availability', label: 'Availability', editable: true, type: 'select', options: ['available', 'busy', 'unavailable'] },
      { key: '_metadata.processedAt', label: 'Uploaded', type: 'date' },
    ] as TableColumn[],
  },
  tasks: {
    columns: [
      { key: 'TaskTitle', label: 'Title', editable: true, type: 'text' },
      { key: 'TaskDescription', label: 'Description', editable: true, type: 'text' },
      { key: 'PriorityLevel', label: 'Priority', editable: true, type: 'number' },
      { key: 'EstimatedHours', label: 'Est. Hours', editable: true, type: 'number' },
      { key: 'Status', label: 'Status', editable: true, type: 'select', options: ['pending', 'in_progress', 'completed', 'cancelled'] },
      { key: 'Deadline', label: 'Deadline', editable: true, type: 'date' },
      { key: '_metadata.processedAt', label: 'Uploaded', type: 'date' },
    ] as TableColumn[],
  },
};

export default function EntityPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  
  const entity = params.entity as EntityType;
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  
  const { pagination, setPagination } = useDataStore();

  const { data: entityData, isLoading } = useQuery({
    queryKey: ['entities', entity, pagination.page, pagination.limit, searchQuery, statusFilter],
    queryFn: () => dataService.getEntities(entity, pagination.page, pagination.limit, {
      search: searchQuery || undefined,
      status: statusFilter || undefined,
    }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: string; value: any }) =>
      dataService.updateEntity(entity, id, { [field]: value }),
    onSuccess: () => {
      toast.success('Updated successfully');
      queryClient.invalidateQueries({ queryKey: ['entities', entity] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dataService.deleteEntity(entity, id),
    onSuccess: () => {
      toast.success('Deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['entities', entity] });
    },
  });

  const handleEdit = (id: string, field: string, value: any) => {
    updateMutation.mutate({ id, field, value });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination({ page: 1 });
  };

  const config = entityConfigs[entity];
  if (!config) {
    return <div>Invalid entity type</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 capitalize">{entity}</h1>
          <p className="text-gray-600 mt-1">
            Manage your {entity} data
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
            />
            <button type="submit" className="btn-primary">
              Search
            </button>
          </form>
          
          {entity === 'tasks' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          )}
        </div>
      </div>

      {/* Data Table */}
      <EntityTable
        entity={entity}
        data={entityData?.items || []}
        columns={config.columns}
        loading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Pagination */}
      {entityData && entityData.totalPages > 1 && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, entityData.total)} of{' '}
            {entityData.total} results
          </p>
          
          <div className="flex gap-2">
            <button
              onClick={() => setPagination({ page: pagination.page - 1 })}
              disabled={pagination.page === 1}
              className="btn-secondary"
            >
              Previous
            </button>
            
            <span className="px-4 py-2 text-sm">
              Page {pagination.page} of {entityData.totalPages}
            </span>
            
            <button
              onClick={() => setPagination({ page: pagination.page + 1 })}
              disabled={pagination.page === entityData.totalPages}
              className="btn-secondary"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}