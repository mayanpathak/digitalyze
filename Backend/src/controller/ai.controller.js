import ResponseBuilder from '../utils/responseBuilder.js';
import { 
  runNaturalLanguageQuery,
  convertToRule,
  getRuleRecommendations as getRuleRecommendationsService,
  validateWithAI,
  suggestFixes,
  getServiceHealth,
  chatWithData as chatWithDataService
} from '../services/ai.service.js';
import { validateRecords } from '../services/validation.service.js';
import dataStore from '../../dataStore.js';
import redisService from '../services/redis.service.js';

/**
 * Chat with data - enhanced conversational AI for insights
 */
export const chatWithData = async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json(
        ResponseBuilder.error('Message is required for chat')
      );
    }

    // Get comprehensive data context
    const dataContext = {
      clients: dataStore.getData('clients'),
      workers: dataStore.getData('workers'),
      tasks: dataStore.getData('tasks')
    };

    const totalRecords = dataContext.clients.length + dataContext.workers.length + dataContext.tasks.length;
    
    if (totalRecords === 0) {
      return res.json(ResponseBuilder.success({
        response: "I don't see any data in your system yet. Please upload some CSV files first, and then I can provide detailed insights about your clients, workers, and tasks.",
        suggestions: [
          "Upload client data to see customer insights",
          "Upload worker data to analyze resource allocation",
          "Upload task data to understand project patterns"
        ]
      }, 'Chat response generated'));
    }

     // Use the dedicated chat service
    const result = await chatWithDataService(message, dataContext);

    if (result.success) {
      // Format response for chat interface
      const chatResponse = {
        response: result.response,
        dataInsights: {
          totalRecords: totalRecords,
          breakdown: {
            clients: dataContext.clients.length,
            workers: dataContext.workers.length,
            tasks: dataContext.tasks.length
          }
        },
        suggestions: [
          "Ask me about data quality issues",
          "Get optimization recommendations",
          "Analyze resource allocation patterns",
          "Identify priority distributions"
        ]
      };

      res.json(ResponseBuilder.success(chatResponse, 'Chat response generated'));
    } else {
      // Fallback response when AI service fails
      const fallbackResponse = {
        response: `I can see you have ${totalRecords} total records (${dataContext.clients.length} clients, ${dataContext.workers.length} workers, ${dataContext.tasks.length} tasks). While I'm having trouble accessing advanced AI features right now, I can help you with basic data insights. What specific aspect of your data would you like to explore?`,
        suggestions: [
          "Tell me about data distribution",
          "Show me summary statistics",
          "Help me find data quality issues"
        ]
      };

      res.json(ResponseBuilder.success(fallbackResponse, 'Fallback chat response'));
    }

  } catch (error) {
    console.error('Error in chat with data:', error);
    
    // Provide helpful fallback even on error
    const errorResponse = {
      response: "I encountered an issue while analyzing your data, but I'm still here to help! Could you try rephrasing your question or asking about a specific aspect of your data?",
      suggestions: [
        "Ask about data summaries",
        "Request specific insights",
        "Check data quality"
      ]
    };

    res.json(ResponseBuilder.success(errorResponse, 'Error fallback response'));
  }
};

/**
 * Process natural language queries with Redis caching
 */
