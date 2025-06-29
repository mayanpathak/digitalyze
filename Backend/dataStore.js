// In-memory data store for the application
class DataStore {
    constructor() {
      this.data = {
        clients: [],
        workers: [],
        tasks: []
      };
      
      this.rules = [];
      this.priorities = {
        priorityLevelWeight: 0.4,
        fairnessWeight: 0.3,
        costWeight: 0.3
      };
      
      this.validationResults = {
        clients: [],
        workers: [],
        tasks: []
      };
      
      this.enhancedValidationResults = null;
      
      this.metadata = {
        clients: { lastUpdated: null, fileName: null, rowCount: 0 },
        workers: { lastUpdated: null, fileName: null, rowCount: 0 },
        tasks: { lastUpdated: null, fileName: null, rowCount: 0 }
      };
    }
  
    // Data operations
    setData(entity, data, fileName = null) {
      if (!this.isValidEntity(entity)) {
        throw new Error(`Invalid entity: ${entity}`);
      }
      
      this.data[entity] = data;
      this.metadata[entity] = {
        lastUpdated: new Date().toISOString(),
        fileName,
        rowCount: data.length
      };
    }
  
    getData(entity) {
      if (!this.isValidEntity(entity)) {
        throw new Error(`Invalid entity: ${entity}`);
      }
      return this.data[entity];
    }
  
        updateRecord(entity, id, updates) {
      if (!this.isValidEntity(entity)) {
        throw new Error(`Invalid entity: ${entity}`);
      }
  
      const records = this.data[entity];
      const idField = entity === 'clients' ? 'ClientID' : 
                     entity === 'workers' ? 'WorkerID' : 'TaskID';
      const recordIndex = records.findIndex(record => 
        record.id === id || 
        record[idField] === id || 
        String(record[idField]) === String(id) ||
        Number(record[idField]) === Number(id)
      );
      
      if (recordIndex === -1) {
        // Enhanced error message with debugging info
        const availableIds = records.slice(0, 5).map(r => ({
          id: r.id,
          [idField]: r[idField]
        }));
        throw new Error(`Record with id "${id}" not found in ${entity}. Available IDs (first 5): ${JSON.stringify(availableIds)}`);
      }

      records[recordIndex] = { ...records[recordIndex], ...updates };
      this.metadata[entity].lastUpdated = new Date().toISOString();
      
      return records[recordIndex];
    }
  
    deleteRecord(entity, id) {
      if (!this.isValidEntity(entity)) {
        throw new Error(`Invalid entity: ${entity}`);
      }
  
      const records = this.data[entity];
      const idField = entity === 'clients' ? 'ClientID' : 
                     entity === 'workers' ? 'WorkerID' : 'TaskID';
      const recordIndex = records.findIndex(record => 
        record.id === id || 
        record[idField] === id || 
        String(record[idField]) === String(id) ||
        Number(record[idField]) === Number(id)
      );
      
      if (recordIndex === -1) {
        throw new Error(`Record with id ${id} not found in ${entity}`);
      }
  
      const deletedRecord = records.splice(recordIndex, 1)[0];
      this.metadata[entity].lastUpdated = new Date().toISOString();
      this.metadata[entity].rowCount--;
      
      return deletedRecord;
    }
  
    // Rules operations
    addRule(rule) {
      const newRule = {
        id: this.generateId('rule'),
        ...rule,
        createdAt: new Date().toISOString()
      };
      this.rules.push(newRule);
      return newRule;
    }
  
    getRules() {
      return this.rules;
    }
  
    setRules(rules) {
      this.rules = rules;
      return this.rules;
    }
  
