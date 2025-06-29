import dataStore from '../../dataStore.js';
import { v4 as uuidv4 } from 'uuid';

// Supported rule types
const SUPPORTED_RULE_TYPES = [
  'coRun',
  'slotRestriction', 
  'loadLimit',
  'phaseWindow',
  'patternMatch',
  'precedenceOverride'
];

/**
 * Add a new rule to the system
 * @param {Object} ruleObject - The rule to add
 * @returns {Promise<Object>} The created rule with ID and metadata
 */
export async function addRule(ruleObject) {
  try {
    // Validate input
    if (!ruleObject || typeof ruleObject !== 'object') {
      throw new Error('Rule object is required');
    }

    if (!ruleObject.type || !SUPPORTED_RULE_TYPES.includes(ruleObject.type)) {
      throw new Error(`Invalid rule type. Supported types: ${SUPPORTED_RULE_TYPES.join(', ')}`);
    }

    // Create normalized rule with ID and metadata
    const normalizedRule = {
      id: ruleObject.id || `rule-${uuidv4()}`,
      type: ruleObject.type,
      name: ruleObject.name || `Rule ${ruleObject.type}`,
      description: ruleObject.description || '',
      condition: ruleObject.condition || '',
      action: ruleObject.action || '',
      priority: ruleObject.priority || 5,
      isActive: ruleObject.isActive !== undefined ? ruleObject.isActive : true,
      ...ruleObject,
      metadata: {
        createdBy: ruleObject.metadata?.createdBy || 'System',
        createdAt: ruleObject.metadata?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...ruleObject.metadata
      }
    };

    // Validate the rule
    const validation = await validateRule(normalizedRule, dataStore);
    if (!validation.valid) {
      throw new Error(`Rule validation failed: ${validation.errors.join(', ')}`);
    }

    // Store the rule
    const currentRules = dataStore.getRules() || [];
    
    // Check for duplicate ID
    if (currentRules.find(rule => rule.id === normalizedRule.id)) {
      throw new Error(`Rule with ID ${normalizedRule.id} already exists`);
    }

    currentRules.push(normalizedRule);
    dataStore.setRules(currentRules);

    return normalizedRule;
  } catch (error) {
    throw new Error(`Failed to add rule: ${error.message}`);
  }
}

/**
 * Retrieve all rules
 * @returns {Promise<Array>} Array of all rules
 */
export async function getAllRules() {
  return dataStore.getRules() || [];
}

/**
 * Delete a rule by ID
 * @param {string} ruleId - The ID of the rule to delete
 * @returns {Promise<Object>} Success/failure result
 */
export async function deleteRule(ruleId) {
  try {
    if (!ruleId) {
      throw new Error('Rule ID is required');
    }

    const currentRules = dataStore.getRules() || [];
    const ruleIndex = currentRules.findIndex(rule => rule.id === ruleId);

    if (ruleIndex === -1) {
      return { success: false, message: `Rule with ID ${ruleId} not found` };
    }

    currentRules.splice(ruleIndex, 1);
    dataStore.setRules(currentRules);

    return { success: true, message: `Rule ${ruleId} deleted successfully` };
  } catch (error) {
    return { success: false, message: `Failed to delete rule: ${error.message}` };
  }
}

/**
 * Update a rule by ID
 * @param {string} ruleId - The ID of the rule to update
 * @param {Object} updatedFields - Fields to update
 * @returns {Promise<Object>} The updated rule
 */
export async function updateRule(ruleId, updatedFields) {
  try {
    if (!ruleId) {
      throw new Error('Rule ID is required');
    }

    const currentRules = dataStore.getRules() || [];
    const ruleIndex = currentRules.findIndex(rule => rule.id === ruleId);

    if (ruleIndex === -1) {
      throw new Error(`Rule with ID ${ruleId} not found`);
    }

    // Merge updated fields with existing rule
    const existingRule = currentRules[ruleIndex];
    const updatedRule = {
      ...existingRule,
      ...updatedFields,
      id: ruleId, // Preserve original ID
      metadata: {
        ...existingRule.metadata,
        ...updatedFields.metadata,
        updatedAt: new Date().toISOString()
      }
    };

    // Validate updated rule
    const validation = await validateRule(updatedRule, dataStore);
    if (!validation.valid) {
      throw new Error(`Rule validation failed: ${validation.errors.join(', ')}`);
    }

    // Update the rule
    currentRules[ruleIndex] = updatedRule;
    dataStore.setRules(currentRules);

    return updatedRule;
  } catch (error) {
    throw new Error(`Failed to update rule: ${error.message}`);
  }
}

/**
 * Check if rule has type-specific fields (vs generic fields)
 * @param {Object} rule - The rule to check
 * @returns {boolean} True if rule has type-specific fields
 */
function hasTypeSpecificFields(rule) {
  const typeSpecificFields = {
    coRun: ['tasks'],
    slotRestriction: ['targetGroup', 'minCommonSlots'],
    loadLimit: ['workerGroup', 'maxSlotsPerPhase'],
    phaseWindow: ['task', 'allowedPhases'],
    patternMatch: ['regex', 'ruleTemplate'],
    precedenceOverride: ['priorityOrder']
  };
  
  const requiredFields = typeSpecificFields[rule.type] || [];
  return requiredFields.some(field => rule.hasOwnProperty(field));
}