export const queryData = async (req, res) => {
  try {
    const { query, entity = 'all' } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).json(
        ResponseBuilder.error('Query text is required')
      );
    }

    // Try Redis cache first for AI responses
    const cacheKey = `ai_query_${entity}_${query}`;
    if (redisService.isAvailable()) {
      try {
        const cachedResult = await redisService.getCachedAiResponse(cacheKey);
        if (cachedResult) {
          console.log(`[AI Controller] ✅ Redis cache hit for AI query: ${entity}`);
          return res.json(ResponseBuilder.success(
            cachedResult,
            'Natural language query processed (cached)'
          ));
        }
        console.log(`[AI Controller] 📭 Redis cache miss for AI query: ${entity}`);
      } catch (cacheError) {
        console.warn(`[AI Controller] ⚠️ Redis cache error for AI query:`, cacheError.message);
      }
    }

    // Get data from Redis-first strategy or dataStore
    let data;
    if (entity === 'all') {
      data = {
        clients: dataStore.getData('clients'),
        workers: dataStore.getData('workers'),
        tasks: dataStore.getData('tasks')
      };
    } else {
      if (!dataStore.isValidEntity(entity)) {
        return res.status(400).json(
          ResponseBuilder.error(`Invalid entity: ${entity}`)
        );
      }
      data = dataStore.getData(entity);
    }

    // Process query with AI
    let result;
    if (entity === 'all') {
      // For "all" queries, search across all entities
      const allResults = {};
      
      for (const [entityType, entityData] of Object.entries(data)) {
        if (entityData.length > 0) {
          const queryResult = await runNaturalLanguageQuery(entityType, query, entityData);
          if (queryResult.success) {
            allResults[entityType] = queryResult;
          }
        }
      }
      
      result = {
        success: Object.keys(allResults).length > 0,
        results: allResults,
        query: query
      };
    } else {
      result = await runNaturalLanguageQuery(entity, query, data);
    }

    // Cache the successful result in Redis
    if (result.success && redisService.isAvailable()) {
      try {
        await redisService.cacheAiResponse(cacheKey, result);
        console.log(`[AI Controller] ✅ Cached AI query result in Redis`);
      } catch (cacheError) {
        console.warn(`[AI Controller] ⚠️ Failed to cache AI query result:`, cacheError.message);
      }
    }

    if (result.success) {
      res.json(ResponseBuilder.success(
        result,
        'Natural language query processed successfully'
      ));
    } else {
      res.status(400).json(
        ResponseBuilder.error('Query processing failed', result.error)
      );
    }

  } catch (error) {
    console.error('Error processing natural language query:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to process query', error.message)
    );
  }
};

/**
 * Generate rules from natural language with Redis caching
 */
export const generateRule = async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || description.trim() === '') {
      return res.status(400).json(
        ResponseBuilder.error('Rule description is required')
      );
    }

    // Try Redis cache first for rule generation
    const cacheKey = `ai_rule_generation_${description}`;
    if (redisService.isAvailable()) {
      try {
        const cachedRule = await redisService.getCachedAiResponse(cacheKey);
        if (cachedRule) {
          console.log(`[AI Controller] ✅ Redis cache hit for rule generation`);
          return res.json(ResponseBuilder.success(
            cachedRule,
            'Rule generated from natural language (cached)'
          ));
        }
        console.log(`[AI Controller] 📭 Redis cache miss for rule generation`);
      } catch (cacheError) {
        console.warn(`[AI Controller] ⚠️ Redis cache error for rule generation:`, cacheError.message);
      }
    }

    // Get context data from dataStore
    const dataContext = {
      clients: dataStore.getData('clients'),
      workers: dataStore.getData('workers'),
      tasks: dataStore.getData('tasks')
    };

    // Convert natural language to rule using AI
    const result = await convertToRule(description, dataContext);

    // Cache the successful result in Redis
    if (result.success && redisService.isAvailable()) {
      try {
        await redisService.cacheAiResponse(cacheKey, result);
        console.log(`[AI Controller] ✅ Cached rule generation result in Redis`);
      } catch (cacheError) {
        console.warn(`[AI Controller] ⚠️ Failed to cache rule generation result:`, cacheError.message);
      }
    }

    if (result.success) {
      // Extract the rule from the result and format it for frontend
      const rule = result.rule || result;
      const formattedRule = {
        name: rule.name || `${rule.type} Rule`,
        description: rule.reason || rule.description || 'AI generated rule',
        condition: rule.condition || '',
        action: rule.action || '',
        confidence: rule.confidence || result.confidence || 0.8,
        type: rule.type || 'patternMatch'
      };
      
      res.json(formattedRule);
    } else {
      res.status(400).json(
        ResponseBuilder.error('Rule generation failed', result.error)
      );
    }

  } catch (error) {
    console.error('Error generating rule from natural language:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to generate rule', error.message)
    );
  }
};

