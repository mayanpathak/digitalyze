'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import { aiService } from '../../../../services/ai';
import { AIInsight } from '../../../../types';

interface InsightData {
  insights: AIInsight[];
  charts: {
    allocation: Array<{ name: string; value: number; }>;
    priority: Array<{ name: string; value: number; }>;
    status: Array<{ name: string; value: number; color: string; }>;
  };
  summary: {
    totalTasks: number;
    completedTasks: number;
    averagePriority: number;
    utilizationRate: number;
  };
}

export default function AIInsightsPage() {
  const [insightData, setInsightData] = useState<InsightData | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string>('tasks');

  const insightsMutation = useMutation({
    mutationFn: (entity: string) => aiService.getInsights(entity),
    onSuccess: (data) => {
      // Extract insights from API response
      const apiInsights = data?.insights || [];
      
      if (apiInsights.length === 0) {
        toast('No insights available - try uploading some data first', { icon: 'ℹ️' });
        setInsightData(null);
        return;
      }

      // Process real data from API
      const realInsightData: InsightData = {
        insights: apiInsights,
        charts: {
          allocation: [],
          priority: [],
          status: [],
        },
        summary: {
          totalTasks: apiInsights.find((i: any) => i.type === 'volume')?.value || 0,
          completedTasks: 0,
          averagePriority: 0,
          utilizationRate: 0,
        },
      };

      // Process insights to extract chart data
      apiInsights.forEach((insight: any) => {
        if (insight.data && typeof insight.data === 'object') {
          // Extract status data for charts
          if (insight.title.includes('Status') && insight.data) {
            const statusData = Object.entries(insight.data).map(([status, count]: [string, any]) => ({
              name: status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
              value: count,
              color: status === 'completed' ? '#10B981' : 
                     status === 'in_progress' ? '#3B82F6' : 
                     status === 'pending' ? '#F59E0B' : '#EF4444'
            }));
            realInsightData.charts.status = statusData;
            
            // Update summary with real data
            realInsightData.summary.completedTasks = insight.data.completed || 0;
          }
          
          // Extract priority data for charts
          if (insight.title.includes('Priority') && insight.data) {
            const priorityData = Object.entries(insight.data).map(([priority, count]: [string, any]) => ({
              name: `Priority ${priority}`,
              value: count,
            }));
            realInsightData.charts.priority = priorityData;
          }
          
          // Extract skill data for allocation chart
          if (insight.title.includes('Skill') && Array.isArray(insight.data)) {
            const skillData = insight.data.slice(0, 5).map(([skill, count]: [string, number]) => ({
              name: skill,
              value: count,
            }));
            realInsightData.charts.allocation = skillData;
          }
        }
      });
      
      setInsightData(realInsightData);
      toast.success(`Generated ${apiInsights.length} insights from your data`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to generate insights');
    },
  });

  const handleGenerateInsights = () => {
    insightsMutation.mutate(selectedEntity);
  };

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'suggestion': return '💡';
      case 'info': return 'ℹ️';
      default: return '📊';
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Insights</h1>
        <p className="text-gray-600 mt-2">
          Get AI-powered insights and analytics about your resource allocation
        </p>
      </div>

      {/* Generate Button */}
      <div className="card">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Generate AI Insights</h3>
              <p className="text-gray-600 mt-1">
                Analyze your current data to discover patterns and optimization opportunities
              </p>
            </div>
            <button
              onClick={handleGenerateInsights}
              disabled={insightsMutation.isPending}
              className="btn-primary"
            >
              {insightsMutation.isPending ? 'Analyzing...' : 'Generate Insights'}
            </button>
          </div>
          
          {/* Entity Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Entity Type
            </label>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="input-field max-w-xs"
            >
              <option value="tasks">Tasks</option>
              <option value="workers">Workers</option>
              <option value="clients">Clients</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {insightData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card text-center">
            <div className="text-3xl font-bold text-blue-600">{insightData.summary.totalTasks}</div>
            <div className="text-sm text-gray-600 mt-1">Total Tasks</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-green-600">{insightData.summary.completedTasks}</div>
            <div className="text-sm text-gray-600 mt-1">Completed</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-purple-600">{insightData.summary.averagePriority}</div>
            <div className="text-sm text-gray-600 mt-1">Avg Priority</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-orange-600">{insightData.summary.utilizationRate}%</div>
            <div className="text-sm text-gray-600 mt-1">Utilization</div>
          </div>
        </div>
      )}

      {/* Charts */}
      {insightData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Task Allocation Chart */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Task Allocation by Worker Level</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insightData.charts.allocation}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Priority Distribution Chart */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Task Priority Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insightData.charts.priority}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Distribution Pie Chart */}
          <div className="card lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Task Status Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={insightData.charts.status}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                  >
                    {insightData.charts.status.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights */}
      {insightData && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">AI Analysis & Recommendations</h3>
          <div className="space-y-4">
            {insightData.insights.map((insight, index) => (
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
                    <p className="text-gray-700">{insight.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!insightData && !insightsMutation.isPending && (
        <div className="card text-center py-12">
          <div className="text-4xl text-gray-400 mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Insights Generated</h3>
          <p className="text-gray-600">
            Click "Generate Insights" to analyze your data and discover optimization opportunities.
          </p>
        </div>
      )}

      {/* Loading State */}
      {insightsMutation.isPending && (
        <div className="card">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">AI is analyzing your data patterns...</span>
          </div>
        </div>
      )}
    </div>
  );
} 