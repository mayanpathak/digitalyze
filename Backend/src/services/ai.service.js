import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import redisService from './redis.service.js';

dotenv.config();

// Initialize Gemini AI with error handling and rate limiting
let genAI, model;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Rate limiting variables
let requestCount = 0;
let lastResetTime = Date.now();
const MAX_REQUESTS_PER_MINUTE = 15; // Conservative limit
const RESET_INTERVAL = 60 * 1000; // 1 minute

// Check if we can make a request
function canMakeRequest() {
  const now = Date.now();
  if (now - lastResetTime > RESET_INTERVAL) {
    requestCount = 0;
    lastResetTime = now;
  }
  return requestCount < MAX_REQUESTS_PER_MINUTE;
}

function incrementRequestCount() {
  requestCount++;
}

if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('[AI Service] ✅ Gemini AI initialized successfully');
  } catch (error) {
    console.error('[AI Service] ❌ Failed to initialize Gemini AI:', error.message);
  }
} else {
  console.warn('[AI Service] ⚠️ GEMINI_API_KEY not found in environment variables. AI features will use fallback responses.');
}

/**
 * Helper function to standardize Gemini API interactions with Redis caching
 * @param {string} promptString - The prompt to send to Gemini
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function getGeminiResponse(promptString, maxRetries = 2) {
  try {
    // Check if model is initialized
    if (!model) {
      return {
        success: false,
        error: 'Gemini AI model is not initialized. Please check your GEMINI_API_KEY environment variable.'
      };
    }

    // Check rate limiting FIRST
    if (!canMakeRequest()) {
      console.warn(`[AI Service] Rate limit reached (${requestCount}/${MAX_REQUESTS_PER_MINUTE}), using fallback`);
      return {
        success: false,
        error: 'Rate limit reached'
      };
    }

    // Try Redis cache first
    if (redisService.isAvailable()) {
      const cachedResponse = await redisService.getCachedAiResponse(promptString);
      if (cachedResponse) {
        console.log(`[AI Service] ✅ Redis cache hit for AI prompt`);
        return {
          success: true,
          data: cachedResponse,
          fromCache: true
        };
      }
      console.log(`[AI Service] 📭 Redis cache miss for AI prompt`);
    } else {
      console.log(`[AI Service] ⚠️ Redis unavailable, proceeding without cache`);
    }

    // If no cache hit, proceed with API call
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        console.log(`[AI Service] Sending request to Gemini (attempt ${attempt + 1}/${maxRetries})`);
        
        // Increment request count
        incrementRequestCount();
        
        const result = await model.generateContent(promptString);
        const response = await result.response;
        const text = response.text();
        
        console.log(`[AI Service] Gemini response received: ${text.substring(0, 200)}...`);
        
        // Cache the successful response in Redis
        if (redisService.isAvailable()) {
          try {
            await redisService.cacheAiResponse(promptString, text);
            console.log(`[AI Service] ✅ Cached AI response in Redis`);
          } catch (cacheError) {
            console.warn(`[AI Service] ⚠️ Failed to cache AI response:`, cacheError.message);
          }
        }
        
        return {
          success: true,
          data: text,
          fromCache: false
        };
        
      } catch (error) {
        attempt++;
        console.error(`[AI Service] Gemini API error (attempt ${attempt}):`, error.message);
        
        // Check if it's a rate limit error - if so, don't retry
        if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
          console.error(`[AI Service] Rate limit hit, stopping retries`);
          return {
            success: false,
            error: `Rate limit exceeded: ${error.message}`
          };
        }
        
        if (attempt >= maxRetries) {
          return {
            success: false,
            error: `Failed to get response from Gemini after ${maxRetries} attempts: ${error.message}`
          };
        }
        
        // Wait before retry (shorter backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  } catch (error) {
    console.error(`[AI Service] Error in getGeminiResponse:`, error.message);
    return {
      success: false,
      error: `AI service error: ${error.message}`
    };
  }
}

/**
 * Helper function to safely parse JSON responses from Gemini
 * @param {string} responseText - Raw response from Gemini
 * @returns {any} Parsed JSON object or null if parsing fails
 */
