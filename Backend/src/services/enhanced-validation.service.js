import ResponseBuilder from '../utils/responseBuilder.js';

export class EnhancedValidationService {
  static VALIDATION_TYPES = {
    STRUCTURAL: 'structural',
    REFERENTIAL: 'referential', 
    BUSINESS: 'business',
    OPERATIONAL: 'operational'
  };

  static SEVERITY = {
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
  };

  /**
   * Utility function to safely convert comma-separated strings or arrays to arrays
   */
  static safeArrayConvert(value) {
    if (Array.isArray(value)) {
      return value.map(item => String(item).trim()).filter(Boolean);
    } else if (typeof value === 'string' && value.trim()) {
      return value.split(',').map(item => item.trim()).filter(Boolean);
    }
    return [];
  }

  /**
   * Utility function to safely convert phase data to array of numbers
   */
  static safePhaseConvert(value) {
    if (Array.isArray(value)) {
      return value.map(p => parseInt(p)).filter(p => !isNaN(p));
    } else if (typeof value === 'string' && value.trim()) {
      if (value.includes('-')) {
        // Range format like "1-3"
        const [start, end] = value.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          const phases = [];
          for (let i = start; i <= end; i++) {
            phases.push(i);
          }
          return phases;
        }
      } else {
        // Array format like "[1,2,3]" or "1,2,3"
        const cleaned = value.replace(/[\[\]]/g, '');
        return cleaned.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
      }
    }
    return [];
  }

  /**
   * Main validation orchestrator
   */
  static async validateAllData(clientsData, workersData, tasksData, rules = []) {
    try {
      const results = {
        structural: await this.validateStructural(clientsData, workersData, tasksData),
        referential: await this.validateReferential(clientsData, workersData, tasksData),
        business: await this.validateBusinessLogic(clientsData, workersData, tasksData),
        operational: await this.validateOperational(clientsData, workersData, tasksData, rules)
      };

      return this.aggregateResults(results);
    } catch (error) {
      console.error('Enhanced validation error:', error);
      return {
        isValid: false,
        errors: [{
          id: 'validation_system_error',
          type: 'system',
          severity: 'error',
          message: 'Validation system encountered an error',
          entity: 'system'
        }],
        warnings: [],
        summary: {
          totalErrors: 1,
          totalWarnings: 0,
          validationTypes: [],
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Structural validations - basic data integrity
   */
  static async validateStructural(clientsData, workersData, tasksData) {
    const errors = [];

    // 1. Missing required columns
    errors.push(...this.validateRequiredColumns(clientsData, 'clients'));
    errors.push(...this.validateRequiredColumns(workersData, 'workers'));
    errors.push(...this.validateRequiredColumns(tasksData, 'tasks'));

    // 2. Duplicate IDs
    errors.push(...this.validateDuplicateIds(clientsData, 'clients', 'ClientID'));
    errors.push(...this.validateDuplicateIds(workersData, 'workers', 'WorkerID'));
    errors.push(...this.validateDuplicateIds(tasksData, 'tasks', 'TaskID'));

    // 3. Malformed data types
    errors.push(...this.validateDataTypes(clientsData, workersData, tasksData));

    // 4. Out-of-range values
    errors.push(...this.validateRanges(clientsData, workersData, tasksData));

    return errors;
  }

  /**
   * Referential validations - relationships between entities
   */
  static async validateReferential(clientsData, workersData, tasksData) {
    const errors = [];

    // 5. Unknown references
    errors.push(...this.validateTaskReferences(clientsData, tasksData));

    // 6. Skill coverage matrix
    errors.push(...this.validateSkillCoverage(tasksData, workersData));

    return errors;
  }

  /**
   * Business logic validations
   */
  static async validateBusinessLogic(clientsData, workersData, tasksData) {
    const errors = [];

    // 7. Overloaded workers
    errors.push(...this.validateWorkerOverload(workersData));

    // 8. Phase-slot saturation
    errors.push(...this.validatePhaseSlotSaturation(tasksData, workersData));

    return errors;
  }

  /**
   * Operational validations - resource allocation feasibility
   */
  static async validateOperational(clientsData, workersData, tasksData, rules) {
    const errors = [];

    // 9. Max-concurrency feasibility
    errors.push(...this.validateMaxConcurrency(tasksData, workersData));

    // 10. Circular co-run groups (if rules provided)
    if (rules && rules.length > 0) {
      errors.push(...this.detectCircularCoRuns(tasksData, rules));
    }

    return errors;
  }

  /**
   * Validation implementations
   */
  
  static validateRequiredColumns(data, entityType) {
    const errors = [];
    const requiredFields = {
      clients: ['ClientID', 'ClientName', 'PriorityLevel'],
      workers: ['WorkerID', 'WorkerName', 'Skills', 'AvailableSlots'],
      tasks: ['TaskID', 'TaskName', 'Duration', 'RequiredSkills']
    };

    const required = requiredFields[entityType] || [];
    
    if (data.length > 0) {
      const firstRecord = data[0];
      required.forEach(field => {
        if (!(field in firstRecord)) {
          errors.push({
            id: `missing_column_${entityType}_${field}`,
            type: 'missing_required_column',
            severity: 'error',
            entity: entityType,
            field: field,
            message: `Required column '${field}' is missing from ${entityType} data`,
            suggestedFix: `Add '${field}' column to your ${entityType} CSV file`
          });
        }
      });
    }

    return errors;
  }

  static validateDuplicateIds(data, entityType, idField) {
    const errors = [];
    const seenIds = new Set();
    const duplicates = new Set();

    data.forEach((record, index) => {
      const id = record[idField];
      if (id) {
        if (seenIds.has(id)) {
          duplicates.add(id);
        } else {
          seenIds.add(id);
        }
      }
    });

    duplicates.forEach(duplicateId => {
      errors.push({
        id: `duplicate_id_${entityType}_${duplicateId}`,
        type: 'duplicate_id',
        severity: 'error',
        entity: entityType,
        field: idField,
        recordId: duplicateId,
        message: `Duplicate ${idField}: '${duplicateId}' found in ${entityType}`,
        suggestedFix: `Ensure all ${idField} values are unique`
      });
    });

    return errors;
  }

  static validateDataTypes(clientsData, workersData, tasksData) {
    const errors = [];

    // Validate PriorityLevel in clients
    clientsData.forEach((client, index) => {
      if (client.PriorityLevel) {
        const priority = parseInt(client.PriorityLevel);
        if (isNaN(priority)) {
          errors.push({
            id: `malformed_priority_${client.ClientID || index}`,
            type: 'malformed_data',
            severity: 'error',
            entity: 'clients',
            field: 'PriorityLevel',
            recordId: client.ClientID,
            row: index + 1,
            message: `PriorityLevel '${client.PriorityLevel}' is not a valid number`,
            suggestedFix: 'Use numeric values 1-5 for PriorityLevel'
          });
        }
      }
    });

    // Validate AvailableSlots in workers
    workersData.forEach((worker, index) => {
      if (worker.AvailableSlots) {
        try {
          const slots = Array.isArray(worker.AvailableSlots) 
            ? worker.AvailableSlots 
            : JSON.parse(worker.AvailableSlots);
          
          if (!Array.isArray(slots)) {
            throw new Error('Not an array');
          }
        } catch (e) {
          errors.push({
            id: `malformed_slots_${worker.WorkerID || index}`,
            type: 'malformed_data',
            severity: 'error',
            entity: 'workers',
            field: 'AvailableSlots',
            recordId: worker.WorkerID,
            row: index + 1,
            message: `AvailableSlots '${worker.AvailableSlots}' is not valid JSON array`,
            suggestedFix: 'Use format like [1,2,3] for AvailableSlots'
          });
        }
      }
    });

    // Validate Duration in tasks
    tasksData.forEach((task, index) => {
      if (task.Duration) {
        const duration = parseInt(task.Duration);
        if (isNaN(duration) || duration < 1) {
          errors.push({
            id: `malformed_duration_${task.TaskID || index}`,
            type: 'malformed_data',
            severity: 'error',
            entity: 'tasks',
            field: 'Duration',
            recordId: task.TaskID,
            row: index + 1,
            message: `Duration '${task.Duration}' must be a number >= 1`,
            suggestedFix: 'Use positive integers for Duration (number of phases)'
          });
        }
      }
    });

    return errors;
  }

  static validateRanges(clientsData, workersData, tasksData) {
    const errors = [];

    // Validate PriorityLevel range (1-5)
    clientsData.forEach((client, index) => {
      if (client.PriorityLevel) {
        const priority = parseInt(client.PriorityLevel);
        if (!isNaN(priority) && (priority < 1 || priority > 5)) {
          errors.push({
            id: `priority_out_of_range_${client.ClientID || index}`,
            type: 'out_of_range',
            severity: 'error',
            entity: 'clients',
            field: 'PriorityLevel',
            recordId: client.ClientID,
            row: index + 1,
            message: `PriorityLevel ${priority} is out of range (must be 1-5)`,
            suggestedFix: 'Use values between 1 and 5 for PriorityLevel'
          });
        }
      }
    });

    return errors;
  }

  static validateTaskReferences(clientsData, tasksData) {
    const errors = [];
    const validTaskIds = new Set(tasksData.map(task => task.TaskID).filter(Boolean));

    clientsData.forEach((client, index) => {
      if (client.RequestedTaskIDs) {
        const requestedTasks = this.safeArrayConvert(client.RequestedTaskIDs);
        
        requestedTasks.forEach(taskId => {
          if (taskId && !validTaskIds.has(taskId)) {
            errors.push({
              id: `unknown_task_reference_${client.ClientID}_${taskId}`,
              type: 'unknown_reference',
              severity: 'error',
              entity: 'clients',
              field: 'RequestedTaskIDs',
              recordId: client.ClientID,
              row: index + 1,
              message: `Client ${client.ClientID} references unknown task: ${taskId}`,
              suggestedFix: `Remove '${taskId}' from RequestedTaskIDs or add task with ID '${taskId}'`
            });
          }
        });
      }
    });

    return errors;
  }

  static validateSkillCoverage(tasksData, workersData) {
    const errors = [];
    const workerSkills = new Set();
    
    // Collect all worker skills
    workersData.forEach(worker => {
      if (worker.Skills) {
        const skills = this.safeArrayConvert(worker.Skills);
        skills.forEach(skill => 
          workerSkills.add(skill.toLowerCase())
        );
      }
    });

    // Check if all required skills are covered
    tasksData.forEach((task, index) => {
      if (task.RequiredSkills) {
        const requiredSkills = this.safeArrayConvert(task.RequiredSkills);
        
        requiredSkills.forEach(skill => {
          const cleanSkill = skill.trim().toLowerCase();
          if (cleanSkill && !workerSkills.has(cleanSkill)) {
            errors.push({
              id: `skill_gap_${task.TaskID}_${skill.trim()}`,
              type: 'skill_coverage_gap',
              severity: 'error',
              entity: 'tasks',
              field: 'RequiredSkills',
              recordId: task.TaskID,
              row: index + 1,
              message: `Skill "${skill.trim()}" required by task ${task.TaskID} is not available in any worker`,
              suggestedFix: `Add "${skill.trim()}" skill to an available worker or modify task requirements`
            });
          }
        });
      }
    });

    return errors;
  }

  static validateWorkerOverload(workersData) {
    const errors = [];
    
    workersData.forEach((worker, index) => {
      if (worker.AvailableSlots && worker.MaxLoadPerPhase) {
        try {
          const availableSlots = Array.isArray(worker.AvailableSlots) 
            ? worker.AvailableSlots 
            : JSON.parse(worker.AvailableSlots || '[]');
            
          const maxLoad = parseInt(worker.MaxLoadPerPhase);
          
          if (!isNaN(maxLoad) && availableSlots.length > maxLoad) {
            errors.push({
              id: `worker_overload_${worker.WorkerID || index}`,
              type: 'worker_overload',
              severity: 'warning',
              entity: 'workers',
              recordId: worker.WorkerID,
              field: 'MaxLoadPerPhase',
              row: index + 1,
              message: `Worker ${worker.WorkerID} has ${availableSlots.length} available slots but max load is ${maxLoad}`,
              suggestedFix: `Increase MaxLoadPerPhase to ${availableSlots.length} or reduce AvailableSlots`
            });
          }
        } catch (e) {
          // Skip malformed data - will be caught by structural validation
        }
      }
    });
    
    return errors;
  }

  static validatePhaseSlotSaturation(tasksData, workersData) {
    const errors = [];
    
    try {
      const phaseCapacity = this.calculatePhaseCapacity(workersData);
      const phaseDemand = this.calculatePhaseDemand(tasksData);
      
      for (const [phase, demand] of Object.entries(phaseDemand)) {
        const capacity = phaseCapacity[phase] || 0;
        if (demand > capacity) {
          errors.push({
            id: `phase_saturation_${phase}`,
            type: 'phase_slot_saturation',
            severity: 'error',
            entity: 'operational',
            message: `Phase ${phase} overloaded: ${demand} task-phases needed, ${capacity} worker-slots available`,
            suggestedFix: `Add ${demand - capacity} more worker slots for phase ${phase} or reduce task requirements`,
            affectedRecords: tasksData.filter(t => 
              this.taskUsesPhase(t, parseInt(phase))
            ).map(t => t.TaskID)
          });
        }
      }
    } catch (error) {
      // If calculation fails, add a warning
      errors.push({
        id: 'phase_calculation_error',
        type: 'calculation_error',
        severity: 'warning',
        entity: 'operational',
        message: 'Unable to calculate phase-slot saturation due to data format issues',
        suggestedFix: 'Check AvailableSlots and PreferredPhases formatting'
      });
    }
    
    return errors;
  }

  static validateMaxConcurrency(tasksData, workersData) {
    const errors = [];
    
    tasksData.forEach((task, index) => {
      if (task.MaxConcurrent && task.RequiredSkills) {
        try {
          const maxConcurrent = parseInt(task.MaxConcurrent);
          
          // Handle RequiredSkills as array or string
          const requiredSkills = this.safeArrayConvert(task.RequiredSkills).map(s => s.toLowerCase());
          
          // Count qualified workers
          const qualifiedWorkers = workersData.filter(worker => {
            if (!worker.Skills) return false;
            
            // Handle worker Skills as array or string
            const workerSkills = this.safeArrayConvert(worker.Skills).map(s => s.toLowerCase());
            
            return requiredSkills.every(skill => workerSkills.includes(skill));
          });
          
          if (!isNaN(maxConcurrent) && qualifiedWorkers.length < maxConcurrent) {
            errors.push({
              id: `max_concurrency_infeasible_${task.TaskID}`,
              type: 'max_concurrency_infeasible',
              severity: 'warning',
              entity: 'tasks',
              field: 'MaxConcurrent',
              recordId: task.TaskID,
              row: index + 1,
              message: `Task ${task.TaskID} requires ${maxConcurrent} concurrent workers, but only ${qualifiedWorkers.length} qualified workers available`,
              suggestedFix: `Reduce MaxConcurrent to ${qualifiedWorkers.length} or add more workers with required skills`
            });
          }
        } catch (e) {
          // Skip malformed data
        }
      }
    });
    
    return errors;
  }

  static detectCircularCoRuns(tasksData, rules) {
    const errors = [];
    
    try {
      const coRunRules = rules.filter(rule => rule.type === 'coRun');
      if (coRunRules.length === 0) return errors;
      
      // Build dependency graph
      const graph = new Map();
      tasksData.forEach(task => graph.set(task.TaskID, new Set()));
      
      coRunRules.forEach(rule => {
        if (rule.tasks && Array.isArray(rule.tasks)) {
          // For co-run rules, create bidirectional dependencies
          for (let i = 0; i < rule.tasks.length; i++) {
            for (let j = i + 1; j < rule.tasks.length; j++) {
              const taskA = rule.tasks[i];
              const taskB = rule.tasks[j];
              if (graph.has(taskA) && graph.has(taskB)) {
                graph.get(taskA).add(taskB);
                graph.get(taskB).add(taskA);
              }
            }
          }
        }
      });
      
      // Detect cycles using DFS
      const visited = new Set();
      const recursionStack = new Set();
      
      const dfs = (node, path) => {
        if (recursionStack.has(node)) {
          const cycleStart = path.indexOf(node);
          const cycle = path.slice(cycleStart);
          cycle.push(node);
          return cycle;
        }
        
        if (visited.has(node)) return null;
        
        visited.add(node);
        recursionStack.add(node);
        path.push(node);
        
        for (const neighbor of graph.get(node) || []) {
          const cycle = dfs(neighbor, [...path]);
          if (cycle) return cycle;
        }
        
        recursionStack.delete(node);
        return null;
      };
      
      for (const node of graph.keys()) {
        if (!visited.has(node)) {
          const cycle = dfs(node, []);
          if (cycle) {
            errors.push({
              id: `circular_corun_${cycle.join('_')}`,
              type: 'circular_corun',
              severity: 'error',
              entity: 'rules',
              message: `Circular co-run dependency detected: ${cycle.join(' → ')}`,
              affectedRecords: cycle,
              suggestedFix: `Break cycle by removing co-run rule between ${cycle[0]} and ${cycle[cycle.length-2]}`
            });
            break; // Only report first cycle found
          }
        }
      }
    } catch (error) {
      // If cycle detection fails, add a warning
      errors.push({
        id: 'cycle_detection_error',
        type: 'calculation_error',
        severity: 'warning',
        entity: 'rules',
        message: 'Unable to detect circular dependencies due to rule format issues',
        suggestedFix: 'Check co-run rule formatting'
      });
    }
    
    return errors;
  }

  /**
   * Helper methods
   */
  
  static calculatePhaseCapacity(workersData) {
    const capacity = {};
    
    workersData.forEach(worker => {
      if (worker.AvailableSlots) {
        try {
          const slots = Array.isArray(worker.AvailableSlots) 
            ? worker.AvailableSlots 
            : JSON.parse(worker.AvailableSlots);
          
          slots.forEach(phase => {
            capacity[phase] = (capacity[phase] || 0) + 1;
          });
        } catch (e) {
          // Skip malformed data
        }
      }
    });
    
    return capacity;
  }

  static calculatePhaseDemand(tasksData) {
    const demand = {};
    
    tasksData.forEach(task => {
      if (task.Duration && task.PreferredPhases) {
        try {
          const duration = parseInt(task.Duration);
          let phases = [];
          
          // Handle PreferredPhases as array or string
          phases = this.safePhaseConvert(task.PreferredPhases);
          
          // Each phase in preferred phases needs duration slots
          phases.forEach(phase => {
            demand[phase] = (demand[phase] || 0) + duration;
          });
        } catch (e) {
          // Skip malformed data
        }
      }
    });
    
    return demand;
  }

  static taskUsesPhase(task, phase) {
    if (!task.PreferredPhases) return false;
    
    try {
      // Handle PreferredPhases as array or string
      const phases = this.safePhaseConvert(task.PreferredPhases);
      return phases.includes(phase);
    } catch (e) {
      return false;
    }
  }

  static aggregateResults(results) {
    const allErrors = [];
    const allWarnings = [];
    
    Object.values(results).forEach(categoryResults => {
      categoryResults.forEach(result => {
        if (result.severity === 'error') {
          allErrors.push(result);
        } else if (result.severity === 'warning') {
          allWarnings.push(result);
        }
      });
    });
    
    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      summary: {
        totalErrors: allErrors.length,
        totalWarnings: allWarnings.length,
        validationTypes: Object.keys(results),
        timestamp: new Date().toISOString(),
        breakdown: {
          structural: results.structural.length,
          referential: results.referential.length,
          business: results.business.length,
          operational: results.operational.length
        }
      }
    };
  }

  /**
   * Get validation summary for dashboard
   */
  static async getValidationSummary(clientsData, workersData, tasksData) {
    const validationResult = await this.validateAllData(clientsData, workersData, tasksData);
    
    return {
      isValid: validationResult.isValid,
      totalRecords: clientsData.length + workersData.length + tasksData.length,
      totalErrors: validationResult.summary.totalErrors,
      totalWarnings: validationResult.summary.totalWarnings,
      entityBreakdown: {
        clients: {
          records: clientsData.length,
          errors: validationResult.errors.filter(e => e.entity === 'clients').length,
          warnings: validationResult.warnings.filter(w => w.entity === 'clients').length
        },
        workers: {
          records: workersData.length,
          errors: validationResult.errors.filter(e => e.entity === 'workers').length,
          warnings: validationResult.warnings.filter(w => w.entity === 'workers').length
        },
        tasks: {
          records: tasksData.length,
          errors: validationResult.errors.filter(e => e.entity === 'tasks').length,
          warnings: validationResult.warnings.filter(w => w.entity === 'tasks').length
        }
      },
      lastValidated: new Date().toISOString()
    };
  }

  /**
   * Apply suggested fixes (placeholder for future implementation)
   */
  static async applyFix(fix) {
    // This would contain logic to automatically apply fixes
    // For now, return a placeholder response
    return {
      fixId: fix.id,
      success: false,
      message: 'Auto-fix not yet implemented for this validation type'
    };
  }
} 