/**
 * Get AI-powered rule recommendations with Redis caching
 */
export const getRuleRecommendations = async (req, res) => {
  try {
    // Get full data store context
    const fullDataStore = {
      clients: dataStore.getData('clients'),
      workers: dataStore.getData('workers'),
      tasks: dataStore.getData('tasks'),
      rules: dataStore.getRules()
    };

    // Check if we have any data to work with
    const totalRecords = fullDataStore.clients.length + fullDataStore.workers.length + fullDataStore.tasks.length;
    
    if (totalRecords === 0) {
      return res.json(ResponseBuilder.success(
        {
          recommendations: [],
          fromCache: false,
          datasetSize: {
            clients: 0,
            workers: 0,
            tasks: 0
          },
          message: 'No data available for rule recommendations. Please upload some data first.'
        },
        'No data available for recommendations'
      ));
    }

    // This function already has Redis caching built-in
    const result = await getRuleRecommendationsService(fullDataStore);

    if (result.success) {
      res.json(ResponseBuilder.success(
        {
          recommendations: result.recommendations || [],
          fromCache: result.fromCache || false,
          datasetSize: {
            clients: fullDataStore.clients.length,
            workers: fullDataStore.workers.length,
            tasks: fullDataStore.tasks.length
          }
        },
        'Rule recommendations generated successfully'
      ));
    } else {
      // Provide fallback recommendations when AI fails
      const fallbackRecommendations = generateFallbackRecommendations(fullDataStore);
      
      res.json(ResponseBuilder.success(
        {
          recommendations: fallbackRecommendations,
          fromCache: false,
          datasetSize: {
            clients: fullDataStore.clients.length,
            workers: fullDataStore.workers.length,
            tasks: fullDataStore.tasks.length
          },
          fallback: true,
          message: 'AI service unavailable, showing basic recommendations'
        },
        'Fallback recommendations provided'
      ));
    }

  } catch (error) {
    console.error('Error getting rule recommendations:', error);
    
    // Try to provide fallback recommendations even on error
    try {
      const fullDataStore = {
        clients: dataStore.getData('clients'),
        workers: dataStore.getData('workers'),
        tasks: dataStore.getData('tasks'),
        rules: dataStore.getRules()
      };
      
      const fallbackRecommendations = generateFallbackRecommendations(fullDataStore);
      
      res.json(ResponseBuilder.success(
        {
          recommendations: fallbackRecommendations,
          fromCache: false,
          datasetSize: {
            clients: fullDataStore.clients.length,
            workers: fullDataStore.workers.length,
            tasks: fullDataStore.tasks.length
          },
          fallback: true,
          error: error.message
        },
        'Fallback recommendations due to error'
      ));
    } catch (fallbackError) {
      res.status(500).json(
        ResponseBuilder.error('Failed to get rule recommendations', error.message)
      );
    }
  }
};

// Helper function to generate basic recommendations when AI fails
function generateFallbackRecommendations(dataStore) {
  const recommendations = [];
  const { clients, workers, tasks } = dataStore;
  
  // Basic load balancing recommendation
  if (workers.length > 0 && tasks.length > 0) {
    recommendations.push({
      type: 'loadLimit',
      priority: 'medium',
      reason: 'Balance workload across available workers to prevent overallocation',
      suggestedRule: {
        type: 'loadLimit',
        target: 'WorkerGroup',
        targetValue: 'all',
        maxLoad: Math.ceil(tasks.length / workers.length)
      },
      expectedBenefit: 'Improved resource utilization and reduced worker overload',
      confidence: 0.75,
      fallback: true
    });
  }
  
  // Phase window recommendation if tasks have phases
  const tasksWithPhases = tasks.filter(t => t.PreferredPhases || t.Phase);
  if (tasksWithPhases.length > 0) {
    recommendations.push({
      type: 'phaseWindow',
      priority: 'low',
      reason: 'Organize tasks by phases to improve scheduling efficiency',
      suggestedRule: {
        type: 'phaseWindow',
        entity: 'tasks',
        allowedPhases: [1, 2, 3],
        reason: 'Group tasks by execution phases'
      },
      expectedBenefit: 'Better task organization and scheduling',
      confidence: 0.70,
      fallback: true
    });
  }
  
  return recommendations;
}

