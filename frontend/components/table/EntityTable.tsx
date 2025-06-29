'use client';

import { useState } from 'react';
import { EntityType, EntityData, TableColumn } from '../../types';

interface EntityTableProps {
  entity: EntityType;
  data: EntityData[];
  columns: TableColumn[];
  loading: boolean;
  onEdit: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
}

export default function EntityTable({
  entity,
  data,
  columns,
  loading, 
  onEdit,
  onDelete 
}: EntityTableProps) {
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<any>('');

  const handleEdit = (id: string, field: string, currentValue: any) => {
    setEditingCell({ id, field });
    setEditValue(currentValue);
  };

  const handleSave = () => {
    if (editingCell) {
      onEdit(editingCell.id, editingCell.field, editValue);
    setEditingCell(null);
    setEditValue('');
    }
  };

  const handleCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const formatValue = (value: any, column: TableColumn) => {
    if (value === null || value === undefined) return '-';
    
    switch (column.type) {
      case 'date':
      return new Date(value).toLocaleDateString();
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : value;
      case 'email':
        return value;
      default:
    if (Array.isArray(value)) {
      return value.join(', ');
    }
        return String(value);
    }
  };

  const getRowId = (row: any, index: number): string => {
    // First try to use a unique ID field
    if (row.id) return String(row.id);
    
    // Create a truly unique key using entity type + entity ID + index
    const entityId = row.ClientID || row.WorkerID || row.TaskID;
    if (entityId) {
      return `${entity}-${entityId}-${index}`;
    }
    
    // Fallback to index-based ID with entity prefix
    return `${entity}-row-${index}`;
  };

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="loading-skeleton h-12"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <div className="text-4xl text-gray-300 mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No {entity} found</h3>
          <p className="text-gray-500">
            Upload some {entity} data to get started, or check your filters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column, colIndex) => (
              <th
                key={`header-${column.key}-${colIndex}`}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {column.label}
              </th>
            ))}
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, index) => {
              const rowId = getRowId(row, index);
              return (
                <tr key={rowId} className="hover:bg-gray-50">
                  {columns.map((column, colIndex) => {
                    const fieldKey = (column as any).originalKey || column.key;
                    const isEditing = editingCell?.id === rowId && editingCell?.field === fieldKey;
                    const cellValue = getNestedValue(row, fieldKey);

                    return (
                      <td key={`${rowId}-${column.key}-${colIndex}`} className="px-6 py-4 whitespace-nowrap text-sm">
                        {isEditing ? (
                          <div className="flex items-center space-x-2">
                            {column.type === 'select' && column.options ? (
                              <select
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="input-field text-sm"
                                autoFocus
                              >
                                {column.options.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : column.type === 'number' ? (
                              <input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(Number(e.target.value))}
                                className="input-field text-sm"
                                autoFocus
                              />
                            ) : column.type === 'date' ? (
                <input
                                type="date"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="input-field text-sm"
                                autoFocus
                              />
                            ) : (
                      <input
                                type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="input-field text-sm"
                        autoFocus
                      />
                            )}
                      <button
                              onClick={handleSave}
                        className="text-green-600 hover:text-green-800"
                              title="Save"
                      >
                        ✓
                      </button>
                      <button
                              onClick={handleCancel}
                        className="text-red-600 hover:text-red-800"
                              title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                          <div className="flex items-center justify-between group">
                            <span className="text-gray-900">
                              {formatValue(cellValue, column)}
                            </span>
                            {column.editable && (
                              <button
                                onClick={() => handleEdit(rowId, fieldKey, cellValue)}
                                className="opacity-0 group-hover:opacity-100 ml-2 text-blue-600 hover:text-blue-800 transition-opacity"
                                title="Edit"
                              >
                                ✏️
                              </button>
                            )}
                    </div>
                  )}
                </td>
                    );
                  })}
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                      onClick={() => onDelete(rowId)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                >
                      🗑️
                </button>
              </td>
            </tr>
              );
            })}
        </tbody>
      </table>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        Showing {data.length} {entity}
        </div>
    </div>
  );
}