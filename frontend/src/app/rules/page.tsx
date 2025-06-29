'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { rulesService } from '../../../services/rules';
import { Rule } from '../../../types';
import RuleBuilder from '../../../components/RuleBuilder';

export default function RulesPage() {
  const queryClient = useQueryClient();
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  const { data: rules, isLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: rulesService.getRules,
  });

  const { data: priorities } = useQuery({
    queryKey: ['rule-priorities'],
    queryFn: rulesService.getPriorities,
    retry: 1,
  });

  const addMutation = useMutation({
    mutationFn: rulesService.addRule,
    onSuccess: () => {
      toast.success('Rule added successfully');
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      setIsAddingRule(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add rule');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Rule> }) =>
      rulesService.updateRule(id, data),
    onSuccess: () => {
      toast.success('Rule updated successfully');
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      setEditingRule(null);
      setIsAddingRule(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update rule');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: rulesService.deleteRule,
    onSuccess: () => {
      toast.success('Rule deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete rule');
    },
  });

  const handleSaveRule = (ruleData: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: ruleData });
    } else {
      addMutation.mutate(ruleData);
    }
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setIsAddingRule(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCancel = () => {
    setIsAddingRule(false);
    setEditingRule(null);
  };

  const getRuleTypeIcon = (type: string) => {
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

  const getRuleTypeName = (type: string) => {
    switch (type) {
      case 'coRun': return 'Co-Run Rule';
      case 'loadLimit': return 'Load Limit Rule';
      case 'phaseWindow': return 'Phase Window Rule';
      case 'slotRestriction': return 'Slot Restriction Rule';
      case 'patternMatch': return 'Pattern Match Rule';
      case 'precedenceOverride': return 'Precedence Override Rule';
      default: return 'Rule';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rules Management</h1>
          <p className="text-gray-600 mt-1">
            Create and manage allocation rules with specialized builders
          </p>
        </div>
        <button
          onClick={() => setIsAddingRule(true)}
          className="btn-primary"
          disabled={isAddingRule}
        >
          Add Rule
        </button>
      </div>

      {/* Rule Builder */}
      {isAddingRule && (
        <div className="card">
          <RuleBuilder
            rule={editingRule || undefined}
            onSave={handleSaveRule}
            onCancel={handleCancel}
            isLoading={addMutation.isPending || updateMutation.isPending}
          />
        </div>
      )}

      {/* Rules List */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Rules</h3>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="loading-skeleton h-24"></div>
            ))}
          </div>
        ) : rules && rules.length > 0 ? (
          <div className="space-y-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">
                        {getRuleTypeIcon((rule as any).type)}
                      </span>
                      <h4 className="font-semibold">{rule.name}</h4>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          rule.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                        {getRuleTypeName((rule as any).type || 'unknown')}
                      </span>
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                        Priority: {rule.priority}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-2">{rule.description}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Condition:</span>
                        <p className="text-gray-600 mt-1 font-mono text-xs bg-gray-50 p-2 rounded">
                          {rule.condition}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Action:</span>
                        <p className="text-gray-600 mt-1 font-mono text-xs bg-gray-50 p-2 rounded">
                          {rule.action}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Created: {new Date(rule.createdAt).toLocaleDateString()} | 
                      Updated: {new Date(rule.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(rule)}
                      className="text-blue-600 hover:text-blue-800 text-sm px-3 py-1 rounded border border-blue-200 hover:bg-blue-50"
                      disabled={isAddingRule}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      disabled={deleteMutation.isPending}
                      className="text-red-600 hover:text-red-800 text-sm px-3 py-1 rounded border border-red-200 hover:bg-red-50"
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No rules created yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first rule to start managing allocation logic
            </p>
            <button
              onClick={() => setIsAddingRule(true)}
              className="btn-primary"
            >
              Create First Rule
            </button>
          </div>
        )}
      </div>

      {/* Rule Priorities */}
      {priorities && typeof priorities === 'object' && !Array.isArray(priorities) && Object.keys(priorities).length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Global Rule Priorities</h3>
          <p className="text-sm text-gray-600 mb-4">
            These weights determine how different factors are balanced during allocation
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(priorities).filter(([key, value]) => value !== undefined && value !== null).map(([key, value]) => {
              // Convert camelCase to readable format
              const displayName = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())
                .replace('Weight', '');
              
              // Ensure value is safely converted to string
              const displayValue = typeof value === 'number' 
                ? value.toFixed(2) 
                : typeof value === 'string' 
                  ? value 
                  : String(value || '0.00');
              
              return (
                <div key={key} className="text-center p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {displayName}
                  </label>
                  <div className="text-2xl font-bold text-blue-600">
                    {displayValue}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}