/**
 * Extended AI validation with Redis caching
 */
export const validateExtended = async (req, res) => {
  try {
    const { entity } = req.body;

    if (!entity || !dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid or missing entity: ${entity}`)
      );
    }

    // Try Redis cache first for validation results
    const data = dataStore.getData(entity);
    const cacheKey = `ai_validation_${entity}_${data.length}`;
    
    if (redisService.isAvailable()) {
      try {
        const cachedValidation = await redisService.getCachedAiResponse(cacheKey);
        if (cachedValidation) {
          console.log(`[AI Controller] ✅ Redis cache hit for AI validation: ${entity}`);
          return res.json(ResponseBuilder.success(
            cachedValidation,
            'AI validation completed (cached)'
          ));
        }
        console.log(`[AI Controller] 📭 Redis cache miss for AI validation: ${entity}`);
      } catch (cacheError) {
        console.warn(`[AI Controller] ⚠️ Redis cache error for AI validation:`, cacheError.message);
      }
    }

    if (data.length === 0) {
      return res.json(ResponseBuilder.success(
        { issues: [], summary: { totalRecords: 0, issuesFound: 0 } },
        'No data to validate'
      ));
    }

    // Perform AI validation
    const result = await validateWithAI(entity, data);

    // Cache the successful result in Redis
    if (result.success && redisService.isAvailable()) {
      try {
        await redisService.cacheAiResponse(cacheKey, result);
        console.log(`[AI Controller] ✅ Cached AI validation result in Redis`);
      } catch (cacheError) {
        console.warn(`[AI Controller] ⚠️ Failed to cache AI validation result:`, cacheError.message);
      }
    }

    if (result.success) {
      res.json(ResponseBuilder.success(
        result,
        'AI validation completed successfully'
      ));
    } else {
      res.status(400).json(
        ResponseBuilder.error('AI validation failed', result.error)
      );
    }

  } catch (error) {
    console.error('Error in AI validation:', error);
    res.status(500).json(
      ResponseBuilder.error('Failed to perform AI validation', error.message)
    );
  }
};

/**
 * AI-powered error fixing
 */
export const fixErrors = async (req, res) => {
  try {
    const { errors, entity } = req.body;

    if (!errors || !Array.isArray(errors)) {
      return res.status(400).json(
        ResponseBuilder.error('Errors array is required')
      );
    }

    if (!entity) {
      return res.status(400).json(
        ResponseBuilder.error('Entity is required')
      );
    }

    // Validate entity
    if (!dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid entity: ${entity}`)
      );
    }

    // Get entity data
    const entityData = dataStore.getData(entity);

    // Get fix suggestions
    const result = await suggestFixes(errors, entityData);

    if (!result.success) {
      return res.status(400).json(
        ResponseBuilder.error('Fix suggestion failed', result.error)
      );
    }

    res.json(ResponseBuilder.success(
      {
        fixes: result.fixes,
        count: result.fixes.length
      },
      'Fix suggestions generated successfully'
    ));

  } catch (error) {
    console.error('Error in fixErrors:', error);
    res.status(500).json(
      ResponseBuilder.error('Fix suggestion failed', error.message)
    );
  }
};

/**
 * Data enhancement suggestions
 */