/**
 * Validate a rule based on its type and current data store
 * @param {Object} rule - The rule to validate
 * @param {Object} fullDataStore - The complete data store for reference validation
 * @returns {Promise<Object>} Validation result with valid flag and errors array
 */
export async function validateRule(rule, fullDataStore) {
  const errors = [];

  // Basic validation
  if (!rule.id) {
    errors.push('Rule ID is required');
  }

  if (!rule.type || !SUPPORTED_RULE_TYPES.includes(rule.type)) {
    errors.push(`Invalid rule type: ${rule.type}`);
  }

  // Type-specific validation (only if rule has type-specific fields)
  try {
    const validator = ruleValidators[rule.type];
    if (validator && hasTypeSpecificFields(rule)) {
      const typeValidation = await validator(rule, fullDataStore);
      if (!typeValidation.valid) {
        errors.push(...typeValidation.errors);
      }
    }
  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Export all rules as JSON
 * @returns {Promise<string>} JSON string of all rules
 */
export async function exportRulesAsJSON() {
  try {
    const rules = await getAllRules();
    return JSON.stringify(rules, null, 2);
  } catch (error) {
    throw new Error(`Failed to export rules: ${error.message}`);
  }
}

/**
 * Detect conflicts between rules
 * @param {Array} rules - Array of rules to check (optional, defaults to all rules)
 * @param {Object} dataStore - The data store for reference
 * @returns {Promise<Array>} Array of conflict objects
 */
export async function detectRuleConflicts(rules = null, dataStore = null) {
  try {
    const rulesToCheck = rules || await getAllRules();
    const conflicts = [];

    for (let i = 0; i < rulesToCheck.length; i++) {
      for (let j = i + 1; j < rulesToCheck.length; j++) {
        const rule1 = rulesToCheck[i];
        const rule2 = rulesToCheck[j];
        
        const conflict = detectConflictBetweenTwoRules(rule1, rule2);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  } catch (error) {
    throw new Error(`Failed to detect conflicts: ${error.message}`);
  }
}

// Rule type validators
const ruleValidators = {
  coRun: validateCoRunRule,
  slotRestriction: validateSlotRestrictionRule,
  loadLimit: validateLoadLimitRule,
  phaseWindow: validatePhaseWindowRule,
  patternMatch: validatePatternMatchRule,
  precedenceOverride: validatePrecedenceOverrideRule
};

/**
 * Validate coRun rule
 */
async function validateCoRunRule(rule, fullDataStore) {
  const errors = [];

  if (!rule.tasks || !Array.isArray(rule.tasks)) {
    errors.push('coRun rule must have tasks array');
  } else {
    if (rule.tasks.length < 2) {
      errors.push('coRun rule must have at least 2 tasks');
    }

    // Validate task IDs exist
    const tasks = fullDataStore.getTasks() || [];
    const taskIds = tasks.map(t => t.id);
    
    rule.tasks.forEach(taskId => {
      if (!taskIds.includes(taskId)) {
        errors.push(`Task ID ${taskId} does not exist`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate slotRestriction rule
 */
async function validateSlotRestrictionRule(rule, fullDataStore) {
  const errors = [];

  if (!rule.targetGroup) {
    errors.push('slotRestriction rule must have targetGroup');
  }

  if (!rule.minCommonSlots || typeof rule.minCommonSlots !== 'number' || rule.minCommonSlots < 1) {
    errors.push('slotRestriction rule must have valid minCommonSlots (positive number)');
  }

  // Validate target group exists
  const workers = fullDataStore.getWorkers() || [];
  const workerGroups = [...new Set(workers.map(w => w.group).filter(Boolean))];
  
  if (rule.targetGroup && !workerGroups.includes(rule.targetGroup)) {
    errors.push(`Target group ${rule.targetGroup} does not exist`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate loadLimit rule
 */
async function validateLoadLimitRule(rule, fullDataStore) {
  const errors = [];

  if (!rule.workerGroup) {
    errors.push('loadLimit rule must have workerGroup');
  }

  if (!rule.maxSlotsPerPhase || typeof rule.maxSlotsPerPhase !== 'number' || rule.maxSlotsPerPhase < 1) {
    errors.push('loadLimit rule must have valid maxSlotsPerPhase (positive number)');
  }

  // Validate worker group exists
  const workers = fullDataStore.getWorkers() || [];
  const workerGroups = [...new Set(workers.map(w => w.group).filter(Boolean))];
  
  if (rule.workerGroup && !workerGroups.includes(rule.workerGroup)) {
    errors.push(`Worker group ${rule.workerGroup} does not exist`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate phaseWindow rule
 */
async function validatePhaseWindowRule(rule, fullDataStore) {
  const errors = [];

  if (!rule.task) {
    errors.push('phaseWindow rule must have task');
  }

  if (!rule.allowedPhases || !Array.isArray(rule.allowedPhases)) {
    errors.push('phaseWindow rule must have allowedPhases array');
  } else {
    // Validate phases are positive integers
    rule.allowedPhases.forEach(phase => {
      if (!Number.isInteger(phase) || phase < 1) {
        errors.push(`Invalid phase: ${phase}. Phases must be positive integers`);
      }
    });
  }

  // Validate task exists
  const tasks = fullDataStore.getTasks() || [];
  const taskIds = tasks.map(t => t.id);
  
  if (rule.task && !taskIds.includes(rule.task)) {
    errors.push(`Task ${rule.task} does not exist`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate patternMatch rule
 */
async function validatePatternMatchRule(rule, fullDataStore) {
  const errors = [];

  if (!rule.regex) {
    errors.push('patternMatch rule must have regex');
  } else {
    try {
      new RegExp(rule.regex);
    } catch (error) {
      errors.push(`Invalid regex pattern: ${rule.regex}`);
    }
  }

  if (!rule.ruleTemplate) {
    errors.push('patternMatch rule must have ruleTemplate');
  } else if (!SUPPORTED_RULE_TYPES.includes(rule.ruleTemplate)) {
    errors.push(`Invalid ruleTemplate: ${rule.ruleTemplate}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate precedenceOverride rule
 */
async function validatePrecedenceOverrideRule(rule, fullDataStore) {
  const errors = [];

  if (!rule.priorityOrder || !Array.isArray(rule.priorityOrder)) {
    errors.push('precedenceOverride rule must have priorityOrder array');
  } else {
    // Validate all rule types are supported
    rule.priorityOrder.forEach(ruleType => {
      if (!SUPPORTED_RULE_TYPES.includes(ruleType)) {
        errors.push(`Invalid rule type in priorityOrder: ${ruleType}`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Detect conflicts between two specific rules
 */
function detectConflictBetweenTwoRules(rule1, rule2) {
  // CoRun vs PhaseWindow conflict
  if (rule1.type === 'coRun' && rule2.type === 'phaseWindow') {
    const commonTasks = rule1.tasks.filter(task => task === rule2.task);
    if (commonTasks.length > 0) {
      return {
        ruleId: rule1.id,
        conflictWith: rule2.id,
        message: `CoRun rule conflicts with PhaseWindow rule on task ${commonTasks[0]}`
      };
    }
  }

  // PhaseWindow vs CoRun conflict (reverse)
  if (rule1.type === 'phaseWindow' && rule2.type === 'coRun') {
    const commonTasks = rule2.tasks.filter(task => task === rule1.task);
    if (commonTasks.length > 0) {
      return {
        ruleId: rule1.id,
        conflictWith: rule2.id,
        message: `PhaseWindow rule conflicts with CoRun rule on task ${commonTasks[0]}`
      };
    }
  }

  // LoadLimit vs LoadLimit conflict (same worker group)
  if (rule1.type === 'loadLimit' && rule2.type === 'loadLimit') {
    if (rule1.workerGroup === rule2.workerGroup && rule1.maxSlotsPerPhase !== rule2.maxSlotsPerPhase) {
      return {
        ruleId: rule1.id,
        conflictWith: rule2.id,
        message: `Conflicting load limits for worker group ${rule1.workerGroup}`
      };
    }
  }

  // SlotRestriction vs SlotRestriction conflict (same target group)
  if (rule1.type === 'slotRestriction' && rule2.type === 'slotRestriction') {
    if (rule1.targetGroup === rule2.targetGroup && rule1.minCommonSlots !== rule2.minCommonSlots) {
      return {
        ruleId: rule1.id,
        conflictWith: rule2.id,
        message: `Conflicting slot restrictions for target group ${rule1.targetGroup}`
      };
    }
  }

  return null;
}

/**
 * Natural language rule handler (bonus feature)
 * @param {string} naturalLanguageRule - Natural language description of rule
 * @returns {Promise<Object>} Parsed rule object
 */
export async function parseNaturalLanguageRule(naturalLanguageRule) {
  // This is a simplified parser - in production, you'd use AI/NLP
  const rule = {};
  
  // Basic pattern matching for demo purposes
  if (naturalLanguageRule.toLowerCase().includes('run') && naturalLanguageRule.toLowerCase().includes('together')) {
    rule.type = 'coRun';
    // Extract task IDs using regex (simplified)
    const taskMatches = naturalLanguageRule.match(/T\d+/g);
    if (taskMatches && taskMatches.length >= 2) {
      rule.tasks = taskMatches;
    }
  } else if (naturalLanguageRule.toLowerCase().includes('phase') && naturalLanguageRule.toLowerCase().includes('only')) {
    rule.type = 'phaseWindow';
    // Extract task and phases (simplified)
    const taskMatch = naturalLanguageRule.match(/T\d+/);
    const phaseMatches = naturalLanguageRule.match(/phase\s+(\d+)/gi);
    if (taskMatch) rule.task = taskMatch[0];
    if (phaseMatches) {
      rule.allowedPhases = phaseMatches.map(p => parseInt(p.match(/\d+/)[0]));
    }
  }
  
  return rule;
}

// Export all functions
export {
  SUPPORTED_RULE_TYPES
};