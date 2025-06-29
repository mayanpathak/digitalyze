'use client';

import { useQuery } from '@tanstack/react-query';
import { dataService } from '../../services/data';
import { validationService } from '../../services/api';
import RuleRecommendations from '../../components/RuleRecommendations';
import Link from 'next/link';

export default function Dashboard() {
  const { data: clientStats } = useQuery({
    queryKey: ['entity-stats', 'clients'],
    queryFn: () => dataService.getEntityStats('clients'),
  });

  const { data: workerStats } = useQuery({
    queryKey: ['entity-stats', 'workers'],
    queryFn: () => dataService.getEntityStats('workers'),
  });

  const { data: taskStats } = useQuery({
    queryKey: ['entity-stats', 'tasks'],
    queryFn: () => dataService.getEntityStats('tasks'),
  });

  const { data: validationSummary } = useQuery({
    queryKey: ['validation-summary'],
    queryFn: () => validationService.getValidationSummary(),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes (reduced from 30 seconds)
    staleTime: 2 * 60 * 1000, // Consider stale after 2 minutes
  });

  const stats = [
    { 
      label: 'Clients', 
      value: clientStats?.total || 0, 
      href: '/data/clients',
      color: 'bg-blue-500'
    },
    { 
      label: 'Workers', 
      value: workerStats?.total || 0, 
      href: '/data/workers',
      color: 'bg-green-500'
    },
    { 
      label: 'Tasks', 
      value: taskStats?.total || 0, 
      href: '/data/tasks',
      color: 'bg-purple-500'
    },
    { 
      label: 'Pending Tasks', 
      value: taskStats?.pending || 0, 
      href: '/data/tasks?status=pending',
      color: 'bg-orange-500'
    },
  ];

  const quickActions = [
    { 
      title: 'Upload Files',
      description: 'Upload CSV/XLSX files to start processing',
      href: '/upload',
      icon: '📁'
    },
    { 
      title: 'Chat with Data',
      description: 'Have conversational insights about your uploaded files',
      href: '/ai/chat',
      icon: '💬'
    },
    { 
      title: 'AI Query',
      description: 'Ask questions about your data in natural language',
      href: '/ai/query',
      icon: '🤖'
    },
    { 
      title: 'Manage Rules',
      description: 'Create and edit allocation rules',
      href: '/rules',
      icon: '⚙️'
    },
    { 
      title: 'Data Validation',
      description: 'Comprehensive data quality analysis',
      href: '/validation',
      icon: '✅'
    },
    { 
      title: 'Export Data',
      description: 'Export processed data and rules',
      href: '/data/export',
      icon: '📊'
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          AI-enhanced data ingestion and validation platform
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Link key={index} href={stat.href}>
            <div className="card hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center">
                <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center text-white font-bold text-xl`}>
                  {stat.value}
                </div>
                <div className="ml-4">
                  <p className="font-medium text-gray-900">{stat.label}</p>
                  <p className="text-sm text-gray-500">View all</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Rule Recommendations Widget */}
      <RuleRecommendations />

      {/* Validation Status Widget */}
      {validationSummary && validationSummary.totalRecords > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">🔍 Data Validation Status</h2>
              <Link href="/validation" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                View Details →
              </Link>
            </div>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{validationSummary.totalRecords}</div>
                <div className="text-sm text-gray-600">Total Records</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${validationSummary.totalErrors > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {validationSummary.totalErrors}
                </div>
                <div className="text-sm text-gray-600">Errors</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${validationSummary.totalWarnings > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {validationSummary.totalWarnings}
                </div>
                <div className="text-sm text-gray-600">Warnings</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl ${validationSummary.isValid ? 'text-green-600' : 'text-red-600'}`}>
                  {validationSummary.isValid ? '✅' : '❌'}
                </div>
                <div className="text-sm text-gray-600">Status</div>
              </div>
            </div>
            
            {(validationSummary.totalErrors > 0 || validationSummary.totalWarnings > 0) && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ Data quality issues detected. 
                  <Link href="/validation" className="font-medium underline ml-1">
                    Review and fix issues
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {quickActions.map((action, index) => (
            <Link key={index} href={action.href}>
              <div className="card hover:shadow-md transition-shadow cursor-pointer">
                <div className="text-center">
                  <div className="text-3xl mb-3">{action.icon}</div>
                  <h3 className="font-medium text-gray-900 mb-2">{action.title}</h3>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}