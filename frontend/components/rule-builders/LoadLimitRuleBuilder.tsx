'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataService } from '../../services/data';
import { Worker } from '../../types';

interface LoadLimitRuleBuilderProps {
  value?: {
    workerGroup: string;
    maxSlotsPerPhase: number;
  };
  onChange: (value: any) => void;
  error?: string;
}

export default function LoadLimitRuleBuilder({ value, onChange, error }: LoadLimitRuleBuilderProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>(value?.workerGroup || '');
  const [maxSlots, setMaxSlots] = useState<number>(value?.maxSlotsPerPhase || 5);
  const [groupingMethod, setGroupingMethod] = useState<'skill' | 'availability' | 'custom'>('skill');

  const { data: workersResponse, isLoading } = useQuery({
    queryKey: ['workers'],
    queryFn: () => dataService.getEntities('workers'),
  });

  const workers: Worker[] = (workersResponse?.items || []) as Worker[];

  // Extract groups based on selected method
  const getWorkerGroups = () => {
    if (groupingMethod === 'skill') {
      // Group by primary skill (first skill in the array)
      const skills = Array.from(new Set(
        workers
          .map(worker => Array.isArray(worker.Skills) ? worker.Skills[0] : worker.Skills)
          .filter(Boolean)
      )).sort();
      return skills.map(skill => ({ value: skill, label: `${skill} Workers` }));
    } else if (groupingMethod === 'availability') {
      // Group by availability status
      const availabilities = Array.from(new Set(
        workers.map(worker => worker.Availability).filter(Boolean)
      )).sort();
      return availabilities.map(avail => ({ 
        value: avail, 
        label: `${avail.charAt(0).toUpperCase() + avail.slice(1)} Workers` 
      }));
    } else {
      // Custom groups - for now, just return a default
      return [{ value: 'all', label: 'All Workers' }];
    }
  };

  const workerGroups = getWorkerGroups();

  const getWorkersInGroup = (groupValue: string) => {
    if (groupingMethod === 'skill') {
      return workers.filter(worker => 
        Array.isArray(worker.Skills) 
          ? worker.Skills[0] === groupValue 
          : worker.Skills === groupValue
      );
    } else if (groupingMethod === 'availability') {
      return workers.filter(worker => worker.Availability === groupValue);
    } else {
      return workers;
    }
  };

  useEffect(() => {
    onChange({
      workerGroup: selectedGroup,
      maxSlotsPerPhase: maxSlots,
      groupingMethod,
      condition: selectedGroup ? `worker.${groupingMethod} === '${selectedGroup}'` : '',
      action: selectedGroup ? `Limit ${selectedGroup} workers to max ${maxSlots} slots per phase` : ''
    });
  }, [selectedGroup, maxSlots, groupingMethod]); // Removed onChange from dependencies to prevent infinite loops

  if (isLoading) {
    return (
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Load Limit Configuration
        </label>
        <div className="loading-skeleton h-32"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Grouping Method Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Group Workers By
        </label>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="skill"
              checked={groupingMethod === 'skill'}
              onChange={(e) => {
                setGroupingMethod(e.target.value as 'skill');
                setSelectedGroup('');
              }}
              className="mr-2"
            />
            Primary Skill
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="availability"
              checked={groupingMethod === 'availability'}
              onChange={(e) => {
                setGroupingMethod(e.target.value as 'availability');
                setSelectedGroup('');
              }}
              className="mr-2"
            />
            Availability Status
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="custom"
              checked={groupingMethod === 'custom'}
              onChange={(e) => {
                setGroupingMethod(e.target.value as 'custom');
                setSelectedGroup('');
              }}
              className="mr-2"
            />
            All Workers
          </label>
        </div>
      </div>

      {/* Worker Group Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Worker Group
        </label>
        <p className="text-sm text-gray-500 mb-3">
          Select which worker group to apply the load limit to
        </p>
        
        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="input-field"
        >
          <option value="">Select a worker group</option>
          {workerGroups.map(group => (
            <option key={group.value} value={group.value}>
              {group.label} ({getWorkersInGroup(group.value).length} workers)
            </option>
          ))}
        </select>

        {selectedGroup && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">
              Workers in "{selectedGroup}" group:
            </h4>
            <div className="text-sm text-gray-700 max-h-32 overflow-y-auto">
              {getWorkersInGroup(selectedGroup).map(worker => (
                <div key={worker.WorkerID} className="flex justify-between py-1">
                  <span>{worker.WorkerName} (ID: {worker.WorkerID})</span>
                  <span className="text-gray-500">
                    {Array.isArray(worker.Skills) ? worker.Skills.join(', ') : worker.Skills}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Max Slots Configuration */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Maximum Slots Per Phase
        </label>
        <p className="text-sm text-gray-500 mb-3">
          Set the maximum number of task slots each worker in this group can handle per phase
        </p>
        
        <div className="flex items-center space-x-4">
          <input
            type="number"
            min="1"
            max="20"
            value={maxSlots}
            onChange={(e) => setMaxSlots(parseInt(e.target.value) || 1)}
            className="input-field w-24"
          />
          <span className="text-sm text-gray-600">slots per phase</span>
        </div>

        {/* Visual slider for better UX */}
        <div className="mt-3">
          <input
            type="range"
            min="1"
            max="20"
            value={maxSlots}
            onChange={(e) => setMaxSlots(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1 slot</span>
            <span>10 slots</span>
            <span>20 slots</span>
          </div>
        </div>

        {/* Load level indicator */}
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Load Level</span>
            <span className={`text-sm font-medium ${
              maxSlots <= 3 ? 'text-green-600' : 
              maxSlots <= 7 ? 'text-yellow-600' : 
              'text-red-600'
            }`}>
              {maxSlots <= 3 ? 'Light' : maxSlots <= 7 ? 'Moderate' : 'Heavy'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                maxSlots <= 3 ? 'bg-green-500' : 
                maxSlots <= 7 ? 'bg-yellow-500' : 
                'bg-red-500'
              }`}
              style={{ width: `${(maxSlots / 20) * 100}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {maxSlots <= 3 && 'Conservative load - ensures workers aren\'t overwhelmed'}
            {maxSlots > 3 && maxSlots <= 7 && 'Balanced load - good for most scenarios'}
            {maxSlots > 7 && 'High load - may impact quality or worker satisfaction'}
          </p>
        </div>
      </div>

      {/* Preview */}
      {selectedGroup && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">📋 Rule Preview</h4>
          <p className="text-sm text-green-800">
            Workers in the <strong>"{selectedGroup}"</strong> group will be limited to a maximum of{' '}
            <strong>{maxSlots} task slots</strong> per phase. This affects{' '}
            <strong>{getWorkersInGroup(selectedGroup).length} workers</strong>.
          </p>
        </div>
      )}

      {/* Validation */}
      {!selectedGroup && (
        <div className="text-yellow-600 text-sm">
          ⚠️ Please select a worker group
        </div>
      )}

      {maxSlots > 15 && (
        <div className="text-yellow-600 text-sm">
          ⚠️ Very high load limit may impact worker performance
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