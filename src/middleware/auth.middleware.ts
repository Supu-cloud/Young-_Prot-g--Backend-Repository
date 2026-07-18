import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../types/enums';
import { ApiError } from '../utils/ApiError';

interface JwtPayload { id: string; role: UserRole; }

export const protect = (req: Request, _res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { next(new ApiError(401, 'Not authorized — no token')); return; }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired token'));
  }
};

export const adminOnly = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.user?.role !== UserRole.ADMIN) {
    next(new ApiError(403, 'Admin access only')); return;
  }
  next();
};