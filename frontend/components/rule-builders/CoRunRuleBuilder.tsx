'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataService } from '../../services/data';
import { Task } from '../../types';

interface CoRunRuleBuilderProps {
  value?: {
    tasks: string[];
  };
  onChange: (value: any) => void;
  error?: string;
}

export default function CoRunRuleBuilder({ value, onChange, error }: CoRunRuleBuilderProps) {
  const [selectedTasks, setSelectedTasks] = useState<string[]>(value?.tasks || []);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: tasksResponse, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => dataService.getEntities('tasks'),
  });

  const tasks: Task[] = (tasksResponse?.items || []) as Task[];

  useEffect(() => {
    onChange({
      tasks: selectedTasks,
      condition: selectedTasks.length > 0 ? `tasks: [${selectedTasks.join(', ')}]` : '',
      action: selectedTasks.length > 0 ? `Schedule tasks ${selectedTasks.join(', ')} to run together` : ''
    });
  }, [selectedTasks]); // Removed onChange from dependencies to prevent infinite loops

  const filteredTasks = tasks.filter((task: Task) => 
    task.TaskTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.TaskID?.toString().includes(searchTerm) ||
    task.TaskDescription?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTaskToggle = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const getTaskDisplay = (task: Task) => {
    return `${task.TaskID} - ${task.TaskTitle || 'Untitled Task'}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Select Tasks to Run Together
        </label>
        <div className="loading-skeleton h-32"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Tasks to Run Together
        </label>
        <p className="text-sm text-gray-500 mb-3">
          Choose 2 or more tasks that should be scheduled to run simultaneously
        </p>
        
        {/* Search Input */}
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search tasks by ID, title, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
          />
        </div>

        {/* Task Selection */}
        <div className="border rounded-lg max-h-64 overflow-y-auto">
          {filteredTasks.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchTerm ? 'No tasks found matching your search' : 'No tasks available'}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredTasks.map((task: Task) => (
                <label
                  key={task.TaskID}
                  className={`flex items-center p-3 rounded cursor-pointer hover:bg-gray-50 ${
                    selectedTasks.includes(task.TaskID.toString()) ? 'bg-blue-50 border-blue-200' : 'border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(task.TaskID.toString())}
                    onChange={() => handleTaskToggle(task.TaskID.toString())}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {getTaskDisplay(task)}
                    </div>
                    {task.TaskDescription && (
                      <div className="text-sm text-gray-500 mt-1">
                        {task.TaskDescription.substring(0, 100)}
                        {task.TaskDescription.length > 100 ? '...' : ''}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      Client: {task.ClientID} | Priority: {task.PriorityLevel}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Selected Tasks Summary */}
        {selectedTasks.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">
              Selected Tasks ({selectedTasks.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {selectedTasks.map(taskId => {
                const task = tasks.find((t: Task) => t.TaskID.toString() === taskId);
                return (
                  <span
                    key={taskId}
                    className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
                  >
                    {task ? getTaskDisplay(task) : taskId}
                    <button
                      onClick={() => handleTaskToggle(taskId)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Validation */}
        {selectedTasks.length === 1 && (
          <div className="mt-2 text-yellow-600 text-sm">
            ⚠️ Please select at least 2 tasks for a co-run rule
          </div>
        )}
        
        {selectedTasks.length > 10 && (
          <div className="mt-2 text-yellow-600 text-sm">
            ⚠️ Consider limiting to 10 or fewer tasks for better performance
          </div>
        )}

        {error && (
          <div className="mt-2 text-red-600 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
} 