function parseGeminiJSON(responseText) {
  try {
    // Remove markdown code blocks if present
    let cleanText = responseText.replace(/```json\n?|\n?```/g, '').trim();
    
    // Handle cases where the response might contain JavaScript code or function strings
    // Look for JSON object boundaries and extract just the JSON part
    const jsonStart = cleanText.indexOf('{');
    const jsonEnd = cleanText.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
    }
    
    // Try to fix common JSON issues
    cleanText = cleanText
      .replace(/`/g, '"')  // Replace backticks with quotes
      .replace(/(\w+):\s*`([^`]*)`/g, '"$1": "$2"')  // Fix property values in backticks
      .replace(/(\w+):\s*([^",}\]]+)/g, '"$1": "$2"')  // Quote unquoted property values
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
    
    return JSON.parse(cleanText);
  } catch (error) {
    console.error('[AI Service] Failed to parse Gemini JSON response:', error.message);
    console.error('[AI Service] Raw response:', responseText.substring(0, 500));
    
    // Return a fallback structure to prevent complete failure
    return null;
  }
}

/**
 * Function 1: Natural Language Query Processing
 * Converts plain English queries into structured filters and applies them to data
 * @param {string} entity - The entity type (clients, workers, tasks)
 * @param {string} queryString - Plain English query
 * @param {Array} dataArray - Array of data objects to filter
 * @returns {Promise<{success: boolean, filteredData?: Array, interpretedFilter?: string, confidence?: number, error?: string}>}
 */
export async function runNaturalLanguageQuery(entity, queryString, dataArray) {
  try {
    console.log(`[AI Service] Processing natural language query for ${entity}: "${queryString}"`);
    
    if (!dataArray || dataArray.length === 0) {
      return {
        success: false,
        error: 'No data provided to query'
      };
    }
    
    // Get sample data structure for context
    const sampleRecord = dataArray[0];
    const columns = Object.keys(sampleRecord);
    
    const prompt = `
Convert this natural language filter into a filter description for ${entity} data:

Query: "${queryString}"

Available data columns: ${columns.join(', ')}

Sample record structure:
${JSON.stringify(sampleRecord, null, 2)}

Return ONLY a valid JSON object with this structure:
{
  "filterDescription": "Plain English description of the filter logic",
  "explanation": "Plain English explanation of what the filter does",
  "confidence": 0.95,
  "matchingFields": ["field1", "field2"],
  "filterType": "contains|equals|range|boolean"
}

IMPORTANT RULES:
1. Do NOT include any JavaScript code or functions
2. Use simple descriptions instead of code
3. Keep all values as simple strings or numbers
4. Confidence must be between 0.0 and 1.0
5. Do NOT use backticks, special characters, or code syntax

Example for "Find workers with Java skills available in phase 2":
{
  "filterDescription": "Workers who have Java in their skills and are available in phase 2",
  "explanation": "Filters for workers with Java skills and phase 2 availability",
  "confidence": 0.92,
  "matchingFields": ["Skills", "AvailableSlots"],
  "filterType": "contains"
}
`;

    const geminiResponse = await getGeminiResponse(prompt);
    
    if (!geminiResponse.success) {
      return {
        success: false,
        error: geminiResponse.error
      };
    }
    
    const parsedResponse = parseGeminiJSON(geminiResponse.data);
    
    if (!parsedResponse || !parsedResponse.filterDescription) {
      return {
        success: false,
        error: 'Failed to parse filter description from AI response'
      };
    }
    
    // Since we can't execute dynamic JavaScript safely, perform basic filtering
    // based on the parsed response fields and filter type
    let filteredData = [];
    try {
      const { matchingFields, filterType, filterDescription } = parsedResponse;
      
      // Check if this is a "show all" or "list all" type query
      const isShowAllQuery = queryString.toLowerCase().match(/^(show|list|get|find)\s+(me\s+)?(all\s+)?(\w+)s?$/i);
      const isGeneralListQuery = queryString.toLowerCase().includes('all') || 
                                queryString.toLowerCase().includes('show') ||
                                queryString.toLowerCase().includes('list');
      const isSimpleEntityQuery = queryString.toLowerCase().match(/^(clients?|workers?|tasks?)$/i);
      
      if (isShowAllQuery || isSimpleEntityQuery || (isGeneralListQuery && !queryString.includes('with') && !queryString.includes('where'))) {
        // For general "show all" queries, return all data
        console.log(`[AI Service] Detected show-all query, returning all ${entity} data`);
        filteredData = dataArray;
      } else if (matchingFields && Array.isArray(matchingFields)) {
        // Specific field-based filtering
        filteredData = dataArray.filter(item => {
          return matchingFields.some(field => {
            const fieldValue = item[field];
            if (fieldValue && typeof fieldValue === 'string') {
              return queryString.toLowerCase().split(' ').some(term => 
                fieldValue.toLowerCase().includes(term.toLowerCase())
              );
            }
            // Also check numeric fields for exact matches
            if (fieldValue !== undefined && fieldValue !== null) {
              const numericTerms = queryString.match(/\d+/g);
              if (numericTerms) {
                return numericTerms.some(term => String(fieldValue) === term);
              }
            }
            return false;
          });
        });
      } else {
        // Enhanced fallback: search across all relevant fields
        const queryTerms = queryString.toLowerCase().split(' ').filter(term => 
          term.length > 2 && !['the', 'and', 'with', 'all', 'show', 'me', 'find', 'get', 'list'].includes(term)
        );
        
        if (queryTerms.length === 0) {
          // No meaningful search terms, return all data
          filteredData = dataArray;
        } else {
          filteredData = dataArray.filter(item => {
            return Object.values(item).some(value => {
              if (value && typeof value === 'string') {
                return queryTerms.some(term => 
                  value.toLowerCase().includes(term.toLowerCase())
                );
              }
              // Check numeric values
              if (value !== undefined && value !== null) {
                const numericTerms = queryString.match(/\d+/g);
                if (numericTerms) {
                  return numericTerms.some(term => String(value) === term);
                }
              }
              return false;
            });
          });
        }
      }
    } catch (filterError) {
      console.error('[AI Service] Filter execution error:', filterError.message);
      return {
        success: false,
        error: `Filter execution failed: ${filterError.message}`
      };
    }
    
    console.log(`[AI Service] Query processed successfully. Found ${filteredData.length} results.`);
    
    return {
      success: true,
      filteredData,
      interpretedFilter: parsedResponse.explanation,
      confidence: parsedResponse.confidence || 0.8
    };
    
  } catch (error) {
    console.error('[AI Service] Error in runNaturalLanguageQuery:', error.message);
    return {
      success: false,
      error: `Query processing failed: ${error.message}`
    };
  }
}

/**
 * Function 2: Natural Language to Rule Conversion
 * Converts plain English rule descriptions into structured rule objects
 * @param {string} naturalText - Plain English rule description
 * @param {Object} dataContext - Context data from dataStore (clients, workers, tasks)
 * @returns {Promise<{success: boolean, rule?: Object, confidence?: number, error?: string}>}
 */
export async function convertToRule(naturalText, dataContext) {
  try {
    console.log(`[AI Service] Converting natural text to rule: "${naturalText}"`);
    
    // Extract available IDs for validation
    const availableTaskIDs = dataContext.tasks ? dataContext.tasks.map(t => t.TaskID) : [];
    const availableWorkerIDs = dataContext.workers ? dataContext.workers.map(w => w.WorkerID) : [];
    const availableClientIDs = dataContext.clients ? dataContext.clients.map(c => c.ClientID) : [];
    
    const prompt = `
Parse this English rule and convert it to a structured JSON rule object:

Rule: "${naturalText}"

Available Task IDs: ${availableTaskIDs.join(', ')}
Available Worker IDs: ${availableWorkerIDs.join(', ')}
Available Client IDs: ${availableClientIDs.join(', ')}

Possible rule types and their structures:

1. coRun: Tasks that must run together (for specific task IDs)
   { "type": "coRun", "tasks": ["T1", "T2"], "reason": "explanation" }

2. slotRestriction: Restrict entity to specific slots/phases
   { "type": "slotRestriction", "entity": "T3", "allowedSlots": [1, 2], "reason": "explanation" }

3. loadLimit: Limit workload for workers/groups
   { "type": "loadLimit", "target": "WorkerGroup", "targetValue": "GroupA", "maxLoad": 5, "reason": "explanation" }

4. phaseWindow: Restrict entity to specific phases (for specific IDs)
   { "type": "phaseWindow", "entity": "T3", "allowedPhases": [1, 2], "reason": "explanation" }

5. patternMatch: Pattern-based assignment rules (general rules)
   { "type": "patternMatch", "condition": "task.PriorityLevel > 5", "action": "assignToHighSkillWorker", "reason": "explanation" }

6. precedenceOverride: Override normal precedence rules
   { "type": "precedenceOverride", "condition": "task.isUrgent", "action": "prioritizeOverOthers", "reason": "explanation" }

Requirements:
1. Return ONLY a JSON object with this structure:
{
  "type": "ruletype",
  "...": "rule-specific properties",
  "reason": "Plain English explanation",
  "confidence": 0.95,
  "validatedIDs": ["list", "of", "validated", "entity", "IDs"]
}

2. For general rules (without specific IDs), use confidence 0.8-0.9
3. For specific ID-based rules, validate IDs and set confidence based on validation
4. If no specific IDs are mentioned, set validatedIDs to [] and use general rule types

Example for "Assign high priority tasks to workers with matching skills":
{
  "type": "patternMatch",
  "condition": "task.PriorityLevel > 5 && matchSkills(task.RequiredSkills, worker.Skills)",
  "action": "assignToMatchingSkillWorker",
  "priority": "high",
  "reason": "High priority tasks should be assigned to workers whose skills match the task requirements",
  "confidence": 0.85,
  "validatedIDs": []
}
`;

    const geminiResponse = await getGeminiResponse(prompt);
    
    if (!geminiResponse.success) {
      return {
        success: false,
        error: geminiResponse.error
      };
    }
    
    const parsedRule = parseGeminiJSON(geminiResponse.data);
    
    if (!parsedRule || !parsedRule.type) {
      return {
        success: false,
        error: 'Failed to parse rule object from AI response'
      };
    }
    
    // Additional validation
    const confidence = parsedRule.confidence || 0.5;
    if (confidence < 0.5) {
      return {
        success: false,
        error: `Rule parsing confidence too low (${confidence}). ${parsedRule.reason || 'Unknown issue'}`
      };
    }
    
    console.log(`[AI Service] Rule converted successfully with confidence ${confidence}`);
    
    return {
      success: true,
      rule: parsedRule,
      confidence
    };
    
  } catch (error) {
    console.error('[AI Service] Error in convertToRule:', error.message);
    return {
      success: false,
      error: `Rule conversion failed: ${error.message}`
    };
  }
}

/**
 * Function 3: AI-based Rule Recommendations with Redis caching
 * Analyzes data patterns and suggests new rules proactively
 * @param {Object} dataStore - Complete data store with clients, workers, tasks
 * @returns {Promise<{success: boolean, recommendations?: Array, error?: string}>}
 */
export async function getRuleRecommendations(dataStore) {
  try {
    console.log('[AI Service] Generating rule recommendations based on data patterns');
    
    const { clients = [], workers = [], tasks = [] } = dataStore;
    
    if (clients.length === 0 && workers.length === 0 && tasks.length === 0) {
      return {
        success: false,
        error: 'No data available for rule recommendations'
      };
    }
    
    // Create a dataset signature for caching
    const datasetSignature = JSON.stringify({
      clientCount: clients.length,
      workerCount: workers.length,
      taskCount: tasks.length,
      timestamp: Math.floor(Date.now() / (1000 * 60 * 60)) // Hour-based signature
    });
    
    // Try Redis cache first
    if (redisService.isAvailable()) {
      try {
        const cachedRecommendations = await redisService.getCachedRuleRecommendations(datasetSignature);
        if (cachedRecommendations) {
          console.log(`[AI Service] ✅ Redis cache hit for rule recommendations`);
          return {
            success: true,
            recommendations: cachedRecommendations,
            fromCache: true
          };
        }
        console.log(`[AI Service] 📭 Redis cache miss for rule recommendations`);
      } catch (cacheError) {
        console.warn(`[AI Service] ⚠️ Redis cache error for rule recommendations:`, cacheError.message);
      }
    }
    
    // Prepare data summary for analysis
    const dataSummary = {
      totalClients: clients.length,
      totalWorkers: workers.length,
      totalTasks: tasks.length,
      tasksByPhase: {},
      workersByGroup: {},
      clientTaskCounts: {},
      skillDistribution: {}
    };
    
    // Analyze patterns
    tasks.forEach(task => {
      if (task.PreferredPhases) {
        const phases = Array.isArray(task.PreferredPhases) ? task.PreferredPhases : [task.PreferredPhases];
        phases.forEach(phase => {
          dataSummary.tasksByPhase[phase] = (dataSummary.tasksByPhase[phase] || 0) + 1;
        });
      }
      
      if (task.RequiredSkills) {
        const skills = Array.isArray(task.RequiredSkills) ? task.RequiredSkills : task.RequiredSkills.split(',');
        skills.forEach(skill => {
          const cleanSkill = skill.trim();
          dataSummary.skillDistribution[cleanSkill] = (dataSummary.skillDistribution[cleanSkill] || 0) + 1;
        });
      }
    });
    
    workers.forEach(worker => {
      if (worker.WorkerGroup) {
        dataSummary.workersByGroup[worker.WorkerGroup] = (dataSummary.workersByGroup[worker.WorkerGroup] || 0) + 1;
      }
    });
    
    clients.forEach(client => {
      dataSummary.clientTaskCounts[client.ClientID] = client.RequestedTasks ? client.RequestedTasks.length : 0;
    });
    
    const prompt = `
Analyze this dataset and recommend up to 3 operational rules based on patterns and potential optimization opportunities.

Data Summary:
${JSON.stringify(dataSummary, null, 2)}

Sample records:
Tasks (first 3): ${JSON.stringify(tasks.slice(0, 3), null, 2)}
Workers (first 3): ${JSON.stringify(workers.slice(0, 3), null, 2)}
Clients (first 3): ${JSON.stringify(clients.slice(0, 3), null, 2)}

Analyze for:
1. Workload imbalances (phases, worker groups)
2. Common task co-occurrences
3. Skill bottlenecks
4. Client patterns
5. Resource optimization opportunities

Return ONLY a valid JSON object with this exact structure:
{
  "recommendations": [
    {
      "type": "coRun",
      "priority": "high",
      "reason": "detailed explanation of the pattern observed",
      "suggestedRule": {
        "type": "coRun",
        "tasks": ["T1", "T2"],
        "reason": "explanation"
      },
      "expectedBenefit": "description of expected improvement",
      "confidence": 0.85
    }
  ]
}

IMPORTANT RULES:
1. Use ONLY these rule types: coRun, phaseWindow, loadLimit, slotRestriction, precedenceOverride
2. Use ONLY these priorities: high, medium, low
3. Confidence must be a number between 0.0 and 1.0
4. Do NOT include any code, functions, or backticks in the JSON
5. Do NOT use any special characters that break JSON parsing
6. Keep all string values simple and avoid complex expressions

Focus on actionable recommendations with high confidence (>0.7).
`;

    const geminiResponse = await getGeminiResponse(prompt);
    
    if (!geminiResponse.success) {
      return {
        success: false,
        error: geminiResponse.error
      };
    }
    
    const parsedRecommendations = parseGeminiJSON(geminiResponse.data);
    
    if (!parsedRecommendations || !parsedRecommendations.recommendations) {
      return {
        success: false,
        error: 'Failed to parse recommendations from AI response'
      };
    }
    
    // Filter recommendations by confidence threshold
    const highConfidenceRecs = parsedRecommendations.recommendations.filter(rec => 
      rec.confidence && rec.confidence >= 0.7
    );
    
    // Cache the results in Redis
    if (redisService.isAvailable() && !geminiResponse.fromCache) {
      try {
        await redisService.cacheRuleRecommendations(datasetSignature, highConfidenceRecs);
        console.log(`[AI Service] ✅ Cached rule recommendations in Redis`);
      } catch (cacheError) {
        console.warn(`[AI Service] ⚠️ Failed to cache rule recommendations:`, cacheError.message);
      }
    }
    
    console.log(`[AI Service] Generated ${highConfidenceRecs.length} high-confidence rule recommendations`);
    
    return {
      success: true,
      recommendations: highConfidenceRecs,
      fromCache: geminiResponse.fromCache || false
    };
    
  } catch (error) {
    console.error('[AI Service] Error in getRuleRecommendations:', error.message);
    return {
      success: false,
      error: `Rule recommendation generation failed: ${error.message}`
    };
  }
}

/**
 * Function 4: AI-powered Data Validation
 * Performs soft validation and pattern analysis beyond hard rules
 * @param {string} entity - Entity type (clients, workers, tasks)
 * @param {Array} dataArray - Array of data objects to validate
 * @returns {Promise<{success: boolean, issues?: Array, summary?: Object, error?: string}>}
 */
export async function validateWithAI(entity, dataArray) {
  try {
    console.log(`[AI Service] Running AI validation for ${entity} data (${dataArray.length} records)`);
    
    if (!dataArray || dataArray.length === 0) {
      return {
        success: true,
        issues: [],
        summary: { totalRecords: 0, issuesFound: 0 }
      };
    }
    
    // Get sample for structure analysis
    const sampleSize = Math.min(10, dataArray.length);
    const sampleData = dataArray.slice(0, sampleSize);
    
    const prompt = `
Analyze this ${entity} dataset for inconsistencies, anomalies, and potential data quality issues:

Entity Type: ${entity}
Total Records: ${dataArray.length}
Sample Records: ${JSON.stringify(sampleData, null, 2)}

Look for:
1. Data inconsistencies (e.g., mismatched skills vs task complexity)
2. Anomalous values (e.g., unusual durations, loads, or phases)
3. Missing or incomplete data patterns
4. Business logic violations
5. Format inconsistencies

For each issue found, assess severity: low, medium, high

Return ONLY a JSON object:
{
  "issues": [
    {
      "rowId": "unique identifier of the problematic record",
      "field": "specific field with the issue",
      "message": "clear description of the problem",
      "severity": "low|medium|high",
      "suggestedValue": "optional: suggested correction",
      "confidence": 0.85
    }
  ],
  "summary": {
    "totalRecords": ${dataArray.length},
    "issuesFound": "number of issues",
    "severityBreakdown": {
      "high": 0,
      "medium": 0,
      "low": 0
    }
  }
}

Focus on issues with confidence > 0.6. Be specific about what makes each value problematic.
`;

    const geminiResponse = await getGeminiResponse(prompt);
    
    if (!geminiResponse.success) {
      return {
        success: false,
        error: geminiResponse.error
      };
    }
    
    const validationResult = parseGeminiJSON(geminiResponse.data);
    
    if (!validationResult) {
      return {
        success: false,
        error: 'Failed to parse validation results from AI response'
      };
    }
    
    // Filter issues by confidence threshold
    const reliableIssues = (validationResult.issues || []).filter(issue => 
      issue.confidence && issue.confidence >= 0.6
    );
    
    // Update summary
    const summary = validationResult.summary || {};
    summary.issuesFound = reliableIssues.length;
    summary.severityBreakdown = {
      high: reliableIssues.filter(i => i.severity === 'high').length,
      medium: reliableIssues.filter(i => i.severity === 'medium').length,
      low: reliableIssues.filter(i => i.severity === 'low').length
    };
    
    console.log(`[AI Service] Validation completed. Found ${reliableIssues.length} issues`);
    
    return {
      success: true,
      issues: reliableIssues,
      summary
    };
    
  } catch (error) {
    console.error('[AI Service] Error in validateWithAI:', error.message);
    return {
      success: false,
      error: `AI validation failed: ${error.message}`
    };
  }
}

/**
 * Function 5: AI-based Data Auto-correction Suggestions
 * Suggests specific fixes for identified validation errors
 * @param {Array} validationErrors - Array of validation issues
 * @param {Array} entityData - The original entity data
 * @returns {Promise<{success: boolean, fixes?: Array, error?: string}>}
 */
export async function suggestFixes(validationErrors, entityData) {
  try {
    console.log(`[AI Service] Generating fix suggestions for ${validationErrors.length} validation errors`);
    
    if (!validationErrors || validationErrors.length === 0) {
      return {
        success: true,
        fixes: []
      };
    }
    
    // Check if AI model is available OR if we're over quota
    if (!model || process.env.DISABLE_GEMINI_AI === 'true') {
      console.warn('[AI Service] Gemini AI not available or disabled, generating basic fix suggestions');
      return generateBasicFixes(validationErrors, entityData);
    }
    
    // Group errors by record for context
    const errorsByRecord = {};
    validationErrors.forEach(error => {
      const recordId = error.id || error.rowId;
      if (!errorsByRecord[recordId]) {
        // Find record by matching various ID patterns
        let record = null;
        
        // First try exact ID match
        record = entityData.find(item => 
          item.id === recordId || 
          item.TaskID === recordId || 
          item.WorkerID === recordId || 
          item.ClientID === recordId
        );
        
        // If not found, try index-based matching for validation error IDs like "clients-1", "tasks-2"
        if (!record) {
          const match = recordId.match(/^(clients|workers|tasks)-(\d+)$/);
          if (match) {
            const entityType = match[1];
            const rowNumber = parseInt(match[2]); // This is 1-based from validation
            const recordIndex = rowNumber - 1; // Convert to 0-based array index
            
            if (recordIndex >= 0 && recordIndex < entityData.length) {
              record = entityData[recordIndex];
              
              // Update the recordId to use the actual entity ID for the fix
              const actualId = record.TaskID || record.WorkerID || record.ClientID || record.id;
              if (actualId) {
                console.log(`[AI Service] Mapped validation ID ${recordId} to actual ID ${actualId}`);
                // We'll need to update the recordId in the fix response
              }
            }
          }
        }
        
        errorsByRecord[recordId] = {
          record: record || null,
          errors: []
        };
      }
      errorsByRecord[recordId].errors.push(error);
    });
    
    const fixes = [];
    let processedCount = 0;
    const maxProcessedRecords = 10; // Limit processing to prevent infinite loops
    
    for (const [recordId, { record, errors }] of Object.entries(errorsByRecord)) {
      // Break if we've processed too many records
      if (processedCount >= maxProcessedRecords) {
        console.warn(`[AI Service] Reached max processed records limit (${maxProcessedRecords}), using basic fixes for remaining`);
        const remainingErrors = Object.values(errorsByRecord).slice(processedCount).flatMap(({ errors }) => errors);
        const basicFixes = generateBasicFixes(remainingErrors, entityData);
        fixes.push(...basicFixes.fixes);
        break;
      }
      
      // Skip if no record found
      if (!record) {
        console.warn(`[AI Service] No record found for ID: ${recordId}`);
        processedCount++;
        continue;
      }
      
      const prompt = `
Suggest specific fixes for these data validation errors:

Record ID: ${recordId}
Current Record: ${JSON.stringify(record, null, 2)}

Validation Errors:
${errors.map(err => `- Field: ${err.field}, Issue: ${err.error || err.message}, Severity: ${err.severity || 'medium'}`).join('\n')}

For each error, suggest:
1. The exact corrected value
2. Explanation of why this fix is appropriate
3. Any side effects or considerations

Return ONLY a JSON object:
{
  "fixes": [
    {
      "rowId": "${recordId}",
      "field": "field name",
      "currentValue": "current problematic value",
      "suggestedValue": "corrected value",
      "reason": "explanation of the fix",
      "confidence": 0.9,
      "autoApplyable": true,
      "sideEffects": ["list of potential impacts"]
    }
  ]
}

Ensure suggested values are:
- Properly formatted for the field type
- Consistent with data patterns
- Realistic and business-appropriate
`;

      const geminiResponse = await getGeminiResponse(prompt);
      
      if (geminiResponse.success) {
        const fixSuggestions = parseGeminiJSON(geminiResponse.data);
        if (fixSuggestions && fixSuggestions.fixes) {
          // Map validation IDs to actual record IDs in the fixes
          const mappedFixes = fixSuggestions.fixes.map(fix => {
            const actualId = record.TaskID || record.WorkerID || record.ClientID || record.id;
            return {
              ...fix,
              rowId: actualId || fix.rowId, // Use actual entity ID if available
              originalValidationId: recordId // Keep track of original validation error ID
            };
          });
          fixes.push(...mappedFixes.filter(fix => fix.confidence >= 0.7));
        }
      } else if (geminiResponse.error && (geminiResponse.error.includes('429') || geminiResponse.error.includes('Rate limit'))) {
        // Rate limit hit, fall back to basic fixes for all remaining errors
        console.warn('[AI Service] Rate limit hit, falling back to basic fixes for all remaining errors');
        const allRemainingErrors = Object.values(errorsByRecord).flatMap(({ errors }) => errors);
        const basicFixes = generateBasicFixes(allRemainingErrors, entityData);
        fixes.push(...basicFixes.fixes);
        break; // Stop trying more Gemini requests
      } else {
        // Other error, generate basic fix for this record
        console.warn(`[AI Service] Error for record ${recordId}, using basic fix:`, geminiResponse.error);
        const basicFixes = generateBasicFixes(errors, entityData);
        fixes.push(...basicFixes.fixes);
      }
      
      processedCount++;
      
      // Add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`[AI Service] Generated ${fixes.length} fix suggestions`);
    
    return {
      success: true,
      fixes
    };
    
  } catch (error) {
    console.error('[AI Service] Error in suggestFixes:', error.message);
    return {
      success: false,
      error: `Fix suggestion generation failed: ${error.message}`
    };
  }
}

/**
 * Generate basic fix suggestions when AI is not available
 * @param {Array} validationErrors - Array of validation issues
 * @param {Array} entityData - The original entity data
 * @returns {Promise<{success: boolean, fixes: Array}>}
 */
function generateBasicFixes(validationErrors, entityData) {
  const fixes = [];
  
  validationErrors.forEach((error, index) => {
    const recordId = error.id || error.rowId;
    let actualRecordId = recordId;
    
    // Try to find the actual record and get its proper ID
    let record = entityData.find(item => 
      item.id === recordId || 
      item.TaskID === recordId || 
      item.WorkerID === recordId || 
      item.ClientID === recordId
    );
    
    // If not found by exact match, try index-based matching for validation error IDs
    if (!record) {
      const match = recordId.match(/^(clients|workers|tasks)-(\d+)$/);
      if (match) {
        const rowNumber = parseInt(match[2]);
        const recordIndex = rowNumber - 1;
        
        if (recordIndex >= 0 && recordIndex < entityData.length) {
          record = entityData[recordIndex];
          // Use the actual entity ID instead of the validation error ID
          actualRecordId = record.TaskID || record.WorkerID || record.ClientID || record.id || recordId;
        }
      }
    }
    
    let suggestedValue = null;
    let reason = 'Basic fix suggestion';
    
    // Generate basic suggestions based on error type and field
    if (error.field === 'AttributesJSON' || error.field === 'RequestedAttributesJSON') {
      if (error.error && error.error.includes('Invalid JSON')) {
        suggestedValue = '{}';
        reason = 'Replace invalid JSON with empty object';
      }
    } else if (error.field === 'ClientID' && error.error && error.error.includes('Duplicate')) {
      // For duplicate ClientIDs, suggest adding a suffix
      const baseId = error.value || 'CLIENT001';
      suggestedValue = `${baseId}_${Date.now()}`;
      reason = 'Add timestamp suffix to make ClientID unique';
    } else if (error.field && error.field.includes('Email')) {
      suggestedValue = 'example@company.com';
      reason = 'Provide valid email format';
    } else if (error.field && error.field.includes('Priority')) {
      suggestedValue = 1;
      reason = 'Set default priority level';
    } else {
      // Generic suggestion
      suggestedValue = 'Please review and correct manually';
      reason = 'Manual review required';
    }
    
    fixes.push({
      rowId: actualRecordId, // Use actual entity ID for applying fixes
      field: error.field,
      currentValue: error.value,
      suggestedValue: suggestedValue,
      reason: reason,
      confidence: 0.6, // Lower confidence for basic fixes
      autoApplyable: false, // Don't auto-apply basic fixes
      sideEffects: ['Manual verification recommended'],
      originalValidationId: recordId // Keep track of original validation error ID
    });
  });
  
  return {
    success: true,
    fixes
  };
}

/**
 * Chat with data - conversational AI for insights
 * @param {string} userMessage - User's chat message
 * @param {Object} dataContext - Context with clients, workers, tasks data
 * @returns {Promise<{success: boolean, response?: string, error?: string}>}
 */
export async function chatWithData(userMessage, dataContext) {
  try {
    console.log(`[AI Service] Processing chat message: "${userMessage}"`);
    
    const totalRecords = dataContext.clients.length + dataContext.workers.length + dataContext.tasks.length;
    
    if (totalRecords === 0) {
      return {
        success: true,
        response: "I don't see any data in your system yet. Please upload some CSV files first, and then I can provide detailed insights about your clients, workers, and tasks."
      };
    }

    // Get sample data for context
    const sampleClient = dataContext.clients.length > 0 ? dataContext.clients[0] : null;
    const sampleWorker = dataContext.workers.length > 0 ? dataContext.workers[0] : null;
    const sampleTask = dataContext.tasks.length > 0 ? dataContext.tasks[0] : null;

    // Create enhanced prompt for conversational insights
    const prompt = `
You are a helpful AI assistant specializing in business data analysis. The user has uploaded the following data:

DATA SUMMARY:
- Clients: ${dataContext.clients.length} records
- Workers: ${dataContext.workers.length} records  
- Tasks: ${dataContext.tasks.length} records

SAMPLE DATA STRUCTURE:
${sampleClient ? `Client example: ${JSON.stringify(sampleClient, null, 2)}` : ''}
${sampleWorker ? `Worker example: ${JSON.stringify(sampleWorker, null, 2)}` : ''}
${sampleTask ? `Task example: ${JSON.stringify(sampleTask, null, 2)}` : ''}

USER MESSAGE: "${userMessage}"

Provide a helpful, conversational response that:
1. Acknowledges their question/request
2. Provides specific insights based on their actual data
3. Offers actionable recommendations
4. Uses a friendly, professional tone
5. Includes relevant data points when possible

Keep the response conversational and engaging, like you're a data analyst colleague helping them understand their business better. 

IMPORTANT: Respond with plain text, NOT JSON. Be conversational and helpful.
`;

    const geminiResponse = await getGeminiResponse(prompt);
    
    if (geminiResponse.success) {
      return {
        success: true,
        response: geminiResponse.data
      };
    } else {
      // Fallback response when AI service is unavailable
      return {
        success: true,
        response: `I can see you have ${totalRecords} total records (${dataContext.clients.length} clients, ${dataContext.workers.length} workers, ${dataContext.tasks.length} tasks). While I'm having trouble accessing advanced AI features right now, I can help you with basic data insights. What specific aspect of your data would you like to explore?`
      };
    }
    
  } catch (error) {
    console.error('[AI Service] Error in chatWithData:', error.message);
    return {
      success: false,
      error: `Chat processing failed: ${error.message}`
    };
  }
}

/**
 * Utility function to get AI service health status
 * @returns {Promise<{success: boolean, status?: Object, error?: string}>}
 */
export async function getServiceHealth() {
  try {
    const testPrompt = "Respond with exactly this JSON: {\"status\": \"healthy\", \"timestamp\": \"" + new Date().toISOString() + "\"}";
    const response = await getGeminiResponse(testPrompt);
    
    return {
      success: response.success,
      status: {
        geminiAPI: response.success ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        apiKey: process.env.GEMINI_API_KEY ? 'configured' : 'missing'
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// All functions are already exported individually above