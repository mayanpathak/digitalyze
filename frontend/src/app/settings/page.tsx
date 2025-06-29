'use client';

import { useState, useEffect } from 'react';
import { systemService, validationService } from '../../../services/api';
import { rulesService } from '../../../services/rules';
import { uploadService } from '../../../services/upload';

interface HealthStatus {
  status: string;
  timestamp: string;
  message: string;
  services: {
    redis: {
      connected: boolean;
      available: boolean;
      keyCount: number;
      error: string | null;
    };
    dataStore: {
      status: string;
      message: string;
    };
  };
}

interface AIHealth {
  success: boolean;
  status?: {
    geminiAPI: string;
    timestamp: string;
    apiKey: string;
  };
  error?: string;
}

interface RulePriorities {
  priorityLevelWeight: number;
  fairnessWeight: number;
  costWeight: number;
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

export default function SettingsPage() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [aiHealth, setAIHealth] = useState<AIHealth | null>(null);
  const [uploadStatus, setUploadStatus] = useState<any>(null);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [priorities, setPriorities] = useState<RulePriorities>({
    priorityLevelWeight: 0.5,
    fairnessWeight: 0.3,
    costWeight: 0.2
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null);

  const loadSystemStatus = async () => {
    setLoading(true);
    try {
      // Test connection first
      const isConnected = await systemService.testConnection();
      setConnectionStatus(isConnected);

      if (isConnected) {
        // Load system health
        try {
          const health = await systemService.getHealth();
          setHealthStatus(health);
        } catch (error) {
          // Set a default error state for system health
          setHealthStatus({
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
          });
        }

        // Load AI health
        try {
          const aiHealthData = await systemService.getAIHealth();
          setAIHealth(aiHealthData);
        } catch (error) {
          // Set a default error state for AI health
          setAIHealth({
            success: false,
            error: 'AI service unavailable'
          });
        }

        // Load upload status
        try {
          const uploadData = await uploadService.getStatus();
          setUploadStatus(uploadData);
        } catch (error) {
          console.error('Failed to load upload status:', error);
        }

        // Load rule priorities
        try {
          const prioritiesData = await rulesService.getPriorities();
          setPriorities(prioritiesData);
        } catch (error) {
          console.error('Failed to load priorities:', error);
        }

        // Load validation summary
        try {
          const validationData = await validationService.getValidationSummary();
          setValidationSummary(validationData);
        } catch (error) {
          console.error('Failed to load validation summary:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load system status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityChange = (key: keyof RulePriorities, value: number) => {
    setPriorities(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const savePriorities = async () => {
    setUpdating(true);
    try {
      const updatedPriorities = await rulesService.updatePriorities(priorities);
      setPriorities(updatedPriorities);
      alert('Priorities updated successfully!');
    } catch (error) {
      console.error('Failed to update priorities:', error);
      alert('Failed to update priorities. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const refreshStatus = () => {
    loadSystemStatus();
  };

  useEffect(() => {
    loadSystemStatus();
  }, []);

  const StatusBadge = ({ status, label }: { status: boolean | string; label: string }) => (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${
        status === true || status === 'connected' || status === 'healthy' || status === 'OK' 
          ? 'bg-green-500' 
          : status === false || status === 'disconnected' || status === 'unhealthy'
          ? 'bg-red-500'
          : 'bg-yellow-500'
      }`} />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">System configuration and status</p>
        </div>
        <div className="card text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading system status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">System configuration and status</p>
        </div>
        <button
          onClick={refreshStatus}
          className="btn btn-secondary"
          disabled={loading}
        >
          🔄 Refresh Status
        </button>
      </div>

      {/* Connection Status */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">🌐 API Connection</h2>
        </div>
        <div className="card-body">
          <StatusBadge 
            status={connectionStatus === true} 
            label={connectionStatus === true ? 'Connected' : 'Disconnected'} 
          />
          <p className="text-sm text-gray-600 mt-2">
            API URL: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}
          </p>
        </div>
      </div>

      {/* System Health */}
      {healthStatus && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">🏥 System Health</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <StatusBadge status={healthStatus.status} label={`Server: ${healthStatus.status}`} />
                <p className="text-xs text-gray-500 mt-1">
                  Last check: {new Date(healthStatus.timestamp).toLocaleString()}
                </p>
              </div>
              
              <div>
                <StatusBadge 
                  status={healthStatus.services.redis.connected} 
                  label={`Redis: ${healthStatus.services.redis.connected ? 'Connected' : 'Disconnected'}`} 
                />
                {healthStatus.services.redis.connected && (
                  <p className="text-xs text-gray-500 mt-1">
                    Keys: {healthStatus.services.redis.keyCount}
                  </p>
                )}
                {healthStatus.services.redis.error && (
                  <p className="text-xs text-red-500 mt-1">
                    Error: {healthStatus.services.redis.error}
                  </p>
                )}
              </div>
            </div>

            <div>
              <StatusBadge 
                status={healthStatus.services.dataStore.status === 'active'} 
                label={`DataStore: ${healthStatus.services.dataStore.status}`} 
              />
              <p className="text-xs text-gray-500 mt-1">
                {healthStatus.services.dataStore.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Service Health */}
      {aiHealth && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">🤖 AI Service</h2>
          </div>
          <div className="card-body space-y-4">
            {aiHealth.success && aiHealth.status ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <StatusBadge 
                    status={aiHealth.status.geminiAPI === 'connected'} 
                    label={`Gemini API: ${aiHealth.status.geminiAPI}`} 
                  />
                </div>
                <div>
                  <StatusBadge 
                    status={aiHealth.status.apiKey === 'configured'} 
                    label={`API Key: ${aiHealth.status.apiKey}`} 
                  />
                </div>
              </div>
            ) : (
              <div className="text-red-600">
                <StatusBadge status={false} label="AI Service Unavailable" />
                {aiHealth.error && (
                  <p className="text-sm mt-2">Error: {aiHealth.error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation Status */}
      {validationSummary && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">✅ Data Validation Status</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">{validationSummary.totalRecords}</div>
                <div className="text-sm text-blue-800">Total Records</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <div className="text-xl font-bold text-red-600">{validationSummary.totalErrors}</div>
                <div className="text-sm text-red-800">Errors</div>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg text-center">
                <div className="text-xl font-bold text-yellow-600">{validationSummary.totalWarnings}</div>
                <div className="text-sm text-yellow-800">Warnings</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <StatusBadge 
                  status={validationSummary.isValid} 
                  label={validationSummary.isValid ? 'Valid' : 'Issues Found'} 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(validationSummary.entityBreakdown).map(([entity, data]) => (
                <div key={entity} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium capitalize">{entity}</h4>
                    <StatusBadge status={data.errors === 0} label={data.errors === 0 ? 'Valid' : 'Issues'} />
                  </div>
                  <div className="text-sm space-y-1">
                    <div>Records: {data.records}</div>
                    {data.errors > 0 && <div className="text-red-600">Errors: {data.errors}</div>}
                    {data.warnings > 0 && <div className="text-yellow-600">Warnings: {data.warnings}</div>}
                  </div>
                </div>
              ))}
            </div>

            {validationSummary.lastValidated && (
              <div className="text-xs text-gray-500">
                Last validated: {new Date(validationSummary.lastValidated).toLocaleString()}
              </div>
            )}

            <div className="pt-3 border-t">
              <a 
                href="/validation" 
                className="btn btn-primary text-sm"
              >
                🔍 View Detailed Validation Report
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Data Status */}
      {uploadStatus && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">📊 Data Status</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(uploadStatus.entities || {}).map(([entity, data]: [string, any]) => (
                <div key={entity} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium capitalize">{entity}</h4>
                    <StatusBadge status={data.hasData} label={data.hasData ? 'Loaded' : 'Empty'} />
                  </div>
                  <p className="text-sm text-gray-600">
                    Records: {data.recordCount || 0}
                  </p>
                  {data.fileName && (
                    <p className="text-xs text-gray-500 mt-1">
                      File: {data.fileName}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Summary</h4>
              <p className="text-sm text-blue-800">
                Total Records: {uploadStatus.summary?.totalRecords || 0}
              </p>
              <p className="text-sm text-blue-800">
                Entities with Data: {uploadStatus.summary?.entitiesWithData || 0}/3
              </p>
              {uploadStatus.summary?.lastUpdated && (
                <p className="text-xs text-blue-600 mt-1">
                  Last Updated: {new Date(uploadStatus.summary.lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rule Priorities Configuration */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">⚖️ Rule Priorities</h2>
          <p className="text-sm text-gray-600">Configure the weights for rule evaluation</p>
        </div>
        <div className="card-body space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority Level Weight: {priorities.priorityLevelWeight.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={priorities.priorityLevelWeight}
                onChange={(e) => handlePriorityChange('priorityLevelWeight', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fairness Weight: {priorities.fairnessWeight.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={priorities.fairnessWeight}
                onChange={(e) => handlePriorityChange('fairnessWeight', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cost Weight: {priorities.costWeight.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={priorities.costWeight}
                onChange={(e) => handlePriorityChange('costWeight', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-600">
              Total Weight: {(priorities.priorityLevelWeight + priorities.fairnessWeight + priorities.costWeight).toFixed(2)}
              {Math.abs((priorities.priorityLevelWeight + priorities.fairnessWeight + priorities.costWeight) - 1.0) > 0.01 && (
                <span className="text-red-500 ml-2">⚠️ Should equal 1.0</span>
              )}
            </div>
            <button
              onClick={savePriorities}
              disabled={updating || Math.abs((priorities.priorityLevelWeight + priorities.fairnessWeight + priorities.costWeight) - 1.0) > 0.01}
              className="btn btn-primary"
            >
              {updating ? 'Saving...' : 'Save Priorities'}
            </button>
          </div>
        </div>
      </div>

      {/* Environment Information */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">🔧 Environment</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Frontend Version:</strong> 1.0.0
            </div>
            <div>
              <strong>Backend Version:</strong> 1.0.0
            </div>
            <div>
              <strong>Environment:</strong> {process.env.NODE_ENV || 'development'}
            </div>
            <div>
              <strong>API URL:</strong> {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}
            </div>
          </div>
        </div>
      </div>

      {/* Available API Features */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">🚀 Available Features</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">📤 File Upload</h4>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• CSV/Excel file processing</li>
                <li>• Multi-entity upload</li>
                <li>• File validation</li>
                <li>• Status tracking</li>
              </ul>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">📊 Data Management</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• CRUD operations</li>
                <li>• Data validation</li>
                <li>• Search & filtering</li>
                <li>• Export functionality</li>
              </ul>
            </div>

            <div className="p-3 bg-purple-50 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-2">⚖️ Rules Engine</h4>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>• Rule creation & management</li>
                <li>• Priority configuration</li>
                <li>• Rule validation</li>
                <li>• Pattern matching</li>
              </ul>
            </div>

            <div className="p-3 bg-orange-50 rounded-lg">
              <h4 className="font-medium text-orange-900 mb-2">🤖 AI Features</h4>
              <ul className="text-sm text-orange-800 space-y-1">
                <li>• Natural language queries</li>
                <li>• Rule generation</li>
                <li>• Data validation</li>
                <li>• Error fixing suggestions</li>
              </ul>
            </div>

            <div className="p-3 bg-teal-50 rounded-lg">
              <h4 className="font-medium text-teal-900 mb-2">💬 AI Chat</h4>
              <ul className="text-sm text-teal-800 space-y-1">
                <li>• Conversational insights</li>
                <li>• Data analysis</li>
                <li>• Recommendations</li>
                <li>• Interactive queries</li>
              </ul>
            </div>

            <div className="p-3 bg-indigo-50 rounded-lg">
              <h4 className="font-medium text-indigo-900 mb-2">📈 Analytics</h4>
              <ul className="text-sm text-indigo-800 space-y-1">
                <li>• Data insights</li>
                <li>• Performance metrics</li>
                <li>• Trend analysis</li>
                <li>• Quality reports</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 