export const enhanceData = async (req, res) => {
  try {
    const { entity } = req.body;

    if (!entity) {
      return res.status(400).json(
        ResponseBuilder.error('Entity is required')
      );
    }

    // Validate entity
    if (!dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid entity: ${entity}`)
      );
    }

    // Get data
    const data = dataStore.getData(entity);

    if (data.length === 0) {
      return res.json(ResponseBuilder.success(
        { suggestions: [] },
        'No data available for enhancement'
      ));
    }

    // For now, return basic enhancement suggestions
    // This can be expanded with actual AI-powered enhancement logic
    const suggestions = [
      {
        type: 'data_quality',
        priority: 'medium',
        suggestion: 'Consider adding more detailed descriptions to improve data richness',
        confidence: 0.8
      },
      {
        type: 'standardization',
        priority: 'high',
        suggestion: 'Standardize field formats across all records',
        confidence: 0.9
      }
    ];

    res.json(ResponseBuilder.success(
      { suggestions },
      'Enhancement suggestions generated'
    ));

  } catch (error) {
    console.error('Error in enhanceData:', error);
    res.status(500).json(
      ResponseBuilder.error('Enhancement suggestion failed', error.message)
    );
  }
};

/**
 * Generate insights from data
 */
export const generateInsights = async (req, res) => {
  try {
    const { entity } = req.body;

    if (!entity) {
      return res.status(400).json(
        ResponseBuilder.error('Entity is required')
      );
    }

    // Validate entity
    if (!dataStore.isValidEntity(entity)) {
      return res.status(400).json(
        ResponseBuilder.error(`Invalid entity: ${entity}`)
      );
    }

    // Get data
    const data = dataStore.getData(entity);

    if (data.length === 0) {
      return res.json(ResponseBuilder.success(
        { insights: [] },
        'No data available for insights'
      ));
    }

    // Generate basic insights
    const insights = [];

    // Data volume insight
    insights.push({
      type: 'volume',
      title: 'Data Volume',
      description: `Dataset contains ${data.length} ${entity} records`,
      value: data.length,
      confidence: 1.0
    });

    // Entity-specific insights
    if (entity === 'tasks') {
      const skillCounts = {};
      const statusCounts = {};
      const priorityCounts = {};
      
      data.forEach(task => {
        // Skills analysis
        if (task.RequiredSkills) {
          const skills = Array.isArray(task.RequiredSkills) ? task.RequiredSkills : task.RequiredSkills.split(',');
          skills.forEach(skill => {
            const cleanSkill = skill.trim();
            skillCounts[cleanSkill] = (skillCounts[cleanSkill] || 0) + 1;
          });
        }
        
        // Status analysis
        if (task.Status) {
          statusCounts[task.Status] = (statusCounts[task.Status] || 0) + 1;
        }
        
        // Priority analysis
        if (task.PriorityLevel) {
          priorityCounts[task.PriorityLevel] = (priorityCounts[task.PriorityLevel] || 0) + 1;
        }
      });

      // Top skills insight
      const topSkills = Object.entries(skillCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

      if (topSkills.length > 0) {
        insights.push({
          type: 'info',
          title: 'Most Required Skills',
          description: `Top skills: ${topSkills.map(([skill, count]) => `${skill} (${count})`).join(', ')}`,
          data: topSkills,
          confidence: 0.9
        });
      }
      
      // Status distribution insight
      const pendingTasks = statusCounts['pending'] || 0;
      const totalTasks = data.length;
      if (pendingTasks > totalTasks * 0.6) {
        insights.push({
          type: 'warning',
          title: 'High Pending Task Load',
          description: `${pendingTasks} out of ${totalTasks} tasks are pending (${Math.round(pendingTasks/totalTasks*100)}%). Consider resource reallocation.`,
          data: statusCounts,
          confidence: 0.8
        });
      } else if (pendingTasks > 0) {
        insights.push({
          type: 'info',
          title: 'Task Status Distribution',
          description: `${pendingTasks} pending, ${statusCounts['in_progress'] || 0} in progress, ${statusCounts['completed'] || 0} completed`,
          data: statusCounts,
          confidence: 0.9
        });
      }
      
      // Priority distribution insight
      const highPriorityTasks = Object.entries(priorityCounts)
        .filter(([priority]) => parseInt(priority) >= 4)
        .reduce((sum, [, count]) => sum + count, 0);
      
      if (highPriorityTasks > totalTasks * 0.5) {
        insights.push({
          type: 'suggestion',
          title: 'High Priority Task Concentration',
          description: `${highPriorityTasks} out of ${totalTasks} tasks are high priority. Consider load balancing or priority adjustment.`,
          data: priorityCounts,
          confidence: 0.8
        });
      }
    }
    
    // Workers insights
    if (entity === 'workers') {
      const skillCounts = {};
      const availabilityCount = {};
      
      data.forEach(worker => {
        // Skills analysis
        if (worker.Skills) {
          const skills = Array.isArray(worker.Skills) ? worker.Skills : worker.Skills.split(',');
          skills.forEach(skill => {
            const cleanSkill = skill.trim();
            skillCounts[cleanSkill] = (skillCounts[cleanSkill] || 0) + 1;
          });
        }
        
        // Availability analysis
        if (worker.Availability) {
          availabilityCount[worker.Availability] = (availabilityCount[worker.Availability] || 0) + 1;
        }
      });
      
      // Skill diversity insight
      const totalSkills = Object.keys(skillCounts).length;
      insights.push({
        type: 'info',
        title: 'Skill Diversity',
        description: `Workforce has ${totalSkills} different skills across ${data.length} workers`,
        data: skillCounts,
        confidence: 1.0
      });
      
      // Availability insight
      const availableWorkers = availabilityCount['available'] || 0;
      if (availableWorkers < data.length * 0.5) {
        insights.push({
          type: 'warning',
          title: 'Low Worker Availability',
          description: `Only ${availableWorkers} out of ${data.length} workers are available. Consider workload redistribution.`,
          data: availabilityCount,
          confidence: 0.9
        });
      }
    }
    
    // Clients insights
    if (entity === 'clients') {
      const priorityDistribution = {};
      let totalBudget = 0;
      
      data.forEach(client => {
        if (client.PriorityLevel) {
          priorityDistribution[client.PriorityLevel] = (priorityDistribution[client.PriorityLevel] || 0) + 1;
        }
        if (client.Budget) {
          totalBudget += client.Budget;
        }
      });
      
      // Budget insight
      const avgBudget = totalBudget / data.length;
      insights.push({
        type: 'info',
        title: 'Client Portfolio Overview',
        description: `${data.length} clients with average budget of $${avgBudget.toLocaleString()}`,
        data: { totalBudget, avgBudget, count: data.length },
        confidence: 1.0
      });
      
      // Priority distribution
      const highPriorityClients = (priorityDistribution[4] || 0) + (priorityDistribution[5] || 0);
      if (highPriorityClients > data.length * 0.7) {
        insights.push({
          type: 'suggestion',
          title: 'High Priority Client Concentration',
          description: `${highPriorityClients} out of ${data.length} clients are high priority. Ensure adequate resource allocation.`,
          data: priorityDistribution,
          confidence: 0.8
        });
      }
    }

    res.json(ResponseBuilder.success(
      { insights },
      'Insights generated successfully'
    ));

  } catch (error) {
    console.error('Error in generateInsights:', error);
    res.status(500).json(
      ResponseBuilder.error('Insight generation failed', error.message)
    );
  }
};

/**
 * Get AI service health
 */
export const getAIHealth = async (req, res) => {
  try {
    const result = await getServiceHealth();

    if (!result.success) {
      return res.status(503).json(
        ResponseBuilder.error('AI service unhealthy', result.error)
      );
    }

    res.json(ResponseBuilder.success(
      result.status,
      'AI service is healthy'
    ));

  } catch (error) {
    console.error('Error in getAIHealth:', error);
    res.status(500).json(
      ResponseBuilder.error('Health check failed', error.message)
    );
  }
}; 