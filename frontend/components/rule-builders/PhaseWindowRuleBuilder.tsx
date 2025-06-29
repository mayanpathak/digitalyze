'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataService } from '../../services/data';
import { Task } from '../../types';

interface PhaseWindowRuleBuilderProps {
  value?: {
    taskId: string;
    allowedPhases: number[];
  };
  onChange: (value: any) => void;
  error?: string;
}

export default function PhaseWindowRuleBuilder({ value, onChange, error }: PhaseWindowRuleBuilderProps) {
  const [selectedTask, setSelectedTask] = useState<string>(value?.taskId || '');
  const [allowedPhases, setAllowedPhases] = useState<number[]>(value?.allowedPhases || []);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Define available phases (this could be configurable)
  const availablePhases = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const { data: tasksResponse, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => dataService.getEntities('tasks'),
  });

  const tasks: Task[] = (tasksResponse?.items || []) as Task[];

  const filteredTasks = tasks.filter((task: Task) => 
    task.TaskTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.TaskID?.toString().includes(searchTerm) ||
    task.TaskDescription?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const selectedTaskObj = tasks.find(t => t.TaskID.toString() === selectedTask);
    onChange({
      taskId: selectedTask,
      allowedPhases,
      condition: selectedTask ? `task.id === '${selectedTask}'` : '',
      action: selectedTask && allowedPhases.length > 0 
        ? `Restrict task "${selectedTaskObj?.TaskTitle || selectedTask}" to phases: ${allowedPhases.join(', ')}`
        : ''
    });
  }, [selectedTask, allowedPhases, tasks]); // Removed onChange from dependencies to prevent infinite loops

  const handlePhaseToggle = (phase: number) => {
    setAllowedPhases((prev: number[]) => 
      prev.includes(phase)
        ? prev.filter(p => p !== phase)
        : [...prev, phase].sort((a, b) => a - b)
    );
  };

  const handlePhaseRangeSelect = (start: number, end: number) => {
    const range = [];
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    setAllowedPhases(range);
  };

  const getTaskDisplay = (task: Task) => {
    return `${task.TaskID} - ${task.TaskTitle || 'Untitled Task'}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Phase Window Configuration
        </label>
        <div className="loading-skeleton h-32"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Task Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Task
        </label>
        <p className="text-sm text-gray-500 mb-3">
          Choose which task to apply phase restrictions to
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

        {/* Task Selection Dropdown */}
        <select
          value={selectedTask}
          onChange={(e) => setSelectedTask(e.target.value)}
          className="input-field"
        >
          <option value="">Select a task</option>
          {filteredTasks.map((task: Task) => (
            <option key={task.TaskID} value={task.TaskID.toString()}>
              {getTaskDisplay(task)}
            </option>
          ))}
        </select>

        {selectedTask && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            {(() => {
              const task = tasks.find(t => t.TaskID.toString() === selectedTask);
              return task ? (
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">Selected Task Details</h4>
                  <div className="text-sm text-gray-700">
                    <p><strong>ID:</strong> {task.TaskID}</p>
                    <p><strong>Title:</strong> {task.TaskTitle}</p>
                    <p><strong>Description:</strong> {task.TaskDescription}</p>
                    <p><strong>Priority:</strong> {task.PriorityLevel}</p>
                    <p><strong>Estimated Hours:</strong> {task.EstimatedHours}</p>
                    <p><strong>Status:</strong> {task.Status}</p>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* Phase Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Allowed Phases
        </label>
        <p className="text-sm text-gray-500 mb-3">
          Select which phases this task is allowed to run in
        </p>

        {/* Quick Range Selection */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Range Selection</h4>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handlePhaseRangeSelect(1, 3)}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
            >
              Early (1-3)
            </button>
            <button
              type="button"
              onClick={() => handlePhaseRangeSelect(4, 6)}
              className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
            >
              Middle (4-6)
            </button>
            <button
              type="button"
              onClick={() => handlePhaseRangeSelect(7, 10)}
              className="px-3 py-1 text-xs bg-orange-100 text-orange-800 rounded hover:bg-orange-200"
            >
              Late (7-10)
            </button>
            <button
              type="button"
              onClick={() => setAllowedPhases(availablePhases)}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
            >
              All Phases
            </button>
            <button
              type="button"
              onClick={() => setAllowedPhases([])}
              className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Individual Phase Selection */}
        <div className="grid grid-cols-5 gap-2">
          {availablePhases.map(phase => (
            <label
              key={phase}
              className={`flex items-center justify-center p-3 rounded cursor-pointer border-2 transition-all ${
                allowedPhases.includes(phase)
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <input
                type="checkbox"
                checked={allowedPhases.includes(phase)}
                onChange={() => handlePhaseToggle(phase)}
                className="sr-only"
              />
              <div className="text-center">
                <div className="font-semibold">Phase {phase}</div>
                <div className="text-xs">
                  {phase <= 3 ? 'Early' : phase <= 6 ? 'Middle' : 'Late'}
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* Phase Timeline Visualization */}
        {allowedPhases.length > 0 && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">Phase Timeline</h4>
            <div className="flex items-center space-x-1">
              {availablePhases.map(phase => (
                <div
                  key={phase}
                  className={`flex-1 h-6 rounded text-xs flex items-center justify-center font-medium ${
                    allowedPhases.includes(phase)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {phase}
                </div>
              ))}
            </div>
            <p className="text-xs text-green-700 mt-2">
              Task can run in {allowedPhases.length} out of {availablePhases.length} phases
            </p>
          </div>
        )}
      </div>

      {/* Preview */}
      {selectedTask && allowedPhases.length > 0 && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">📋 Rule Preview</h4>
          <p className="text-sm text-green-800">
            Task <strong>"{tasks.find(t => t.TaskID.toString() === selectedTask)?.TaskTitle || selectedTask}"</strong>{' '}
            will be restricted to run only in phases: <strong>{allowedPhases.join(', ')}</strong>.
            {allowedPhases.length === 1 && (
              <span className="block mt-1 text-green-700">
                ⚠️ This task can only run in a single phase - ensure this doesn't create bottlenecks.
              </span>
            )}
          </p>
        </div>
      )}

      {/* Validation */}
      {!selectedTask && (
        <div className="text-yellow-600 text-sm">
          ⚠️ Please select a task
        </div>
      )}

      {selectedTask && allowedPhases.length === 0 && (
        <div className="text-yellow-600 text-sm">
          ⚠️ Please select at least one allowed phase
        </div>
      )}

      {allowedPhases.length === 1 && (
        <div className="text-yellow-600 text-sm">
          ⚠️ Restricting to a single phase may create scheduling bottlenecks
        </div>
      )}

      {error && (
        <div className="text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  );
} 