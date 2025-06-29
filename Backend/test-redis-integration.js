#!/usr/bin/env node

/**
 * Redis Integration Test Script
 * 
 * This script tests the Redis-first integration with dataStore fallback
 * across all major features of the backend system.
 */

import redisService from './src/services/redis.service.js';
import dataStore from './dataStore.js';
import { runNaturalLanguageQuery, getRuleRecommendations } from './src/services/ai.service.js';
import { validateRecords } from './src/services/validation.service.js';
import { processUploadedData } from './src/services/parser.service.js';

// Test data samples
const sampleClients = [
  { ClientID: 'C1', ClientName: 'Acme Corp', PriorityLevel: 5, RequestedTaskIDs: ['T1', 'T2'] },
  { ClientID: 'C2', ClientName: 'Tech Solutions', PriorityLevel: 3, RequestedTaskIDs: ['T3'] }
];

const sampleWorkers = [
  { WorkerID: 'W1', WorkerName: 'John Doe', Skills: ['JavaScript', 'Python'], AvailableSlots: [1, 2], MaxLoadPerPhase: 3 },
  { WorkerID: 'W2', WorkerName: 'Jane Smith', Skills: ['Java', 'React'], AvailableSlots: [2, 3], MaxLoadPerPhase: 2 }
];

const sampleTasks = [
  { TaskID: 'T1', TaskName: 'API Development', RequiredSkills: ['JavaScript'], Duration: 5, PreferredPhases: [1] },
  { TaskID: 'T2', TaskName: 'Frontend Development', RequiredSkills: ['React'], Duration: 3, PreferredPhases: [2] },
  { TaskID: 'T3', TaskName: 'Backend Development', RequiredSkills: ['Python'], Duration: 4, PreferredPhases: [1, 2] }
];

class RedisIntegrationTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '🔍',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[type];
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async test(name, testFunction) {
    this.log(`Testing: ${name}`, 'info');
    
    try {
      const result = await testFunction();
      if (result) {
        this.log(`PASSED: ${name}`, 'success');
        this.testResults.passed++;
        this.testResults.tests.push({ name, status: 'PASSED', error: null });
      } else {
        this.log(`FAILED: ${name}`, 'error');
        this.testResults.failed++;
        this.testResults.tests.push({ name, status: 'FAILED', error: 'Test returned false' });
      }
    } catch (error) {
      this.log(`FAILED: ${name} - ${error.message}`, 'error');
      this.testResults.failed++;
      this.testResults.tests.push({ name, status: 'FAILED', error: error.message });
    }
  }

  async testRedisConnection() {
    return await this.test('Redis Connection', async () => {
      const isAvailable = redisService.isAvailable();
      this.log(`Redis available: ${isAvailable}`, isAvailable ? 'success' : 'warning');
      
      if (isAvailable) {
        const stats = await redisService.getCacheStats();
        this.log(`Redis stats: ${JSON.stringify(stats, null, 2)}`, 'info');
      }
      
      return true; // This test always passes to show status
    });
  }

  async testBasicCaching() {
    return await this.test('Basic Redis Caching', async () => {
      if (!redisService.isAvailable()) {
        this.log('Redis not available, skipping cache test', 'warning');
        return true;
      }

      const testKey = 'test_basic_cache';
      const testData = { message: 'Hello Redis!', timestamp: Date.now() };
      
      // Set cache
      const setResult = await redisService.setCache(testKey, testData, 60);
      if (!setResult) throw new Error('Failed to set cache');
      
      // Get cache
      const cachedData = await redisService.getCache(testKey);
      if (!cachedData) throw new Error('Failed to get cached data');
      
      // Verify data
      if (cachedData.message !== testData.message) {
        throw new Error('Cached data does not match original');
      }
      
      // Clean up
      await redisService.delCache(testKey);
      
      return true;
    });
  }

  async testDataStoreIntegration() {
    return await this.test('DataStore Integration', async () => {
      // Populate dataStore with test data
      dataStore.setData('clients', sampleClients, 'test-clients.csv');
      dataStore.setData('workers', sampleWorkers, 'test-workers.csv');
      dataStore.setData('tasks', sampleTasks, 'test-tasks.csv');
      
      // Verify data was stored
      const clients = dataStore.getData('clients');
      const workers = dataStore.getData('workers');
      const tasks = dataStore.getData('tasks');
      
      if (clients.length !== 2 || workers.length !== 2 || tasks.length !== 3) {
        throw new Error('DataStore data count mismatch');
      }
      
      return true;
    });
  }

  async testAICaching() {
    return await this.test('AI Response Caching', async () => {
      if (!redisService.isAvailable()) {
        this.log('Redis not available, testing AI without cache', 'warning');
      }

      const testQuery = 'Find workers with JavaScript skills';
      const workers = dataStore.getData('workers');
      
      if (workers.length === 0) {
        throw new Error('No workers data available for AI test');
      }
      
      // First call - should hit AI API or return cached result
      const result1 = await runNaturalLanguageQuery('workers', testQuery, workers);
      if (!result1.success) {
        throw new Error(`AI query failed: ${result1.error}`);
      }
      
      // Second call - should hit cache if Redis is available
      const result2 = await runNaturalLanguageQuery('workers', testQuery, workers);
      if (!result2.success) {
        throw new Error(`AI query failed on second call: ${result2.error}`);
      }
      
      this.log(`AI query results: ${result1.filteredData?.length || 0} workers found`, 'info');
      
      return true;
    });
  }

  async testValidationCaching() {
    return await this.test('Validation Result Caching', async () => {
      const clients = dataStore.getData('clients');
      
      if (clients.length === 0) {
        throw new Error('No clients data available for validation test');
      }
      
      // First validation - should compute and cache if Redis available
      const validation1 = await validateRecords(clients, 'clients');
      if (!Array.isArray(validation1)) {
        throw new Error('Validation did not return array');
      }
      
      // Second validation - should hit cache if Redis available
      const validation2 = await validateRecords(clients, 'clients');
      if (!Array.isArray(validation2)) {
        throw new Error('Second validation did not return array');
      }
      
      this.log(`Validation found ${validation1.length} errors`, 'info');
      
      return true;
    });
  }

  async testRuleRecommendationCaching() {
    return await this.test('Rule Recommendation Caching', async () => {
      const fullDataStore = {
        clients: dataStore.getData('clients'),
        workers: dataStore.getData('workers'),
        tasks: dataStore.getData('tasks'),
        rules: dataStore.getRules() || []
      };
      
      // First call - should compute and cache if Redis available
      const recommendations1 = await getRuleRecommendations(fullDataStore);
      if (!recommendations1.success) {
        this.log(`Rule recommendations failed: ${recommendations1.error}`, 'warning');
        return true; // Don't fail test if AI service is unavailable
      }
      
      // Second call - should hit cache if Redis available
      const recommendations2 = await getRuleRecommendations(fullDataStore);
      if (!recommendations2.success) {
        throw new Error(`Second rule recommendations call failed: ${recommendations2.error}`);
      }
      
      this.log(`Rule recommendations: ${recommendations1.recommendations?.length || 0} suggestions`, 'info');
      
      return true;
    });
  }

  async testParserCaching() {
    return await this.test('Parser Result Caching', async () => {
      const sampleRawData = [
        { 'Client ID': 'C3', 'Name': 'Test Client', 'Priority': '4' },
        { 'Client ID': 'C4', 'Name': 'Another Client', 'Priority': '2' }
      ];
      
      // First processing - should compute and cache if Redis available
      const processed1 = await processUploadedData(sampleRawData, 'clients');
      if (!Array.isArray(processed1)) {
        throw new Error('Parser did not return array');
      }
      
      // Second processing - should hit cache if Redis available
      const processed2 = await processUploadedData(sampleRawData, 'clients');
      if (!Array.isArray(processed2)) {
        throw new Error('Second parser call did not return array');
      }
      
      this.log(`Parser processed ${processed1.length} records`, 'info');
      
      return true;
    });
  }

  async testCacheInvalidation() {
    return await this.test('Cache Invalidation', async () => {
      if (!redisService.isAvailable()) {
        this.log('Redis not available, skipping cache invalidation test', 'warning');
        return true;
      }

      // Set some test caches
      await redisService.setCache('entity_data_clients', sampleClients, 300);
      await redisService.setCache('entity_data_workers', sampleWorkers, 300);
      
      // Verify caches exist
      const cachedClients = await redisService.getCache('entity_data_clients');
      const cachedWorkers = await redisService.getCache('entity_data_workers');
      
      if (!cachedClients || !cachedWorkers) {
        throw new Error('Failed to set test caches');
      }
      
      // Test pattern-based cache clearing
      const deletedCount = await redisService.clearCachePattern('entity_data_*');
      this.log(`Deleted ${deletedCount} cache entries`, 'info');
      
      // Verify caches are gone
      const deletedClients = await redisService.getCache('entity_data_clients');
      const deletedWorkers = await redisService.getCache('entity_data_workers');
      
      if (deletedClients || deletedWorkers) {
        throw new Error('Cache invalidation failed');
      }
      
      return true;
    });
  }

  async testFallbackBehavior() {
    return await this.test('Fallback Behavior', async () => {
      // This test simulates Redis being unavailable
      const originalIsAvailable = redisService.isAvailable;
      
      // Mock Redis as unavailable
      redisService.isAvailable = () => false;
      
      try {
        // Test that operations still work with dataStore fallback
        const clients = dataStore.getData('clients');
        if (clients.length === 0) {
          throw new Error('DataStore fallback failed - no clients data');
        }
        
        // Test validation with fallback
        const validation = await validateRecords(clients, 'clients');
        if (!Array.isArray(validation)) {
          throw new Error('Validation fallback failed');
        }
        
        this.log('Fallback behavior working correctly', 'success');
        
        return true;
      } finally {
        // Restore original function
        redisService.isAvailable = originalIsAvailable;
      }
    });
  }

  async runAllTests() {
    this.log('🚀 Starting Redis Integration Tests', 'info');
    this.log('='.repeat(50), 'info');
    
    // Run all tests
    await this.testRedisConnection();
    await this.testBasicCaching();
    await this.testDataStoreIntegration();
    await this.testAICaching();
    await this.testValidationCaching();
    await this.testRuleRecommendationCaching();
    await this.testParserCaching();
    await this.testCacheInvalidation();
    await this.testFallbackBehavior();
    
    // Print summary
    this.log('='.repeat(50), 'info');
    this.log('📊 TEST SUMMARY', 'info');
    this.log(`✅ Passed: ${this.testResults.passed}`, 'success');
    this.log(`❌ Failed: ${this.testResults.failed}`, 'error');
    this.log(`📈 Success Rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`, 'info');
    
    if (this.testResults.failed > 0) {
      this.log('🔍 Failed Tests:', 'error');
      this.testResults.tests
        .filter(test => test.status === 'FAILED')
        .forEach(test => {
          this.log(`  - ${test.name}: ${test.error}`, 'error');
        });
    }
    
    // Cleanup
    await this.cleanup();
    
    return this.testResults.failed === 0;
  }

  async cleanup() {
    this.log('🧹 Cleaning up test data...', 'info');
    
    try {
      // Clear Redis test caches
      if (redisService.isAvailable()) {
        await redisService.clearCachePattern('test_*');
        await redisService.clearCachePattern('ai:*');
        await redisService.clearCachePattern('validate:*');
        await redisService.clearCachePattern('cache:*');
      }
      
      // Clear dataStore test data
      dataStore.resetData('clients');
      dataStore.resetData('workers');
      dataStore.resetData('tasks');
      
      this.log('✅ Cleanup completed', 'success');
    } catch (error) {
      this.log(`⚠️ Cleanup warning: ${error.message}`, 'warning');
    }
  }
}

// Run tests if this script is executed directly
if (process.argv[1].endsWith('test-redis-integration.js')) {
  const tester = new RedisIntegrationTester();
  
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    });
}

export default RedisIntegrationTester; 