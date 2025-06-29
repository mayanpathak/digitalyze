'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiService } from '../services/ai';
import { rulesService } from '../services/rules';
import { RuleRecommendation } from '../types';
import toast from 'react-hot-toast';

interface RuleRecommendationsProps {
  className?: string;
}

export default function RuleRecommendations({ className = '' }: RuleRecommendationsProps) {
  const queryClient = useQueryClient();
  const [ignoredRecommendations, setIgnoredRecommendations] = useState<Set<string>>(new Set());

  const { data: recommendations = [], isLoading, error, refetch } = useQuery({
    queryKey: ['rule-recommendations'],
    queryFn: async () => {
      try {
        const result = await aiService.getRuleRecommendations();
        return result;
      } catch (error: any) {
        console.error('[RuleRecommendations] Error fetching recommendations:', error);
        
        // Check if this is a "no data" error (400 status)
        if (error.response?.status === 400) {
          // Return empty array for no data case - we'll handle this in the UI
          return [];
        }
        
        // For other errors, throw to trigger error state
        throw error;
      }
    },
    refetchInterval: 15 * 60 * 1000, // Refetch every 15 minutes (reduced frequency)
    staleTime: 10 * 60 * 1000, // Consider stale after 10 minutes
    retry: (failureCount, error: any) => {
      // Don't retry 400 errors (no data available)
      if (error.response?.status === 400) {
        return false;
      }
      // Retry other errors up to 3 times
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const addRuleMutation = useMutation({
    mutationFn: rulesService.addRule,
    onSuccess: () => {
      toast.success('Rule added successfully');
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      // Don't invalidate rule-recommendations to prevent infinite refetch loop
      // The user can manually refresh if they want updated recommendations
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add rule');
    },
  });

  const handleAcceptRule = (recommendation: RuleRecommendation) => {
    const ruleData = {
      name: `AI Suggested: ${recommendation.type} Rule`,
      description: recommendation.reason,
      condition: recommendation.suggestedRule.condition || generateConditionFromRule(recommendation),
      action: recommendation.suggestedRule.action || generateActionFromRule(recommendation),
      priority: recommendation.priority === 'high' ? 8 : recommendation.priority === 'medium' ? 5 : 3,
      isActive: true,
      type: recommendation.type,
      ...recommendation.suggestedRule
    };

    addRuleMutation.mutate(ruleData);
  };

  const handleTweakRule = (recommendation: RuleRecommendation) => {
    // For now, redirect to rule creation page with pre-filled data
    const ruleData = encodeURIComponent(JSON.stringify({
      type: recommendation.type,
      reason: recommendation.reason,
      suggestedRule: recommendation.suggestedRule,
      expectedBenefit: recommendation.expectedBenefit
    }));
    
    window.location.href = `/rules?edit=true&suggestion=${ruleData}`;
  };

  const handleIgnoreRule = (recommendation: RuleRecommendation, index: number) => {
    const recommendationId = `${recommendation.type}-${index}`;
    setIgnoredRecommendations((prev: Set<string>) => new Set([...prev, recommendationId]));
    toast.success('Recommendation ignored');
  };

  const handleRequestMoreHints = () => {
    refetch();
    toast.success('Refreshing recommendations...');
  };

  // Helper functions to generate rule conditions and actions
  const generateConditionFromRule = (recommendation: RuleRecommendation) => {
    switch (recommendation.type) {
      case 'coRun':
        return `Tasks ${recommendation.suggestedRule.tasks?.join(', ') || 'related tasks'} should run together`;
      case 'loadLimit':
        return `Worker group ${recommendation.suggestedRule.workerGroup || 'default'} load limit`;
      case 'phaseWindow':
        return `Phase restriction for ${recommendation.suggestedRule.phases?.join(', ') || 'specified phases'}`;
      case 'slotRestriction':
        return `Slot availability restriction`;
      case 'precedenceOverride':
        return `Task precedence override`;
      default:
        return 'AI-generated rule condition';
    }
  };

  const generateActionFromRule = (recommendation: RuleRecommendation) => {
    switch (recommendation.type) {
      case 'coRun':
        return `Schedule tasks together in same phase`;
      case 'loadLimit':
        return `Limit to ${recommendation.suggestedRule.maxSlotsPerPhase || 3} slots per phase`;
      case 'phaseWindow':
        return `Restrict to phases ${recommendation.suggestedRule.allowedPhases?.join(', ') || 'specified'}`;
      case 'slotRestriction':
        return `Apply slot restrictions`;
      case 'precedenceOverride':
        return `Override task precedence`;
      default:
        return 'Apply AI-suggested action';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'coRun': return '🔗';
      case 'loadLimit': return '⚖️';
      case 'phaseWindow': return '📅';
      case 'slotRestriction': return '🔒';
      case 'patternMatch': return '🎯';
      case 'precedenceOverride': return '⬆️';
      default: return '📋';
    }
  };

  // Filter out ignored recommendations
  const visibleRecommendations = recommendations.filter((_, index) => {
    const recommendationId = `${recommendations[index].type}-${index}`;
    return !ignoredRecommendations.has(recommendationId);
  });

  if (isLoading) {
    return (
      <div className={`card ${className}`}>
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">🤖 AI Rule Recommendations</h3>
        </div>
        <div className="card-body">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="loading-skeleton h-24"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Handle no data case
  if (!error && recommendations.length === 0) {
    return (
      <div className={`card ${className}`}>
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">🤖 AI Rule Recommendations</h3>
        </div>
        <div className="card-body">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📊</div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h4>
            <p className="text-gray-600 mb-4">
              Upload CSV files (clients, workers, tasks) to get AI-powered rule recommendations.
            </p>
            <div className="space-x-4">
              <a href="/upload" className="btn-primary">
                Upload Data Files
              </a>
              <button onClick={() => refetch()} className="btn-secondary">
                Check Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`card ${className}`}>
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">🤖 AI Rule Recommendations</h3>
        </div>
        <div className="card-body">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">⚠️</div>
            <h4 className="text-lg font-medium text-red-600 mb-2">Failed to Load Recommendations</h4>
            <p className="text-gray-600 mb-4">
              There was an error fetching AI rule recommendations.
            </p>
            <button onClick={() => refetch()} className="btn-secondary">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      <div className="card-header">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">🤖 AI Rule Recommendations</h3>
          <div className="flex space-x-2">
            <button 
              onClick={handleRequestMoreHints}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              🔄 Refresh
            </button>
            <span className="text-sm text-gray-500">
              {visibleRecommendations.length} suggestion{visibleRecommendations.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="card-body">
        {visibleRecommendations.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🎯</div>
            <p className="text-gray-600">
              All recommendations have been processed or ignored.
            </p>
            <button onClick={handleRequestMoreHints} className="btn-secondary mt-4">
              Request More Hints
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleRecommendations.map((recommendation, index) => {
              const originalIndex = recommendations.findIndex(r => r === recommendation);
              const stableKey = `${recommendation.type}-${recommendation.priority}-${originalIndex}`;
              return (
              <div key={stableKey} className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{getTypeIcon(recommendation.type)}</span>
                      <h4 className="font-semibold text-gray-900 capitalize">
                        {recommendation.type.replace(/([A-Z])/g, ' $1')} Rule
                      </h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(recommendation.priority)}`}>
                        {recommendation.priority} priority
                      </span>
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                        {Math.round(recommendation.confidence * 100)}% confidence
                      </span>
                    </div>
                    
                    <p className="text-gray-700 mb-2">{recommendation.reason}</p>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      <strong>Expected benefit:</strong> {recommendation.expectedBenefit}
                    </div>

                    {/* Rule Details */}
                    {recommendation.suggestedRule && (
                      <div className="bg-white rounded p-3 text-sm border">
                        <strong>Suggested rule details:</strong>
                        <pre className="mt-1 text-xs text-gray-600 whitespace-pre-wrap">
                          {JSON.stringify(recommendation.suggestedRule, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleAcceptRule(recommendation)}
                    disabled={addRuleMutation.isPending}
                    className="btn-primary text-sm"
                  >
                    ✅ Accept Rule
                  </button>
                  <button
                    onClick={() => handleTweakRule(recommendation)}
                    className="btn-secondary text-sm"
                  >
                    ✏️ Tweak Rule
                  </button>
                  <button
                    onClick={() => handleIgnoreRule(recommendation, originalIndex)}
                    className="btn-ghost text-sm text-gray-600 hover:text-gray-800"
                  >
                    ❌ Ignore
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
} 