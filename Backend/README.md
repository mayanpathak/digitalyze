# AI Resource Backend

Smart data ingestion, validation, and rules configuration platform with AI-powered features.

## 🚀 Features

- **File Upload & Processing**: Support for CSV and Excel files
- **Data Validation**: Comprehensive validation with AI-powered suggestions
- **Rules Engine**: Flexible rule system with natural language processing
- **AI Integration**: Powered by Google Gemini API for intelligent data analysis
- **RESTful API**: Complete REST API for frontend integration
- **In-Memory Storage**: Fast data operations without database dependencies

## 🛠 Tech Stack

- **Node.js** with ES6 modules
- **Express.js** for REST API
- **Multer** for file uploads
- **Google Gemini AI** for AI features
- **Papa Parse** for CSV processing
- **XLSX** for Excel file processing

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google Gemini API key

## 🔧 Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd digitalize-assignment/Backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Create environment file**
```bash
cp .env.example .env
```

4. **Configure environment variables**
Edit `.env` file:
```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# File Upload Configuration
MAX_FILE_SIZE=10485760
MAX_FILES=10

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
```

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:5000`

## 📚 API Endpoints

### File Upload
- `POST /api/upload` - Upload CSV/Excel files
- `GET /api/upload/status` - Get upload status
- `DELETE /api/upload/:filename` - Delete uploaded file

### Data Management
- `GET /api/data/:entity` - Get entity data (clients/workers/tasks)
- `GET /api/data/:entity/search` - Search records
- `GET /api/data/:entity/stats` - Get data statistics
- `POST /api/data/:entity/validate` - Validate entity data
- `PATCH /api/data/:entity/:id` - Update record
- `DELETE /api/data/:entity/:id` - Delete record
- `POST /api/data/export` - Export data
- `DELETE /api/data/:entity` - Clear entity data

### Rules Management
- `GET /api/rules` - Get all rules
- `POST /api/rules/add` - Add new rule
- `PUT /api/rules/:id` - Update rule
- `DELETE /api/rules/:id` - Delete rule
- `POST /api/rules/validate` - Validate rules
- `GET /api/rules/priorities` - Get priorities
- `POST /api/rules/priorities` - Set priorities

### AI Features
- `POST /api/ai/query` - Natural language query
- `POST /api/ai/rule` - Generate rule from description
- `GET /api/ai/rule-recommendations` - Get AI rule recommendations
- `POST /api/ai/validate-extended` - Extended AI validation
- `POST /api/ai/fix-errors` - AI-powered error fixing
- `POST /api/ai/enhance` - Data enhancement suggestions
- `POST /api/ai/insights` - Generate insights

### Health Check
- `GET /api/health` - Server health status

## 📁 Project Structure

```
Backend/
├── src/
│   ├── config/
│   │   └── config.js          # Configuration settings
│   ├── controller/
│   │   ├── ai.controller.js    # AI endpoint handlers
│   │   ├── data.controller.js  # Data management handlers
│   │   ├── rules.controller.js # Rules management handlers
│   │   └── upload.controller.js # File upload handlers
│   ├── middlewares/
│   │   ├── asyncWrapper.js     # Async error handling
│   │   ├── errorHandler.js     # Global error handler
│   │   ├── validateFileUpload.js # File upload validation
│   │   └── validateRequest.js   # Request validation
│   ├── routes/
│   │   ├── ai.routes.js        # AI endpoints
│   │   ├── data.routes.js      # Data endpoints
│   │   ├── rules.routes.js     # Rules endpoints
│   │   └── upload.routes.js    # Upload endpoints
│   ├── services/
│   │   ├── ai.service.js       # AI integration logic
│   │   ├── parser.service.js   # File parsing logic
│   │   ├── rule.service.js     # Rules business logic
│   │   └── validation.service.js # Data validation logic
│   ├── utils/
│   │   ├── csvUtils.js         # CSV utilities
│   │   ├── fileUtils.js        # File utilities
│   │   └── responseBuilder.js   # API response builder
│   ├── uploads/                # Uploaded files storage
│   └── export/                 # Export files storage
├── dataStore.js               # In-memory data store
├── server.js                  # Main server file
└── package.json              # Dependencies and scripts
```

## 🔍 Testing

Test the API endpoints using tools like Postman or curl:

### Upload File Example
```bash
curl -X POST \
  http://localhost:5000/api/upload \
  -H 'Content-Type: multipart/form-data' \
  -F 'clients=@clients.csv' \
  -F 'workers=@workers.csv' \
  -F 'tasks=@tasks.csv'
```

### Natural Language Query Example
```bash
curl -X POST \
  http://localhost:5000/api/ai/query \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Find all workers with Java skills available in phase 2",
    "entity": "workers"
  }'
```

## 🚨 Troubleshooting

### Common Issues

1. **Module not found errors**
   - Ensure all dependencies are installed: `npm install`
   - Check that file paths are correct

2. **Gemini API errors**
   - Verify your API key is correctly set in `.env`
   - Check API key permissions and quotas

3. **File upload errors**
   - Ensure upload directories exist
   - Check file size limits in configuration

4. **Port already in use**
   - Change PORT in `.env` file
   - Kill existing processes: `lsof -ti:5000 | xargs kill`

### Debug Mode
Set `NODE_ENV=development` in `.env` for detailed error messages.

## 📝 Data Formats

### Clients CSV Format
```csv
ClientID,Name,Priority,RequestedTaskIDs,GroupTag
C1,Client One,1,"T1,T2",VIP
```

### Workers CSV Format
```csv
WorkerID,Name,Skills,AvailableSlots,MaxLoadPerPhase,WorkerGroup
W1,Worker One,"Java,Python","[1,2,3]",2,TeamA
```

### Tasks CSV Format
```csv
TaskID,Name,RequiredSkills,Duration,PreferredPhases,MaxConcurrent
T1,Task One,"Java,SQL",5,"1-2",1
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License. 