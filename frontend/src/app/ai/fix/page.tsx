'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { aiService } from '../../../../services/ai';
import { dataService } from '../../../../services/data';
import { EntityType } from '../../../../types';

interface ValidationError {
  id: string;
  field: string;
  value: any;
  error: string;
  suggested_fix?: any;
  originalValidationId?: string;
}

interface AIFix {
  rowId: string;
  field: string;
  currentValue: any;
  suggestedValue: any;
  reason: string;
  confidence: number;
  originalValidationId?: string;
}

export default function AIFixPage() {
  const queryClient = useQueryClient();
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('clients');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [fixedItems, setFixedItems] = useState<Set<string>>(new Set());
  const [isGeneratingFixes, setIsGeneratingFixes] = useState(false);
  const [validationToFixIdMap, setValidationToFixIdMap] = useState<Map<string, string>>(new Map());

  const { data: validationErrors, isLoading } = useQuery({
    queryKey: ['validation-errors', selectedEntity],
    queryFn: () => dataService.getValidationErrors(selectedEntity),
    staleTime: 30000, // Cache for 30 seconds to prevent excessive refetching
    refetchOnWindowFocus: false, // Prevent refetch on window focus
  });

  // Reset errors and fixed items when entity changes
  useEffect(() => {
    setErrors([]);
    setFixedItems(new Set());
    setIsGeneratingFixes(false); // Stop any ongoing generation
    setValidationToFixIdMap(new Map()); // Reset ID mapping
  }, [selectedEntity]);

  const fixErrorsMutation = useMutation({
    mutationFn: ({ entity, errors }: { entity: EntityType; errors: ValidationError[] }) =>
      aiService.fixErrors(entity, errors),
    onMutate: () => {
      setIsGeneratingFixes(true);
    },
    onSuccess: (data, variables) => {
      // Create mapping from original validation error IDs to AI fix IDs
      const newMapping = new Map<string, string>();
      
      // Transform AI fixes to match ValidationError format
      const transformedFixes = (data.fixes || []).map((fix: AIFix) => {
        // Try to find the original validation error that corresponds to this fix
        let matchingOriginalError = null;
        
        // First, try to match using the originalValidationId provided by backend
        if (fix.originalValidationId) {
          matchingOriginalError = variables.errors.find(originalError => 
            originalError.id === fix.originalValidationId
          );
        }
        
        // Fallback: match by field name and other patterns
        if (!matchingOriginalError) {
          matchingOriginalError = variables.errors.find(originalError => {
            // Match by field name first
            if (originalError.field === fix.field) {
              return true;
            }
            // Additional pattern matching if needed
            return false;
          });
        }
        
        if (matchingOriginalError) {
          newMapping.set(matchingOriginalError.id, fix.rowId);
          console.log(`[AI Fix] Mapped validation error ${matchingOriginalError.id} -> record ${fix.rowId}`);
        }
        
        return {
          id: fix.rowId,
          field: fix.field,
          value: fix.currentValue,
          error: fix.reason || 'AI detected issue',
          suggested_fix: fix.suggestedValue,
          originalValidationId: matchingOriginalError?.id // Keep reference for debugging
        };
      });
      
      setValidationToFixIdMap(newMapping);
      setErrors(transformedFixes);
      setIsGeneratingFixes(false);
      
      console.log(`[AI Fix] Created ID mapping:`, Object.fromEntries(newMapping));
      toast.success(`AI fixes generated successfully (${transformedFixes.length} suggestions)`);
    },
    onError: (error: any) => {
      setIsGeneratingFixes(false);
      toast.error(error.response?.data?.message || 'Failed to generate fixes');
    },
  });

  const applyFixMutation = useMutation({
    mutationFn: ({ entity, id, data }: { entity: EntityType; id: string; data: any }) =>
      dataService.updateEntity(entity, id, data),
    onSuccess: (_, variables) => {
      // Mark both the actual ID and any original validation error ID as fixed
      setFixedItems((prev: Set<string>) => {
        const newSet = new Set(prev);
        newSet.add(variables.id); // Add the actual ID used for the update
        
        // Also add the original validation error ID if this was a mapped fix
        for (const [originalId, mappedId] of validationToFixIdMap.entries()) {
          if (mappedId === variables.id) {
            newSet.add(originalId);
          }
        }
        
        return newSet;
      });
      
      toast.success('Fix applied successfully');
      
      // Only invalidate entity data, not validation errors to prevent loops
      queryClient.invalidateQueries({ queryKey: ['entities', selectedEntity] });
      queryClient.invalidateQueries({ queryKey: ['entity-stats', selectedEntity] });
      
      // Remove the fixed error from the errors list instead of refetching
      setErrors(prevErrors => prevErrors.filter(error => error.id !== variables.id));
    },
    onError: (error: any, variables) => {
      console.error(`[AI Fix] Failed to apply fix:`, {
        error: error.response?.data || error.message,
        variables,
        status: error.response?.status
      });
      
      const errorMessage = error.response?.status === 404 
        ? `Record not found: ${variables.id}. This might be an ID mapping issue.`
        : error.response?.data?.message || 'Failed to apply fix';
        
      toast.error(errorMessage);
    },
  });

  const handleGenerateFixes = () => {
    if (!validationErrors || validationErrors.length === 0) {
      toast.error('No validation errors found');
      return;
    }
    
    if (isGeneratingFixes) {
      toast.error('Already generating fixes, please wait...');
      return;
    }
    
    // Limit the number of errors to process to prevent overwhelming the AI service
    const maxErrors = 20;
    const errorsToProcess = validationErrors.slice(0, maxErrors);
    
    if (validationErrors.length > maxErrors) {
      toast(`Processing first ${maxErrors} errors out of ${validationErrors.length} total`, {
        icon: 'ℹ️',
      });
    }
    
    fixErrorsMutation.mutate({ entity: selectedEntity, errors: errorsToProcess });
  };

  const handleApplyFix = (error: ValidationError) => {
    if (!error.suggested_fix) {
      toast.error('No suggested fix available');
      return;
    }
    
    // Check if this is an original validation error that needs ID mapping
    const actualId = validationToFixIdMap.get(error.id) || error.id;
    
    console.log(`[AI Fix] Applying fix:`, {
      originalErrorId: error.id,
      actualRecordId: actualId,
      field: error.field,
      suggestedFix: error.suggested_fix,
      entity: selectedEntity
    });
    
    // Validate that we have a proper ID
    if (!actualId || actualId === error.id && error.id.match(/^(clients|workers|tasks)-\d+$/)) {
      console.warn(`[AI Fix] Warning: Using validation error ID ${actualId} - this might cause 404`);
      toast.error(`Cannot apply fix: Invalid record ID ${actualId}`);
      return;
    }
    
    const updateData = { [error.field]: error.suggested_fix };
    applyFixMutation.mutate({
      entity: selectedEntity,
      id: actualId, // Use the mapped ID (actual entity ID) instead of validation error ID
      data: updateData,
    });
  };

  const entities = [
    { value: 'clients' as EntityType, label: 'Clients' },
    { value: 'workers' as EntityType, label: 'Workers' },
    { value: 'tasks' as EntityType, label: 'Tasks' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Error Fixer</h1>
        <p className="text-gray-600 mt-2">
          Use AI to automatically fix data validation errors
        </p>
      </div>

      {/* Entity Selection */}
      <div className="card">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            Select Entity:
          </label>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value as EntityType)}
            className="input-field w-auto"
          >
            {entities.map((entity) => (
              <option key={entity.value} value={entity.value}>
                {entity.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerateFixes}
            disabled={isGeneratingFixes || !validationErrors?.length}
            className="btn-primary"
          >
            {isGeneratingFixes ? 'Generating Fixes...' : 'Generate AI Fixes'}
          </button>
        </div>
      </div>

      {/* Validation Errors */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Validation Errors</h3>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="loading-skeleton h-16"></div>
            ))}
          </div>
        ) : validationErrors && validationErrors.length > 0 ? (
          <div className="space-y-4">
            {validationErrors.map((error) => (
              <div
                key={`${error.id}-${error.field}`}
                className={`border rounded-lg p-4 ${
                  fixedItems.has(error.id) ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">Record ID: {error.id}</span>
                      <span className="text-sm text-gray-500">Field: {error.field}</span>
                      {fixedItems.has(error.id) && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          Fixed
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-red-700">Current Value:</span>
                        <p className="text-red-600 mt-1 font-mono">
                          {typeof error.value === 'object' ? JSON.stringify(error.value) : String(error.value)}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-red-700">Error:</span>
                        <p className="text-red-600 mt-1">
                          {typeof error.error === 'object' ? JSON.stringify(error.error) : String(error.error)}
                        </p>
                      </div>
                      {error.suggested_fix && (
                        <div>
                          <span className="font-medium text-green-700">Suggested Fix:</span>
                          <p className="text-green-600 mt-1 font-mono">
                            {typeof error.suggested_fix === 'object' 
                              ? JSON.stringify(error.suggested_fix) 
                              : String(error.suggested_fix)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {error.suggested_fix && !fixedItems.has(error.id) && (
                    <button
                      onClick={() => handleApplyFix(error)}
                      disabled={applyFixMutation.isPending}
                      className="btn-primary ml-4"
                    >
                      Apply Fix
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl text-gray-400 mb-4">✅</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Validation Errors</h3>
            <p className="text-gray-600">
              All {selectedEntity} data appears to be valid.
            </p>
          </div>
        )}
      </div>

      {/* AI Generated Fixes */}
      {errors.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">AI Generated Fixes</h3>
          <div className="space-y-4">
            {errors.map((fix, index) => (
              <div key={index} className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-blue-700">Issue:</span>
                        <p className="text-blue-600 mt-1">
                          {typeof fix.error === 'object' ? JSON.stringify(fix.error) : String(fix.error)}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">AI Suggestion:</span>
                        <p className="text-blue-600 mt-1 font-mono">
                          {typeof fix.suggested_fix === 'object' 
                            ? JSON.stringify(fix.suggested_fix) 
                            : String(fix.suggested_fix)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleApplyFix(fix)}
                    disabled={applyFixMutation.isPending}
                    className="btn-primary ml-4"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading States */}
      {isGeneratingFixes && (
        <div className="card">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">AI is analyzing errors...</span>
          </div>
        </div>
      )}
    </div>
  );
} 