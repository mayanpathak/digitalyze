'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { dataService } from '../../../../services/data';
import { rulesService } from '../../../../services/rules';
import { RulePriorities } from '../../../../types';

export default function ExportPage() {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'xlsx'>('csv');
  const [selectedEntities, setSelectedEntities] = useState<string[]>(['clients', 'workers', 'tasks']);
  const [includeRules, setIncludeRules] = useState(true);
  const [downloadType, setDownloadType] = useState<'zip' | 'individual'>('individual');
  const [priorities, setPriorities] = useState<RulePriorities>({
    priorityLevelWeight: 0.4,
    fairnessWeight: 0.3,
    costWeight: 0.3,
  });

  const { data: currentPriorities } = useQuery({
    queryKey: ['rule-priorities'],
    queryFn: rulesService.getPriorities,
  });

  useEffect(() => {
    if (currentPriorities) {
      setPriorities(currentPriorities);
    }
  }, [currentPriorities]);

  const updatePrioritiesMutation = useMutation({
    mutationFn: rulesService.updatePriorities,
    onSuccess: () => {
      toast.success('Priorities updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update priorities');
    },
  });

  const exportMutation = useMutation({
    mutationFn: dataService.exportData,
    onSuccess: (blob) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `data-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Export completed successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Export failed');
    },
  });

  const exportSingleMutation = useMutation({
    mutationFn: dataService.exportSingleEntity,
    onSuccess: (blob, entityType) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${entityType}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`${entityType} exported successfully`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Export failed');
    },
  });

  const handlePriorityChange = (key: keyof RulePriorities, value: number) => {
    const newPriorities = { ...priorities, [key]: value };
    setPriorities(newPriorities);
  };

  const totalWeight = priorities && typeof priorities === 'object' 
    ? Object.values(priorities).reduce((sum, weight) => sum + (typeof weight === 'number' ? weight : 0), 0)
    : 0;
  const isValidWeights = Math.abs(totalWeight - 1.0) <= 0.01;

  const handleUpdatePriorities = () => {
    updatePrioritiesMutation.mutate(priorities);
  };

  const handleExport = () => {
    const exportConfig = {
      format: selectedFormat,
      entities: selectedEntities,
      includeRules,
      priorities,
      downloadType,
    };

    exportMutation.mutate(exportConfig);
  };

  const handleSingleExport = (entity: string) => {
    exportSingleMutation.mutate(entity as any);
  };

  const handleExportAll = () => {
    if (downloadType === 'individual') {
      // Download each entity individually
      selectedEntities.forEach(entity => {
        setTimeout(() => handleSingleExport(entity), 100); // Small delay to prevent browser blocking
      });
    } else {
      // Download as ZIP
      handleExport();
    }
  };

  const handleEntityToggle = (entity: string) => {
    setSelectedEntities(prev => 
      prev.includes(entity) 
        ? prev.filter(e => e !== entity)
        : [...prev, entity]
    );
  };

  const entities = [
    { key: 'clients', label: 'Clients', description: 'Client information and budgets' },
    { key: 'workers', label: 'Workers', description: 'Worker profiles and skills' },
    { key: 'tasks', label: 'Tasks', description: 'Task assignments and status' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Export Data</h1>
        <p className="text-gray-600 mt-2">
          Configure rule priorities and export your processed data
        </p>
      </div>

      {/* Rule Priorities */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Rule Priorities</h3>
        <p className="text-gray-600 mb-6">
          Adjust the importance of different factors in the allocation algorithm
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {priorities && typeof priorities === 'object' && !Array.isArray(priorities) && Object.keys(priorities).length > 0 ? 
            Object.entries(priorities).filter(([key, value]) => value !== undefined && value !== null).map(([key, value]) => {
              // Convert camelCase to readable format
              const displayName = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())
                .replace('Weight', '');
              
              // Ensure value is safely handled
              const numericValue = typeof value === 'number' ? value : 0;
              const displayValue = typeof value === 'number' 
                ? value.toFixed(2) 
                : typeof value === 'string' 
                  ? value 
                  : '0.00';
              
              return (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-700">
                      {displayName}
                    </label>
                    <span className="text-sm text-gray-500">{displayValue}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={numericValue}
                    onChange={(e) => handlePriorityChange(key as keyof RulePriorities, parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>0.0</span>
                    <span>1.0</span>
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-3 text-center text-gray-500 py-4">
                Loading priorities...
              </div>
            )
          }
        </div>

        <div className="mt-6">
          {!isValidWeights && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                ⚠️ Priority weights should sum to 1.0 (currently: {totalWeight.toFixed(2)})
              </p>
            </div>
          )}
          <button
            onClick={handleUpdatePriorities}
            disabled={updatePrioritiesMutation.isPending || !isValidWeights}
            className="btn-primary"
          >
            {updatePrioritiesMutation.isPending ? 'Updating...' : 'Update Priorities'}
          </button>
        </div>
      </div>

      {/* Export Configuration */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Export Configuration</h3>
        
        {/* Format Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Export Format
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="csv"
                checked={selectedFormat === 'csv'}
                onChange={(e) => setSelectedFormat(e.target.value as 'csv')}
                className="mr-2"
              />
              CSV Files
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="xlsx"
                checked={selectedFormat === 'xlsx'}
                onChange={(e) => setSelectedFormat(e.target.value as 'xlsx')}
                className="mr-2"
              />
              Excel Files
            </label>
          </div>
        </div>

        {/* Download Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Download Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="individual"
                checked={downloadType === 'individual'}
                onChange={(e) => setDownloadType(e.target.value as 'individual')}
                className="mr-2"
              />
              Individual Files (easier to work with)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="zip"
                checked={downloadType === 'zip'}
                onChange={(e) => setDownloadType(e.target.value as 'zip')}
                className="mr-2"
              />
              ZIP Archive (single download)
            </label>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {downloadType === 'individual' 
              ? 'Each selected entity will download as a separate CSV file'
              : 'All selected entities will be packaged into a single ZIP file'
            }
          </p>
        </div>

        {/* Entity Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Data to Export
          </label>
          <div className="space-y-3">
            {entities.map((entity) => (
              <div key={entity.key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <label className="flex items-start flex-1">
                  <input
                    type="checkbox"
                    checked={selectedEntities.includes(entity.key)}
                    onChange={() => handleEntityToggle(entity.key)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium">{entity.label}</div>
                    <div className="text-sm text-gray-500">{entity.description}</div>
                  </div>
                </label>
                <button
                  onClick={() => handleSingleExport(entity.key)}
                  disabled={exportSingleMutation.isPending}
                  className="btn btn-sm btn-outline ml-4"
                  title={`Download ${entity.label} CSV`}
                >
                  📥 Download CSV
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Include Rules */}
        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeRules}
              onChange={(e) => setIncludeRules(e.target.checked)}
              className="mr-2"
            />
            Include allocation rules and priorities
          </label>
        </div>

        {/* Export Button */}
        <div className="pt-4 border-t">
          <button
            onClick={handleExportAll}
            disabled={(exportMutation.isPending || exportSingleMutation.isPending) || selectedEntities.length === 0}
            className="btn-primary"
          >
            {(exportMutation.isPending || exportSingleMutation.isPending) 
              ? 'Exporting...' 
              : downloadType === 'individual' 
                ? 'Download Individual Files' 
                : 'Download ZIP Archive'
            }
          </button>
          
          {selectedEntities.length === 0 && (
            <p className="text-red-600 text-sm mt-2">
              Please select at least one entity to export
            </p>
          )}
          
          {downloadType === 'individual' && selectedEntities.length > 1 && (
            <p className="text-blue-600 text-sm mt-2">
              💡 Tip: You can also download individual files using the "Download CSV" buttons above
            </p>
          )}
        </div>
      </div>

      {/* Export Preview */}
      <div className="card bg-gray-50">
        <h3 className="text-lg font-semibold mb-4">Export Preview</h3>
        <div className="space-y-2 text-sm">
          <div><strong>Format:</strong> {selectedFormat.toUpperCase()}</div>
          <div><strong>Download Type:</strong> {downloadType === 'individual' ? 'Individual CSV Files' : 'ZIP Archive'}</div>
          <div><strong>Entities:</strong> {selectedEntities.join(', ')}</div>
          <div><strong>Include Rules:</strong> {includeRules ? 'Yes' : 'No'}</div>
          <div><strong>Files:</strong> {
            downloadType === 'individual' 
              ? selectedEntities.map(e => `${e}-${new Date().toISOString().split('T')[0]}.csv`).join(', ')
              : `data-export-${new Date().toISOString().split('T')[0]}.zip`
          }</div>
        </div>
      </div>

      {/* Loading State */}
      {exportMutation.isPending && (
        <div className="card">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Preparing export...</span>
          </div>
        </div>
      )}
    </div>
  );
} 