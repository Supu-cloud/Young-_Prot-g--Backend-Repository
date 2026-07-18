import { Request, Response } from 'express';
import Order from '../models/Order.model';
import MenuItem from '../models/MenuItem.model';
import { OrderStatus } from '../types/enums';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const placeOrder = asyncHandler(async (req: Request, res: Response) => {
  const { restaurant, items, deliveryAddress, note } = req.body;
  if (!items || items.length === 0) throw new ApiError(400, 'Order must have at least one item');

  let totalAmount = 0;
  const orderItems = [];

  for (const cartItem of items) {
    const menuItem = await MenuItem.findById(cartItem.menuItem);
    if (!menuItem)          throw new ApiError(404, `Menu item not found`);
    if (!menuItem.available) throw new ApiError(400, `${menuItem.name} is unavailable`);
    totalAmount += menuItem.price * cartItem.quantity;
    orderItems.push({ menuItem: menuItem._id, name: menuItem.name, quantity: cartItem.quantity, price: menuItem.price });
  }

  const order = await Order.create({ customer: req.user?.id, restaurant, items: orderItems, totalAmount, deliveryAddress, note });
  res.status(201).json(ApiResponse.ok(order, 'Order placed successfully'));
});

export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
  const orders = await Order.find({ customer: req.user?.id })
    .populate('restaurant', 'name imageUrl').sort({ createdAt: -1 });
  res.json(ApiResponse.ok(orders));
});

export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id)
    .populate('customer', 'name email phone')
    .populate('restaurant', 'name address phone');
  if (!order) throw new ApiError(404, 'Order not found');
  if (req.user?.role !== 'admin' && order.customer.toString() !== req.user?.id)
    throw new ApiError(403, 'Not authorized');
  res.json(ApiResponse.ok(order));
});

export const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  const orders = await Order.find(filter)
    .populate('customer', 'name email').populate('restaurant', 'name').sort({ createdAt: -1 });
  res.json(ApiResponse.ok(orders));
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!Object.values(OrderStatus).includes(status)) throw new ApiError(400, 'Invalid status');
  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!order) throw new ApiError(404, 'Order not found');
  res.json(ApiResponse.ok(order, `Status updated to ${status}`));
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.customer.toString() !== req.user?.id) throw new ApiError(403, 'Not authorized');
  if (['delivered', 'cancelled'].includes(order.status)) throw new ApiError(400, 'Cannot cancel');
  order.status = OrderStatus.CANCELLED;
  await order.save();
  res.json(ApiResponse.ok(order, 'Order cancelled'));
});