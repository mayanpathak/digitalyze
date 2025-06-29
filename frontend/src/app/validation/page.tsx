'use client';

import { useState, useEffect } from 'react';
import { validationService } from '../../../services/api';

interface ValidationError {
  id: string;
  type: string;
  severity: 'error' | 'warning' | 'info';
  entity: string;
  field?: string;
  recordId?: string;
  row?: number;
  message: string;
  suggestedFix: string;
  affectedRecords?: string[];
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    totalErrors: number;
    totalWarnings: number;
    validationTypes: string[];
    timestamp: string;
    breakdown: {
      structural: number;
      referential: number;
      business: number;
      operational: number;
    };
  };
  metadata?: {
    totalRecords: number;
    entitiesValidated: string[];
    rulesApplied: number;
    validatedAt: string;
    fromCache: boolean;
  };
}

interface ValidationSummary {
  isValid: boolean;
  totalRecords: number;
  totalErrors: number;
  totalWarnings: number;
  entityBreakdown: {
    [key: string]: {
      records: number;
      errors: number;
      warnings: number;
    };
  };
  lastValidated: string;
}

export default function ValidationPage() {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'summary' | 'detailed' | 'errors' | 'warnings'>('summary');
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const loadValidationSummary = async () => {
    setSummaryLoading(true);
    try {
      const summary = await validationService.getValidationSummary();
      setValidationSummary(summary);
    } catch (error) {
      console.error('Failed to load validation summary:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const runEnhancedValidation = async () => {
    setLoading(true);
    try {
      const result = await validationService.runEnhancedValidation({ cacheResults: true });
      setValidationResult(result);
      // Refresh summary after validation
      await loadValidationSummary();
    } catch (error) {
      console.error('Enhanced validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleErrorExpansion = (errorId: string) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(errorId)) {
      newExpanded.delete(errorId);
    } else {
      newExpanded.add(errorId);
    }
    setExpandedErrors(newExpanded);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📋';
    }
  };

  const getValidationTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'missing_required_column': 'Missing Required Column',
      'duplicate_id': 'Duplicate ID',
      'malformed_data': 'Malformed Data',
      'out_of_range': 'Out of Range',
      'unknown_reference': 'Unknown Reference',
      'skill_coverage_gap': 'Skill Coverage Gap',
      'worker_overload': 'Worker Overload',
      'phase_slot_saturation': 'Phase Slot Saturation',
      'max_concurrency_infeasible': 'Max Concurrency Infeasible',
      'circular_corun': 'Circular Co-run Dependency'
    };
    return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  useEffect(() => {
    loadValidationSummary();
  }, []);

  const StatusBadge = ({ status, label }: { status: boolean; label: string }) => (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${status ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Data Validation</h1>
          <p className="text-gray-600 mt-2">Comprehensive data quality analysis and validation</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={loadValidationSummary}
            disabled={summaryLoading}
            className="btn btn-secondary"
          >
            {summaryLoading ? '🔄 Loading...' : '🔄 Refresh Summary'}
          </button>
          <button
            onClick={runEnhancedValidation}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? '⚡ Validating...' : '⚡ Run Full Validation'}
          </button>
        </div>
      </div>

      {/* Validation Summary Card */}
      {validationSummary && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">📊 Validation Overview</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{validationSummary.totalRecords}</div>
                <div className="text-sm text-blue-800">Total Records</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{validationSummary.totalErrors}</div>
                <div className="text-sm text-red-800">Errors Found</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{validationSummary.totalWarnings}</div>
                <div className="text-sm text-yellow-800">Warnings Found</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <StatusBadge status={validationSummary.isValid} label={validationSummary.isValid ? 'Valid' : 'Issues Found'} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(validationSummary.entityBreakdown).map(([entity, data]) => (
                <div key={entity} className="p-4 border rounded-lg">
                  <h4 className="font-medium capitalize mb-2">{entity}</h4>
                  <div className="space-y-1 text-sm">
                    <div>Records: {data.records}</div>
                    <div className="text-red-600">Errors: {data.errors}</div>
                    <div className="text-yellow-600">Warnings: {data.warnings}</div>
                  </div>
                </div>
              ))}
            </div>

            {validationSummary.lastValidated && (
              <div className="mt-4 text-xs text-gray-500">
                Last validated: {new Date(validationSummary.lastValidated).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Validation Results */}
      {validationResult && (
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">🔍 Detailed Validation Results</h2>
              {validationResult.metadata?.fromCache && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  📋 Cached Result
                </span>
              )}
            </div>
          </div>
          <div className="card-body">
            {/* Tab Navigation */}
            <div className="flex space-x-1 mb-6 border-b">
              {[
                { key: 'summary', label: 'Summary', count: null },
                { key: 'errors', label: 'Errors', count: validationResult.errors.length },
                { key: 'warnings', label: 'Warnings', count: validationResult.warnings.length },
                { key: 'detailed', label: 'Breakdown', count: null }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedTab(tab.key as any)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 ${
                    selectedTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && (
                    <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {selectedTab === 'summary' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-lg font-bold">{validationResult.summary.totalErrors}</div>
                    <div className="text-sm text-gray-600">Total Errors</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-lg font-bold">{validationResult.summary.totalWarnings}</div>
                    <div className="text-sm text-gray-600">Total Warnings</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-lg font-bold">{validationResult.metadata?.totalRecords || 0}</div>
                    <div className="text-sm text-gray-600">Records Validated</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-lg font-bold">{validationResult.metadata?.rulesApplied || 0}</div>
                    <div className="text-sm text-gray-600">Rules Applied</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 border rounded">
                    <div className="text-lg font-bold text-blue-600">{validationResult.summary.breakdown.structural}</div>
                    <div className="text-sm text-gray-600">Structural Issues</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-lg font-bold text-green-600">{validationResult.summary.breakdown.referential}</div>
                    <div className="text-sm text-gray-600">Referential Issues</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-lg font-bold text-orange-600">{validationResult.summary.breakdown.business}</div>
                    <div className="text-sm text-gray-600">Business Logic Issues</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-lg font-bold text-purple-600">{validationResult.summary.breakdown.operational}</div>
                    <div className="text-sm text-gray-600">Operational Issues</div>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'errors' && (
              <div className="space-y-3">
                {validationResult.errors.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    ✅ No errors found! Your data looks good.
                  </div>
                ) : (
                  validationResult.errors.map((error, index) => (
                    <div
                      key={error.id || index}
                      className={`border rounded-lg p-4 ${getSeverityColor(error.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="text-lg">{getSeverityIcon(error.severity)}</div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="font-medium">{getValidationTypeLabel(error.type)}</span>
                              <span className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded">
                                {error.entity}
                              </span>
                              {error.field && (
                                <span className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded">
                                  {error.field}
                                </span>
                              )}
                            </div>
                            <p className="text-sm mb-2">{error.message}</p>
                            {error.recordId && (
                              <p className="text-xs opacity-75">Record ID: {error.recordId}</p>
                            )}
                            {error.row && (
                              <p className="text-xs opacity-75">Row: {error.row}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleErrorExpansion(error.id)}
                          className="text-sm hover:bg-white hover:bg-opacity-30 px-2 py-1 rounded"
                        >
                          {expandedErrors.has(error.id) ? '▼' : '▶'}
                        </button>
                      </div>
                      
                      {expandedErrors.has(error.id) && (
                        <div className="mt-3 pt-3 border-t border-white border-opacity-30">
                          <h5 className="text-sm font-medium mb-2">💡 Suggested Fix:</h5>
                          <p className="text-sm bg-white bg-opacity-30 p-3 rounded">
                            {error.suggestedFix}
                          </p>
                          {error.affectedRecords && error.affectedRecords.length > 0 && (
                            <div className="mt-2">
                              <h6 className="text-xs font-medium mb-1">Affected Records:</h6>
                              <div className="text-xs">
                                {error.affectedRecords.join(', ')}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {selectedTab === 'warnings' && (
              <div className="space-y-3">
                {validationResult.warnings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    ✅ No warnings found!
                  </div>
                ) : (
                  validationResult.warnings.map((warning, index) => (
                    <div
                      key={warning.id || index}
                      className={`border rounded-lg p-4 ${getSeverityColor(warning.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="text-lg">{getSeverityIcon(warning.severity)}</div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="font-medium">{getValidationTypeLabel(warning.type)}</span>
                              <span className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded">
                                {warning.entity}
                              </span>
                              {warning.field && (
                                <span className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded">
                                  {warning.field}
                                </span>
                              )}
                            </div>
                            <p className="text-sm mb-2">{warning.message}</p>
                            {warning.recordId && (
                              <p className="text-xs opacity-75">Record ID: {warning.recordId}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleErrorExpansion(warning.id)}
                          className="text-sm hover:bg-white hover:bg-opacity-30 px-2 py-1 rounded"
                        >
                          {expandedErrors.has(warning.id) ? '▼' : '▶'}
                        </button>
                      </div>
                      
                      {expandedErrors.has(warning.id) && (
                        <div className="mt-3 pt-3 border-t border-white border-opacity-30">
                          <h5 className="text-sm font-medium mb-2">💡 Suggested Fix:</h5>
                          <p className="text-sm bg-white bg-opacity-30 p-3 rounded">
                            {warning.suggestedFix}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {selectedTab === 'detailed' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Validation Categories</h4>
                    <div className="space-y-2">
                      {Object.entries(validationResult.summary.breakdown).map(([category, count]) => (
                        <div key={category} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span className="capitalize">{category}</span>
                          <span className={`font-medium ${count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {count} issues
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Validation Metadata</h4>
                    <div className="space-y-2 text-sm">
                      {validationResult.metadata && (
                        <>
                          <div>Entities: {validationResult.metadata.entitiesValidated.join(', ')}</div>
                          <div>Total Records: {validationResult.metadata.totalRecords}</div>
                          <div>Rules Applied: {validationResult.metadata.rulesApplied}</div>
                          <div>Validated At: {new Date(validationResult.metadata.validatedAt).toLocaleString()}</div>
                          <div>From Cache: {validationResult.metadata.fromCache ? 'Yes' : 'No'}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">❓ About Enhanced Validation</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Validation Types</h4>
              <ul className="space-y-2 text-sm">
                <li><strong>Structural:</strong> Data format and integrity checks</li>
                <li><strong>Referential:</strong> Cross-entity relationship validation</li>
                <li><strong>Business Logic:</strong> Domain-specific rule validation</li>
                <li><strong>Operational:</strong> Resource allocation feasibility</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Key Features</h4>
              <ul className="space-y-2 text-sm">
                <li>✅ Real-time validation feedback</li>
                <li>🔍 Detailed error analysis</li>
                <li>💡 Automated fix suggestions</li>
                <li>📊 Comprehensive reporting</li>
                <li>⚡ Performance optimized with caching</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 