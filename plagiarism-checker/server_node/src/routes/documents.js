import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';
import { processUploadedDocument, listServerDocuments } from '../services/document-service.js';
import { fileExtension, makeStorageFileName, restoreUtf8FileName } from '../utils/file-name.js';

const router = express.Router();
const uploadDir = path.resolve('storage/uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const allowedExtensions = new Set(['.doc', '.docx']);
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    file.displayName = restoreUtf8FileName(file.originalname);
    cb(null, makeStorageFileName(file.displayName, fileExtension(file.displayName)));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.uploadLimitMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const displayName = restoreUtf8FileName(file.originalname);
    const ext = fileExtension(displayName);
    if (!allowedExtensions.has(ext)) {
      return cb(Object.assign(new Error('Разрешены только файлы .doc и .docx'), { statusCode: 422 }));
    }
    file.displayName = displayName;
    cb(null, true);
  }
});

router.post('/check', upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(422).json({ error: 'Document file is required' });
    req.file.displayName = restoreUtf8FileName(req.file.displayName || req.file.originalname);
    const result = await processUploadedDocument(req.file, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    res.json(await listServerDocuments());
  } catch (error) {
    next(error);
  }
});

export default router;
