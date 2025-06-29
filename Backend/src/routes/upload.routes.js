// routes/upload.routes.js
import express from 'express';
import asyncWrapper from '../middlewares/asyncWrapper.js';
import { uploadFields, validateUploadedFiles } from '../middlewares/validateFileUpload.js';
import { 
  uploadFiles, 
  getUploadStatus, 
  deleteUploadedFile 
} from '../controller/upload.controller.js';

const router = express.Router();

// Define upload fields for different file types
const uploadFieldsConfig = [
  { name: 'clients', maxCount: 1 },
  { name: 'workers', maxCount: 1 },
  { name: 'tasks', maxCount: 1 }
];

// Routes
router.get('/', (req, res) => {
  res.json({ message: 'Upload endpoint is working', timestamp: new Date().toISOString() });
});

router.post(
  '/',
  uploadFields(uploadFieldsConfig),
  validateUploadedFiles,
  asyncWrapper(uploadFiles)
);

router.get('/status', asyncWrapper(getUploadStatus));

router.delete('/:filename', asyncWrapper(deleteUploadedFile));

export default router;