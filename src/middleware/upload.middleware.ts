import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { ApiError } from '../utils/ApiError';
import { IMAGE_MAX_BYTES, IMAGE_TYPES } from '../config/restaurant';

const ALLOWED = IMAGE_TYPES;

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: IMAGE_MAX_BYTES },
    fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileFilterCallback
    ) => {
        if (ALLOWED.includes(file.mimetype)) {
            cb(null, true);
            return;
        }

        cb(new ApiError(400, 'Only JPG, PNG, WEBP allowed'));
    },
});

export const uploadSingle = upload.single('image');
export const uploadMultiple = upload.array('images', 5);
