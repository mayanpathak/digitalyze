'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { aiService } from '../../../../services/ai';
import { dataService } from '../../../../services/data';
import { AIInsight, EntityType } from '../../../../types';

export default function AIValidatePage() {
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('clients');
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [validationReport, setValidationReport] = useState<string>('');

  // Fetch real data for the selected entity
  const { data: entityData, isLoading: isLoadingData } = useQuery({
    queryKey: ['entities', selectedEntity, 1, 100], // Get first 100 items
    queryFn: () => dataService.getEntities(selectedEntity, 1, 100),
  });

  const validateMutation = useMutation({
    mutationFn: ({ entity, data }: { entity: EntityType; data: any[] }) =>
      aiService.validateExtended(entity, data),
    onSuccess: (data) => {
      setInsights(data);
      generateReport(data);
      toast.success('AI validation completed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Validation failed');
    },
  });

  const generateReport = (insights: AIInsight[]) => {
    const report = `# AI Validation Report

## Summary
- Total Issues Found: ${insights.length}
- Warnings: ${insights.filter(i => i.type === 'warning').length}
- Suggestions: ${insights.filter(i => i.type === 'suggestion').length}
- Information: ${insights.filter(i => i.type === 'info').length}

## Detailed Findings

${insights.map((insight, index) => `
### ${index + 1}. ${insight.title} (${insight.type.toUpperCase()})
${insight.description}

${insight.data ? `**Data:** \`${JSON.stringify(insight.data)}\`` : ''}
`).join('\n')}

---
Generated on: ${new Date().toLocaleString()}
`;
    setValidationReport(report);
  };

  const handleRunValidation = () => {
    if (!entityData || entityData.items.length === 0) {
      toast('No data available for validation. Please upload some data first.', { icon: 'ℹ️' });
      return;
    }

    validateMutation.mutate({ entity: selectedEntity, data: entityData.items });
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(validationReport);
    toast.success('Report copied to clipboard');
  };

  const handleExportReport = () => {
    const blob = new Blob([validationReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-validation-report-${selectedEntity}-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'suggestion': return '💡';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  };

  const getInsightColor = (type: AIInsight['type']) => {
    switch (type) {
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'suggestion': return 'border-blue-200 bg-blue-50';
      case 'info': return 'border-gray-200 bg-gray-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const entities = [
    { value: 'clients' as EntityType, label: 'Clients' },
    { value: 'workers' as EntityType, label: 'Workers' },
    { value: 'tasks' as EntityType, label: 'Tasks' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Validation</h1>
        <p className="text-gray-600 mt-2">
          Run comprehensive AI-powered validation on your data
        </p>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="flex items-center justify-between">
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
          </div>

          <div className="flex items-center gap-4">
            {isLoadingData && (
              <span className="text-sm text-gray-500">Loading data...</span>
            )}
            {entityData && (
              <span className="text-sm text-gray-600">
                {entityData.items.length} records available
              </span>
            )}
            <button
              onClick={handleRunValidation}
              disabled={validateMutation.isPending || isLoadingData || !entityData?.items.length}
              className="btn-primary"
            >
              {validateMutation.isPending ? 'Validating...' : 'Run AI Validation'}
            </button>
          </div>
        </div>
      </div>

      {/* Validation Results */}
      {insights.length > 0 && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Validation Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{insights.length}</div>
                <div className="text-sm text-gray-600">Total Issues</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {insights.filter(i => i.type === 'warning').length}
                </div>
                <div className="text-sm text-gray-600">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {insights.filter(i => i.type === 'suggestion').length}
                </div>
                <div className="text-sm text-gray-600">Suggestions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {insights.filter(i => i.type === 'info').length}
                </div>
                <div className="text-sm text-gray-600">Information</div>
              </div>
            </div>
          </div>

          {/* Insights */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Validation Insights</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyReport}
                  className="btn-secondary"
                >
                  Copy Report
                </button>
                <button
                  onClick={handleExportReport}
                  className="btn-secondary"
                >
                  Export Markdown
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${getInsightColor(insight.type)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{getInsightIcon(insight.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{insight.title}</h4>
                        <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                          insight.type === 'warning' 
                            ? 'bg-yellow-100 text-yellow-800'
                            : insight.type === 'suggestion'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {insight.type}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-2">{insight.description}</p>
                      {insight.data && (
                        <div className="mt-2">
                          <span className="text-sm font-medium text-gray-600">Related Data:</span>
                          <pre className="mt-1 p-2 bg-white rounded text-xs overflow-x-auto">
                            {JSON.stringify(insight.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Report Preview */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Report Preview</h3>
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                {validationReport}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {insights.length === 0 && !validateMutation.isPending && (
        <div className="card text-center py-12">
          <div className="text-4xl text-gray-400 mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Validation Results</h3>
          <p className="text-gray-600">
            Run AI validation to get detailed insights about your {selectedEntity} data.
          </p>
        </div>
      )}

      {/* Loading State */}
      {validateMutation.isPending && (
        <div className="card">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">AI is analyzing your data...</span>
          </div>
        </div>
      )}
    </div>
  );
} 