import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get file extension
 */
export const getFileExtension = (filename) => {
  return path.extname(filename).toLowerCase();
};

/**
 * Check if file exists
 */
export const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get file stats
 */
export const getFileStats = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    };
  } catch (error) {
    throw new Error(`Failed to get file stats: ${error.message}`);
  }
};

/**
 * Clean up temporary files
 */
export const cleanupFiles = async (filePaths) => {
  const promises = filePaths.map(async (filePath) => {
    try {
      if (await fileExists(filePath)) {
        await fs.unlink(filePath);
      }
    } catch (error) {
      console.warn(`Failed to cleanup file ${filePath}:`, error.message);
    }
  });
  
  await Promise.all(promises);
};

/**
 * Create directory if it doesn't exist
 */
export const ensureDirectory = async (dirPath) => {
  try {
    await fs.ensureDir(dirPath);
  } catch (error) {
    throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
  }
};

/**
 * Create ZIP archive
 */
export const createZipArchive = async (sourceDir, outputPath, files = null) => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      resolve({
        path: outputPath,
        size: archive.pointer(),
        fileCount: archive.pointer()
      });
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    if (files && Array.isArray(files)) {
      // Add specific files
      files.forEach(file => {
        const filePath = path.join(sourceDir, file);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: file });
        }
      });
    } else {
      // Add entire directory
      archive.directory(sourceDir, false);
    }

    archive.finalize();
  });
};

/**
 * Generate unique filename
 */
export const generateUniqueFilename = (originalName, extension = null) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = extension || path.extname(originalName);
  const name = path.basename(originalName, path.extname(originalName));
  
  return `${name}-${timestamp}-${random}${ext}`;
};

/**
 * Get safe filename (remove invalid characters)
 */
export const getSafeFilename = (filename) => {
  return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
};

/**
 * Read JSON file safely
 */
export const readJsonFile = async (filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read JSON file: ${error.message}`);
  }
};

/**
 * Write JSON file safely
 */
export const writeJsonFile = async (filePath, data) => {
  try {
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonContent, 'utf8');
  } catch (error) {
    throw new Error(`Failed to write JSON file: ${error.message}`);
  }
};
