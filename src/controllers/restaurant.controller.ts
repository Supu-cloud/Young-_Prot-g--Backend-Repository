import { Request, Response } from 'express';
import Restaurant from '../models/Restaurant.model';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const getAllRestaurants = asyncHandler(async (req: Request, res: Response) => {
  const { category, search } = req.query;
  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (search)   filter.name     = { $regex: search, $options: 'i' };
  const restaurants = await Restaurant.find(filter).populate('owner', 'name email');
  res.json(ApiResponse.ok(restaurants));
});

export const getRestaurantById = asyncHandler(async (req: Request, res: Response) => {
  const restaurant = await Restaurant.findById(req.params.id).populate('owner', 'name email');
  if (!restaurant) throw new ApiError(404, 'Restaurant not found');
  res.json(ApiResponse.ok(restaurant));
});

export const createRestaurant = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, address, phone, category, imageUrl } = req.body;
  if (!name || !description || !address || !phone || !category)
    throw new ApiError(400, 'All fields required');
  const restaurant = await Restaurant.create({ name, description, address, phone, category, imageUrl, owner: req.user?.id });
  res.status(201).json(ApiResponse.ok(restaurant, 'Restaurant created'));
});

export const updateRestaurant = asyncHandler(async (req: Request, res: Response) => {
  const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!restaurant) throw new ApiError(404, 'Restaurant not found');
  res.json(ApiResponse.ok(restaurant, 'Restaurant updated'));
});

export const deleteRestaurant = asyncHandler(async (req: Request, res: Response) => {
  const restaurant = await Restaurant.findByIdAndDelete(req.params.id);
  if (!restaurant) throw new ApiError(404, 'Restaurant not found');
  res.json(ApiResponse.ok(null, 'Restaurant deleted'));
});

export const toggleRestaurantStatus = asyncHandler(async (req: Request, res: Response) => {
  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) throw new ApiError(404, 'Restaurant not found');
  restaurant.isOpen = !restaurant.isOpen;
  await restaurant.save();
  res.json(ApiResponse.ok(restaurant, `Restaurant is now ${restaurant.isOpen ? 'open' : 'closed'}`));
});