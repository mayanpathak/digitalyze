import ResponseBuilder from '../utils/responseBuilder.js';
import {
  addRule as addRuleService,
  getAllRules,
  updateRule as updateRuleService,
  deleteRule as deleteRuleService,
  validateRule,
  detectRuleConflicts,
  parseNaturalLanguageRule,
  SUPPORTED_RULE_TYPES
} from '../services/rule.service.js';
import dataStore from '../../dataStore.js';
import redisService from '../services/redis.service.js';

/**
 * Get all rules with Redis-first strategy
 */
export const getRules = async (req, res) => {
  try {
    let rules;
    
    // Try Redis cache first
    if (redisService.isAvailable()) {
      try {
        const cacheKey = 'all_rules';
        const cachedRules = await redisService.getCache(cacheKey);
        if (cachedRules) {
          console.log(`[Rules Controller] ✅ Redis cache hit for all rules`);
          rules = cachedRules;
        } else {
          console.log(`[Rules Controller] 📭 Redis cache miss for all rules`);
          rules = await getAllRules();
          // Cache the rules for future requests
          await redisService.setCache(cacheKey, rules, 600); // 10 minutes cache
          console.log(`[Rules Controller] ✅ Cached all rules in Redis`);
        }
      } catch (cacheError) {
        console.warn(`[Rules Controller] ⚠️ Redis error, falling back to dataStore:`, cacheError.message);
        rules = await getAllRules();
      }
    } else {
      console.log(`[Rules Controller] ⚠️ Redis unavailable, using dataStore for rules`);
      rules = await getAllRules();
    }
    
    res.json(ResponseBuilder.success(
      rules,
      'Rules retrieved successfully'
    ));

  } catch (error) {
    console.error('Error getting rules:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to retrieve rules', error.message)
    );
  }
};

/**
 * Add a new rule with Redis cache invalidation
 */
