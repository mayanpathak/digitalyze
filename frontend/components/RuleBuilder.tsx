'use client';

import { useState, useEffect } from 'react';
import CoRunRuleBuilder from './rule-builders/CoRunRuleBuilder';
import LoadLimitRuleBuilder from './rule-builders/LoadLimitRuleBuilder';
import PhaseWindowRuleBuilder from './rule-builders/PhaseWindowRuleBuilder';
import { Rule } from '../types';

interface RuleBuilderProps {
  rule?: Partial<Rule>;
  onSave: (rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ruleTypes = [
  { value: 'coRun', label: 'Co-Run Rule', icon: '🔗', description: 'Schedule multiple tasks to run together' },
  { value: 'loadLimit', label: 'Load Limit Rule', icon: '⚖️', description: 'Limit worker capacity per phase' },
  { value: 'phaseWindow', label: 'Phase Window Rule', icon: '📅', description: 'Restrict tasks to specific phases' },
  { value: 'slotRestriction', label: 'Slot Restriction Rule', icon: '🔒', description: 'Ensure minimum common slots for groups' },
  { value: 'patternMatch', label: 'Pattern Match Rule', icon: '🎯', description: 'Apply rules based on regex patterns' },
  { value: 'precedenceOverride', label: 'Precedence Override Rule', icon: '⬆️', description: 'Override default priority ordering' },
];

export default function RuleBuilder({ rule, onSave, onCancel, isLoading }: RuleBuilderProps) {
  const [ruleType, setRuleType] = useState<string>(rule?.type || '');
  const [ruleName, setRuleName] = useState<string>(rule?.name || '');
  const [ruleDescription, setRuleDescription] = useState<string>(rule?.description || '');
  const [priority, setPriority] = useState<number>(rule?.priority || 5);
  const [isActive, setIsActive] = useState<boolean>(rule?.isActive !== false);
  const [typeSpecificData, setTypeSpecificData] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (rule) {
      setRuleType(rule.type || '');
      setRuleName(rule.name || '');
      setRuleDescription(rule.description || '');
      setPriority(rule.priority || 5);
      setIsActive(rule.isActive !== false);
      // Parse existing rule data if available
      try {
        const parsedCondition = rule.condition ? JSON.parse(rule.condition) : {};
        setTypeSpecificData(parsedCondition);
      } catch {
        setTypeSpecificData({});
      }
    }
  }, [rule]);

  const handleTypeSpecificChange = (data: any) => {
    setTypeSpecificData(data);
    setErrors((prev: Record<string, string>) => ({ ...prev, typeSpecific: '' }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!ruleName.trim()) {
      newErrors.name = 'Rule name is required';
    }

    if (!ruleType) {
      newErrors.type = 'Rule type is required';
    }

    if (!ruleDescription.trim()) {
      newErrors.description = 'Rule description is required';
    }

    if (priority < 1 || priority > 10) {
      newErrors.priority = 'Priority must be between 1 and 10';
    }

    // Type-specific validation
    if (ruleType && !typeSpecificData.condition) {
      newErrors.typeSpecific = 'Please complete the rule configuration';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    const ruleData: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'> = {
      name: ruleName,
      description: ruleDescription,
      type: ruleType,
      priority,
      isActive,
      condition: typeSpecificData.condition || '',
      action: typeSpecificData.action || '',
    };

    onSave(ruleData);
  };

  const renderTypeSpecificBuilder = () => {
    switch (ruleType) {
      case 'coRun':
        return (
          <CoRunRuleBuilder
            value={typeSpecificData}
            onChange={handleTypeSpecificChange}
            error={errors.typeSpecific}
          />
        );
      case 'loadLimit':
        return (
          <LoadLimitRuleBuilder
            value={typeSpecificData}
            onChange={handleTypeSpecificChange}
            error={errors.typeSpecific}
          />
        );
      case 'phaseWindow':
        return (
          <PhaseWindowRuleBuilder
            value={typeSpecificData}
            onChange={handleTypeSpecificChange}
            error={errors.typeSpecific}
          />
        );
      case 'slotRestriction':
        return (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600">
              🚧 Slot Restriction rule builder is coming soon. 
              For now, you can use the manual fields below.
            </p>
          </div>
        );
      case 'patternMatch':
        return (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600">
              🚧 Pattern Match rule builder is coming soon. 
              For now, you can use the manual fields below.
            </p>
          </div>
        );
      case 'precedenceOverride':
        return (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600">
              🚧 Precedence Override rule builder is coming soon. 
              For now, you can use the manual fields below.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {rule ? 'Edit Rule' : 'Create New Rule'}
        </h3>
      </div>

      {/* Basic Rule Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rule Name *
          </label>
          <input
            type="text"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            className={`input-field ${errors.name ? 'border-red-300' : ''}`}
            placeholder="Enter a descriptive name for this rule"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Priority (1-10) *
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value) || 5)}
            className={`input-field ${errors.priority ? 'border-red-300' : ''}`}
          />
          {errors.priority && (
            <p className="mt-1 text-sm text-red-600">{errors.priority}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Higher numbers = higher priority
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description *
        </label>
        <textarea
          value={ruleDescription}
          onChange={(e) => setRuleDescription(e.target.value)}
          rows={3}
          className={`input-field ${errors.description ? 'border-red-300' : ''}`}
          placeholder="Describe what this rule does and when it should be applied"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description}</p>
        )}
      </div>

      {/* Rule Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Rule Type *
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ruleTypes.map((type) => (
            <label
              key={type.value}
              className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                ruleType === type.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                value={type.value}
                checked={ruleType === type.value}
                onChange={(e) => {
                  setRuleType(e.target.value);
                  setTypeSpecificData({});
                  setErrors((prev: Record<string, string>) => ({ ...prev, type: '', typeSpecific: '' }));
                }}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="flex items-center mb-1">
                  <span className="text-xl mr-2">{type.icon}</span>
                  <span className="font-medium text-gray-900">{type.label}</span>
                </div>
                <p className="text-sm text-gray-600">{type.description}</p>
              </div>
            </label>
          ))}
        </div>
        {errors.type && (
          <p className="mt-1 text-sm text-red-600">{errors.type}</p>
        )}
      </div>

      {/* Type-Specific Configuration */}
      {ruleType && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">
            {ruleTypes.find(t => t.value === ruleType)?.label} Configuration
          </h4>
          {renderTypeSpecificBuilder()}
        </div>
      )}

      {/* Manual Fields (fallback for unsupported types) */}
      {ruleType && !['coRun', 'loadLimit', 'phaseWindow'].includes(ruleType) && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Condition
            </label>
            <textarea
              value={typeSpecificData.condition || ''}
              onChange={(e) => setTypeSpecificData((prev: any) => ({ ...prev, condition: e.target.value }))}
              rows={3}
              className="input-field"
              placeholder="Enter the condition that triggers this rule"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action
            </label>
            <textarea
              value={typeSpecificData.action || ''}
              onChange={(e) => setTypeSpecificData((prev: any) => ({ ...prev, action: e.target.value }))}
              rows={3}
              className="input-field"
              placeholder="Enter the action to take when the condition is met"
            />
          </div>
        </div>
      )}

      {/* Active Toggle */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 text-blue-600 rounded border-gray-300"
        />
        <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
          Rule is active (will be applied during scheduling)
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="btn-primary"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
        </button>
      </div>
    </div>
  );
} 