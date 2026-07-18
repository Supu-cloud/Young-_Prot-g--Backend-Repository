import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

export const validateFields = (fields: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const missing = fields.filter((f) => !req.body[f] && req.body[f] !== 0);
    if (missing.length > 0) {
      next(new ApiError(400, `Missing required fields: ${missing.join(', ')}`)); return;
    }
    next();
  };