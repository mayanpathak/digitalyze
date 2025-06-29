'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { aiService } from '../../../../services/ai';
import { rulesService } from '../../../../services/rules';
import { AIRule } from '../../../../types';

export default function AIRulePage() {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [generatedRule, setGeneratedRule] = useState<AIRule | null>(null);

  const generateMutation = useMutation({
    mutationFn: aiService.generateRule,
    onSuccess: (data) => {
      setGeneratedRule(data);
      toast.success('Rule generated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Rule generation failed');
    },
  });

  const saveMutation = useMutation({
    mutationFn: rulesService.addRule,
    onSuccess: () => {
      toast.success('Rule saved successfully');
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      setGeneratedRule(null);
      setDescription('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save rule');
    },
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Please enter a rule description');
      return;
    }
    generateMutation.mutate(description);
  };

  const handleSave = () => {
    if (!generatedRule) return;
    
    const ruleData = {
      name: generatedRule.name,
      description: generatedRule.description,
      condition: generatedRule.condition,
      action: generatedRule.action,
      priority: 5, // Default priority
      isActive: true,
      type: (generatedRule as any).type || 'patternMatch', // Include the type from AI generation
    };

    saveMutation.mutate(ruleData);
  };

  const exampleDescriptions = [
    "Assign high priority tasks to workers with the highest skill rating",
    "When a client has a budget over $50,000, assign their tasks to senior workers only",
    "If a task is overdue by more than 3 days, escalate to available workers immediately",
    "Match workers with JavaScript skills to web development tasks",
    "Prioritize tasks from VIP clients over regular client tasks",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Rule Generator</h1>
        <p className="text-gray-600 mt-2">
          Describe your allocation rule in natural language and let AI convert it to a structured rule
        </p>
      </div>

      {/* Rule Description Form */}
      <div className="card">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe your rule
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Assign urgent tasks to workers who are currently available and have the required skills"
              className="input-field"
              rows={4}
            />
          </div>
          
          <button
            type="submit"
            disabled={generateMutation.isPending || !description.trim()}
            className="btn-primary"
          >
            {generateMutation.isPending ? 'Generating...' : 'Generate Rule'}
          </button>
        </form>
      </div>

      {/* Example Descriptions */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Example Rule Descriptions</h3>
        <div className="space-y-2">
          {exampleDescriptions.map((example, index) => (
            <button
              key={index}
              onClick={() => setDescription(example)}
              className="block w-full text-left p-3 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Generated Rule Preview */}
      {generatedRule && (
        <div className="card">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold">Generated Rule</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Confidence: {Math.round(generatedRule.confidence * 100)}%
              </span>
              <div
                className={`w-3 h-3 rounded-full ${
                  generatedRule.confidence > 0.8
                    ? 'bg-green-500'
                    : generatedRule.confidence > 0.6
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
              ></div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rule Name
              </label>
              <div className="p-3 bg-gray-50 rounded-lg">
                {generatedRule.name}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <div className="p-3 bg-gray-50 rounded-lg">
                {generatedRule.description}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condition
                </label>
                <div className="p-3 bg-gray-50 rounded-lg text-sm font-mono">
                  {generatedRule.condition}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <div className="p-3 bg-gray-50 rounded-lg text-sm font-mono">
                  {generatedRule.action}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="btn-primary"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Rule'}
              </button>
              <button
                onClick={() => setGeneratedRule(null)}
                className="btn-secondary"
              >
                Discard
              </button>
              <button
                onClick={() => generateMutation.mutate(description)}
                disabled={generateMutation.isPending}
                className="btn-secondary"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {generateMutation.isPending && (
        <div className="card">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Generating rule...</span>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">💡 Tips for Better Rules</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Be specific about conditions (e.g., "priority {'>'}  5" instead of "high priority")</li>
          <li>• Include clear actions (e.g., "assign to worker with highest skill match")</li>
          <li>• Mention relevant fields like priority, budget, skills, availability</li>
          <li>• Use logical operators like "and", "or", "greater than", "less than"</li>
        </ul>
      </div>
    </div>
  );
} 