    updateRule(ruleId, updates) {
      const ruleIndex = this.rules.findIndex(rule => rule.id === ruleId);
      if (ruleIndex === -1) {
        throw new Error(`Rule with id ${ruleId} not found`);
      }
  
      this.rules[ruleIndex] = { 
        ...this.rules[ruleIndex], 
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      return this.rules[ruleIndex];
    }
  
    deleteRule(ruleId) {
      const ruleIndex = this.rules.findIndex(rule => rule.id === ruleId);
      if (ruleIndex === -1) {
        throw new Error(`Rule with id ${ruleId} not found`);
      }
  
      return this.rules.splice(ruleIndex, 1)[0];
    }
  
    // Priorities operations
    setPriorities(priorities) {
      // Ensure all required priority fields are present
      const defaultPriorities = {
        priorityLevelWeight: 0.4,
        fairnessWeight: 0.3,
        costWeight: 0.3
      };
      this.priorities = { ...defaultPriorities, ...this.priorities, ...priorities };
      return this.priorities;
    }
  
    getPriorities() {
      // Ensure all required priority fields are present
      const defaultPriorities = {
        priorityLevelWeight: 0.4,
        fairnessWeight: 0.3,
        costWeight: 0.3
      };
      this.priorities = { ...defaultPriorities, ...this.priorities };
      return this.priorities;
    }
  
      // Validation results operations
  setValidationResults(entity, results) {
    if (!this.isValidEntity(entity)) {
      throw new Error(`Invalid entity: ${entity}`);
    }
    this.validationResults[entity] = results;
  }

  getValidationResults(entity) {
    if (!this.isValidEntity(entity)) {
      throw new Error(`Invalid entity: ${entity}`);
    }
    return this.validationResults[entity];
  }

  getAllValidationResults() {
    return this.validationResults;
  }

  // Enhanced validation caching
  setEnhancedValidationResults(results) {
    this.enhancedValidationResults = {
      ...results,
      cachedAt: new Date().toISOString()
    };
  }

  getEnhancedValidationResults() {
    return this.enhancedValidationResults || null;
  }

  clearValidationCache() {
    this.validationResults = {
      clients: [],
      workers: [],
      tasks: []
    };
    this.enhancedValidationResults = null;
  }
  
    // Metadata operations
    getMetadata(entity = null) {
      if (entity) {
        if (!this.isValidEntity(entity)) {
          throw new Error(`Invalid entity: ${entity}`);
        }
        return this.metadata[entity];
      }
      return this.metadata;
    }
  
    // Utility methods
    isValidEntity(entity) {
      return ['clients', 'workers', 'tasks'].includes(entity);
    }
  
    generateId(prefix = 'item') {
      return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  
    clearAll() {
      this.data = {
        clients: [],
        workers: [],
        tasks: []
      };
      this.rules = [];
      this.validationResults = {
        clients: [],
        workers: [],
        tasks: []
      };
      this.metadata = {
        clients: { lastUpdated: null, fileName: null, rowCount: 0 },
        workers: { lastUpdated: null, fileName: null, rowCount: 0 },
        tasks: { lastUpdated: null, fileName: null, rowCount: 0 }
      };
    }
  
    clearEntity(entity) {
      if (!this.isValidEntity(entity)) {
        throw new Error(`Invalid entity: ${entity}`);
      }
      
      this.data[entity] = [];
      this.validationResults[entity] = [];
      this.metadata[entity] = { lastUpdated: null, fileName: null, rowCount: 0 };
    }
  
    // Search and filter methods
    searchRecords(entity, query, fields = []) {
      if (!this.isValidEntity(entity)) {
        throw new Error(`Invalid entity: ${entity}`);
      }
  
      const records = this.data[entity];
      if (!query) return records;
  
      const searchTerm = query.toLowerCase();
      
      return records.filter(record => {
        if (fields.length === 0) {
          // Search in all fields
          return Object.values(record).some(value => 
            String(value).toLowerCase().includes(searchTerm)
          );
        } else {
          // Search in specific fields
          return fields.some(field => 
            record[field] && String(record[field]).toLowerCase().includes(searchTerm)
          );
        }
      });
    }
  
    getStats() {
      return {
        totalRecords: Object.values(this.data).reduce((sum, records) => sum + records.length, 0),
        recordCounts: {
          clients: this.data.clients.length,
          workers: this.data.workers.length,
          tasks: this.data.tasks.length
        },
        rulesCount: this.rules.length,
        lastUpdated: Math.max(
          ...Object.values(this.metadata)
            .map(meta => meta.lastUpdated ? new Date(meta.lastUpdated).getTime() : 0)
        )
      };
    }
  
    // Reset data for a specific entity
    resetData(entity) {
      if (!this.isValidEntity(entity)) {
        throw new Error(`Invalid entity: ${entity}`);
      }
      
      this.data[entity] = [];
      this.validationResults[entity] = [];
      this.metadata[entity] = { lastUpdated: null, fileName: null, rowCount: 0 };
    }
  }
  
  // Create and export singleton instance
  const dataStore = new DataStore();
  export default dataStore;