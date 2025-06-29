'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { aiService } from '../../../../services/ai';
import { AIQueryResult } from '../../../../types';
import EntityTable from '../../../../components/table/EntityTable';

export default function AIQueryPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<AIQueryResult | null>(null);

  const queryMutation = useMutation({
    mutationFn: aiService.query,
    onSuccess: (data) => {
      setResult(data);
      if (data.success) {
        toast.success('Query executed successfully');
      } else {
        const errorMessage = typeof data.error === 'object' 
          ? ((data.error as any)?.message || JSON.stringify(data.error))
          : (data.error || 'Query failed');
        toast.error(String(errorMessage));
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Query failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      toast.error('Please enter a query');
      return;
    }
    queryMutation.mutate(query);
  };

  const exampleQueries = [
    "Show me all high priority clients with budget over $10,000",
    "Find available workers with JavaScript skills",
    "List overdue tasks that need immediate attention",
    "Show me the top 5 clients by budget",
    "Find workers who are currently busy but have high ratings",
  ];

  // Generate columns for results display
  const getColumnsForResults = (results: any[]) => {
    if (!results || results.length === 0) return [];
    
    const firstResult = results[0];
    const seenKeys = new Set<string>();
    
    return Object.keys(firstResult)
      .filter(key => {
        // Avoid duplicate keys and skip internal fields
        if (seenKeys.has(key) || key.startsWith('_')) return false;
        seenKeys.add(key);
        return true;
      })
      .map((key, index) => ({
        key: `${key}-${index}`, // Ensure unique keys
        originalKey: key, // Keep original key for data access
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
        sortable: true,
        type: typeof firstResult[key] === 'number' ? 'number' as const : 'text' as const,
      }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Query</h1>
        <p className="text-gray-600 mt-2">
          Ask questions about your data in natural language
        </p>
      </div>

      {/* Query Form */}
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter your query
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Show me all clients with high priority and budget over $5000"
              className="input-field"
              rows={4}
            />
          </div>
          
          <button
            type="submit"
            disabled={queryMutation.isPending || !query.trim()}
            className="btn-primary"
          >
            {queryMutation.isPending ? 'Processing...' : 'Execute Query'}
          </button>
        </form>
      </div>

      {/* Example Queries */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Example Queries</h3>
        <div className="space-y-2">
          {exampleQueries.map((example, index) => (
            <button
              key={index}
              onClick={() => setQuery(example)}
              className="block w-full text-left p-3 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Query Results */}
      {result && result.success && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold mb-2">Query Explanation</h3>
            <p className="text-gray-700">
              {result.interpretedFilter || result.explanation || 'Query processed successfully'}
            </p>
            {result.confidence && (
              <p className="text-sm text-blue-600 mt-1">
                Confidence: {(result.confidence * 100).toFixed(1)}%
              </p>
            )}
            {result.timestamp && (
              <p className="text-sm text-gray-500 mt-2">
                Executed at: {new Date(result.timestamp).toLocaleString()}
              </p>
            )}
          </div>

          {(() => {
            // Handle single entity results
            if (result.filteredData && Array.isArray(result.filteredData)) {
              return result.filteredData.length > 0 ? (
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Results ({result.filteredData.length} found)
                  </h3>
                                     <EntityTable
                     entity="clients" // This would be dynamic based on query type
                     data={result.filteredData}
                     columns={getColumnsForResults(result.filteredData)}
                     loading={false}
                     onEdit={() => {}} // Read-only for query results
                     onDelete={() => {}} // Read-only for query results
                   />
                </div>
              ) : (
                <div className="card text-center py-8">
                  <div className="text-4xl text-gray-400 mb-4">🔍</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
                  <p className="text-gray-600">
                    Your query didn't return any results. Try refining your search.
                  </p>
                </div>
              );
            }

            // Handle multi-entity results
            if (result.results && typeof result.results === 'object' && !Array.isArray(result.results)) {
              const entityResults = Object.entries(result.results);
              return entityResults.length > 0 ? (
                <div className="space-y-6">
                  {entityResults.map(([entityType, entityResult]: [string, any]) => {
                    if (entityResult.success && entityResult.filteredData && Array.isArray(entityResult.filteredData)) {
                      return (
                        <div key={entityType}>
                          <h3 className="text-lg font-semibold mb-4 capitalize">
                            {entityType} Results ({entityResult.filteredData.length} found)
                          </h3>
                                                     <EntityTable
                             entity={entityType as any}
                             data={entityResult.filteredData}
                             columns={getColumnsForResults(entityResult.filteredData)}
                             loading={false}
                             onEdit={() => {}} // Read-only for query results
                             onDelete={() => {}} // Read-only for query results
                           />
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              ) : (
                <div className="card text-center py-8">
                  <div className="text-4xl text-gray-400 mb-4">🔍</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
                  <p className="text-gray-600">
                    Your query didn't return any results. Try refining your search.
                  </p>
                </div>
              );
            }

            // Handle legacy array format
            if (result.results && Array.isArray(result.results)) {
              return result.results.length > 0 ? (
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Results ({result.results.length} found)
                  </h3>
                                     <EntityTable
                     entity="clients"
                     data={result.results}
                     columns={getColumnsForResults(result.results)}
                     loading={false}
                     onEdit={() => {}} // Read-only for query results
                     onDelete={() => {}} // Read-only for query results
                   />
                </div>
              ) : (
                <div className="card text-center py-8">
                  <div className="text-4xl text-gray-400 mb-4">🔍</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
                  <p className="text-gray-600">
                    Your query didn't return any results. Try refining your search.
                  </p>
                </div>
              );
            }

            return (
              <div className="card text-center py-8">
                <div className="text-4xl text-gray-400 mb-4">🔍</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
                <p className="text-gray-600">
                  Your query didn't return any results. Try refining your search.
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Error State */}
      {result && !result.success && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center">
            <div className="text-red-600 text-xl mr-3">❌</div>
            <div>
              <h3 className="font-semibold text-red-800">Query Failed</h3>
              <p className="text-red-700 text-sm">
                {result.error || 'An error occurred while processing your query.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {queryMutation.isPending && (
        <div className="card">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Processing your query...</span>
          </div>
        </div>
      )}
    </div>
  );
} 