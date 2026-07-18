import { Request, Response } from 'express';
import Review from '../models/Review.model';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const getReviews = asyncHandler(async (req: Request, res: Response) => {
  const reviews = await Review.find({ restaurant: req.params.restaurantId }).populate('customer', 'name');
  res.json(ApiResponse.ok(reviews));
});

export const addReview = asyncHandler(async (req: Request, res: Response) => {
  const { restaurant, rating, comment } = req.body;
  const existing = await Review.findOne({ customer: req.user?.id, restaurant });
  if (existing) throw new ApiError(400, 'Already reviewed this restaurant');
  const review = await Review.create({ customer: req.user?.id, restaurant, rating, comment });
  res.status(201).json(ApiResponse.ok(review, 'Review added'));
});

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError(404, 'Review not found');
  if (review.customer.toString() !== req.user?.id) throw new ApiError(403, 'Not authorized');
  await review.deleteOne();
  res.json(ApiResponse.ok(null, 'Review deleted'));
});