export const addRule = async (req, res) => {
  try {
    const ruleData = req.body;

    if (!ruleData.type) {
      return res.status(400).json(
        ResponseBuilder.error('Rule type is required')
      );
    }

    if (!SUPPORTED_RULE_TYPES.includes(ruleData.type)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid rule type. Supported types: ${SUPPORTED_RULE_TYPES.join(', ')}`)
      );
    }

    // Add the rule to dataStore (authoritative source)
    const newRule = await addRuleService(ruleData);

    // Invalidate Redis cache for rules
    if (redisService.isAvailable()) {
      try {
        await redisService.delCache('all_rules');
        await redisService.clearCachePattern('ai:rules:*'); // Clear rule recommendations cache
        console.log(`[Rules Controller] ✅ Invalidated Redis caches after rule addition`);
      } catch (cacheError) {
        console.warn(`[Rules Controller] ⚠️ Failed to invalidate Redis cache:`, cacheError.message);
      }
    }

    res.status(201).json(ResponseBuilder.success(
      newRule,
      'Rule added successfully'
    ));

  } catch (error) {
    console.error('Error adding rule:', error);
    
    if (error.message.includes('validation failed')) {
      return res.status(400).json(
        ResponseBuilder.validationError(error.message)
      );
    }

    res.status(500).json(
      ResponseBuilder.error('Failed to add rule', error.message)
    );
  }
};

/**
 * Update a rule with Redis cache invalidation
 */
export const updateRule = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json(
        ResponseBuilder.error('Rule ID is required')
      );
    }

    // Update the rule in dataStore (authoritative source)
    const updatedRule = await updateRuleService(id, updates);

    // Invalidate Redis cache for rules
    if (redisService.isAvailable()) {
      try {
        await redisService.delCache('all_rules');
        await redisService.clearCachePattern('ai:rules:*'); // Clear rule recommendations cache
        console.log(`[Rules Controller] ✅ Invalidated Redis caches after rule update`);
      } catch (cacheError) {
        console.warn(`[Rules Controller] ⚠️ Failed to invalidate Redis cache:`, cacheError.message);
      }
    }

    res.json(ResponseBuilder.success(
      updatedRule,
      'Rule updated successfully'
    ));

  } catch (error) {
    console.error('Error updating rule:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json(
        ResponseBuilder.notFound('Rule', req.params.id)
      );
    }

    if (error.message.includes('validation failed')) {
      return res.status(400).json(
        ResponseBuilder.validationError(error.message)
      );
    }

    res.status(500).json(
      ResponseBuilder.error('Failed to update rule', error.message)
    );
  }
};

/**
 * Delete a rule with Redis cache invalidation
 */
export const deleteRule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(
        ResponseBuilder.error('Rule ID is required')
      );
    }

    // Delete the rule from dataStore (authoritative source)
    const result = await deleteRuleService(id);

    if (!result.success) {
      return res.status(404).json(
        ResponseBuilder.notFound('Rule', id)
      );
    }

    // Invalidate Redis cache for rules
    if (redisService.isAvailable()) {
      try {
        await redisService.delCache('all_rules');
        await redisService.clearCachePattern('ai:rules:*'); // Clear rule recommendations cache
        console.log(`[Rules Controller] ✅ Invalidated Redis caches after rule deletion`);
      } catch (cacheError) {
        console.warn(`[Rules Controller] ⚠️ Failed to invalidate Redis cache:`, cacheError.message);
      }
    }

    res.json(ResponseBuilder.success(
      { deletedRuleId: id },
      result.message
    ));

  } catch (error) {
    console.error('Error deleting rule:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to delete rule', error.message)
    );
  }
};

/**
 * Validate rules for conflicts and consistency
 */
export const validateRules = async (req, res) => {
  try {
    const rules = await getAllRules();
    
    if (rules.length === 0) {
      return res.json(ResponseBuilder.success(
        { conflicts: [], summary: { totalRules: 0, conflictsFound: 0 } },
        'No rules to validate'
      ));
    }

    // Get full data store for validation context
    const fullDataStore = {
      clients: dataStore.getData('clients'),
      workers: dataStore.getData('workers'),
      tasks: dataStore.getData('tasks'),
      getTasks: () => dataStore.getData('tasks'),
      getWorkers: () => dataStore.getData('workers'),
      getClients: () => dataStore.getData('clients')
    };

    // Detect conflicts
    const conflicts = await detectRuleConflicts(rules, fullDataStore);

    // Validate each rule individually
    const validationResults = [];
    for (const rule of rules) {
      const validation = await validateRule(rule, fullDataStore);
      if (!validation.valid) {
        validationResults.push({
          ruleId: rule.id,
          errors: validation.errors
        });
      }
    }

    const summary = {
      totalRules: rules.length,
      conflictsFound: conflicts.length,
      validationErrors: validationResults.length,
      validRules: rules.length - validationResults.length
    };

    res.json(ResponseBuilder.success(
      {
        conflicts,
        validationErrors: validationResults,
        summary
      },
      'Rule validation completed'
    ));

  } catch (error) {
    console.error('Error validating rules:', error);
    res.status(500).json(
      ResponseBuilder.error('Rule validation failed', error.message)
    );
  }
};

/**
 * Get priority settings with Redis-first strategy
 */
export const getPriorities = async (req, res) => {
  try {
    let priorities;
    
    // Try Redis cache first
    if (redisService.isAvailable()) {
      try {
        const cacheKey = 'priority_settings';
        const cachedPriorities = await redisService.getCache(cacheKey);
        if (cachedPriorities) {
          console.log(`[Rules Controller] ✅ Redis cache hit for priorities`);
          priorities = cachedPriorities;
        } else {
          console.log(`[Rules Controller] 📭 Redis cache miss for priorities`);
          priorities = dataStore.getPriorities();
          // Cache the priorities for future requests
          await redisService.setCache(cacheKey, priorities, 3600); // 1 hour cache
          console.log(`[Rules Controller] ✅ Cached priorities in Redis`);
        }
      } catch (cacheError) {
        console.warn(`[Rules Controller] ⚠️ Redis error, falling back to dataStore:`, cacheError.message);
        priorities = dataStore.getPriorities();
      }
    } else {
      console.log(`[Rules Controller] ⚠️ Redis unavailable, using dataStore for priorities`);
      priorities = dataStore.getPriorities();
    }
    
    res.json(ResponseBuilder.success(
      priorities,
      'Priorities retrieved successfully'
    ));

  } catch (error) {
    console.error('Error getting priorities:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to retrieve priorities', error.message)
    );
  }
};

/**
 * Set priority settings with Redis cache invalidation
 */
export const setPriorities = async (req, res) => {
  try {
    const priorities = req.body;

    // Validate priority weights
    const validKeys = ['priorityLevelWeight', 'fairnessWeight', 'costWeight'];
    const providedKeys = Object.keys(priorities);
    
    const invalidKeys = providedKeys.filter(key => !validKeys.includes(key));
    if (invalidKeys.length > 0) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid priority keys: ${invalidKeys.join(', ')}`)
      );
    }

    // Validate weight values (should be numbers between 0 and 1)
    for (const [key, value] of Object.entries(priorities)) {
      if (typeof value !== 'number' || value < 0 || value > 1) {
        return res.status(400).json(
          ResponseBuilder.error(`${key} must be a number between 0 and 1`)
        );
      }
    }

    // Check if weights sum to approximately 1 (allow small floating point differences)
    const totalWeight = Object.values(priorities).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      return res.status(400).json(
        ResponseBuilder.error('Priority weights must sum to 1.0')
      );
    }

    // Set priorities in dataStore (authoritative source)
    const updatedPriorities = dataStore.setPriorities(priorities);

    // Invalidate Redis cache for priorities
    if (redisService.isAvailable()) {
      try {
        await redisService.delCache('priority_settings');
        console.log(`[Rules Controller] ✅ Invalidated Redis cache for priorities`);
      } catch (cacheError) {
        console.warn(`[Rules Controller] ⚠️ Failed to invalidate Redis cache:`, cacheError.message);
      }
    }

    res.json(ResponseBuilder.success(
      updatedPriorities,
      'Priorities updated successfully'
    ));

  } catch (error) {
    console.error('Error setting priorities:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to set priorities', error.message)
    );
  }
};

/**
 * Parse natural language rule (bonus feature)
 */
export const parseNaturalRule = async (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json(
        ResponseBuilder.error('Rule description is required')
      );
    }

    // Parse the natural language rule
    const parsedRule = await parseNaturalLanguageRule(description);

    if (!parsedRule.type) {
      return res.status(400).json(
        ResponseBuilder.error('Could not parse rule from description. Please be more specific.')
      );
    }

    res.json(ResponseBuilder.success(
      {
        parsedRule,
        originalDescription: description
      },
      'Natural language rule parsed successfully'
    ));

  } catch (error) {
    console.error('Error parsing natural language rule:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to parse natural language rule', error.message)
    );
  }
}; 