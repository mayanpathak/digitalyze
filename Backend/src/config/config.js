import dotenv from 'dotenv';

dotenv.config();

const config = {
  server: {
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    maxFiles: parseInt(process.env.MAX_FILES) || 10,
    allowedTypes: ['.csv', '.xlsx', '.xls'],
    uploadDir: 'uploads',
    exportDir: 'export'
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-pro',
    maxTokens: 1000,
    temperature: 0.7
  },
  validation: {
    maxRows: 10000,
    maxColumns: 50,
    requiredColumns: {
      clients: ['ClientID', 'Name', 'Priority'],
      workers: ['WorkerID', 'Name', 'Skills', 'AvailableSlots'],
      tasks: ['TaskID', 'Name', 'RequiredSkills', 'Duration', 'PriorityLevel']
    }
  }
};

export default config;