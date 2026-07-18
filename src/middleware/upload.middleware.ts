import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { ApiError } from '../utils/ApiError';

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    ALLOWED.includes(file.mimetype)
      ? cb(null, true)
      : cb(new ApiError(400, 'Only JPG, PNG, WEBP allowed') as unknown as null, false);
  },
});

export const uploadSingle   = upload.single('image');
export const uploadMultiple = upload.array('images', 5);