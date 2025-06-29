import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

// Import routes
import uploadRoutes from './src/routes/upload.routes.js';
import dataRoutes from './src/routes/data.routes.js';
import rulesRoutes from './src/routes/rules.routes.js';
import aiRoutes from './src/routes/ai.routes.js';

// Import middleware
import errorHandler from './src/middlewares/errorHandler.js';

// Import Redis service for initialization
import redisService from './src/services/redis.service.js';

// Import dataStore for test data loading
import dataStore from './dataStore.js';
import Papa from 'papaparse';

// Environment setup
dotenv.config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000','https://digitalyze-one.vercel.app/', 'http://localhost:3001', 'https://digitalyze-rb7o.onrender.com',' http://localhost:3003',
    'https://github.com/mayanpathak/digitalyze' || 'https://github.com/mayanpathak/digitalyze'// Allow both ports for development
  ],
  credentials: true
}));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure required directories exist
const requiredDirs = ['src/uploads', 'src/export'];
requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/ai', aiRoutes);

// Health check endpoint with Redis status
app.get('/api/health', async (req, res) => {
  try {
    const redisStats = await redisService.getCacheStats();
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      message: 'AI Resource Backend is running',
      services: {
        redis: {
          connected: redisStats.connected,
          available: redisService.isAvailable(),
          keyCount: redisStats.keyCount || 0,
          error: redisStats.error || null
        },
        dataStore: {
          status: 'active',
          message: 'In-memory dataStore operational'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
      error: error.message
    });
  }
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Close Redis connection
    if (redisService.isAvailable()) {
      console.log('📦 Closing Redis connection...');
      await redisService.disconnect();
    }
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error.message);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Function to load test data on startup
async function loadTestDataOnStartup() {
  try {
    console.log('🔄 Loading test data into dataStore...');
    
    const uploadsDir = path.join(__dirname, 'src', 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      console.log('📁 No uploads directory found, skipping test data loading');
      return;
    }
    
    const files = fs.readdirSync(uploadsDir);
    
    const clientsFile = files.filter(f => f.startsWith('clients')).sort().pop();
    const workersFile = files.filter(f => f.startsWith('workers')).sort().pop();
    const tasksFile = files.filter(f => f.startsWith('tasks')).sort().pop();
    
    let loadedCount = 0;
    
    // Load clients
    if (clientsFile) {
      const clientsPath = path.join(uploadsDir, clientsFile);
      const clientsData = fs.readFileSync(clientsPath, 'utf8');
      const clientsResult = Papa.parse(clientsData, { header: true, skipEmptyLines: true });
      dataStore.setData('clients', clientsResult.data, clientsFile);
      console.log(`✅ Loaded ${clientsResult.data.length} clients`);
      loadedCount += clientsResult.data.length;
    }
    
    // Load workers
    if (workersFile) {
      const workersPath = path.join(uploadsDir, workersFile);
      const workersData = fs.readFileSync(workersPath, 'utf8');
      const workersResult = Papa.parse(workersData, { header: true, skipEmptyLines: true });
      dataStore.setData('workers', workersResult.data, workersFile);
      console.log(`✅ Loaded ${workersResult.data.length} workers`);
      loadedCount += workersResult.data.length;
    }
    
    // Load tasks
    if (tasksFile) {
      const tasksPath = path.join(uploadsDir, tasksFile);
      const tasksData = fs.readFileSync(tasksPath, 'utf8');
      const tasksResult = Papa.parse(tasksData, { header: true, skipEmptyLines: true });
      dataStore.setData('tasks', tasksResult.data, tasksFile);
      console.log(`✅ Loaded ${tasksResult.data.length} tasks`);
      loadedCount += tasksResult.data.length;
    }
    
    if (loadedCount > 0) {
      console.log(`📊 Total test data loaded: ${loadedCount} records`);
    } else {
      console.log('📭 No test data files found to load');
    }
    
  } catch (error) {
    console.error('❌ Error loading test data:', error.message);
  }
}

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Gemini API: ${process.env.GEMINI_API_KEY ? 'Configured' : 'Not configured'}`);
  
  // Load test data on startup
  await loadTestDataOnStartup();
  
  // Log Redis status
  setTimeout(() => {
    if (redisService.isAvailable()) {
      console.log(`💾 Redis: Connected and ready for caching`);
    } else {
      console.log(`⚠️  Redis: Not available - using in-memory dataStore fallback`);
    }
  }, 2000); // Give Redis time to connect
});

export default app;