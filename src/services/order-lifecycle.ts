import { OrderStatus, UserRole } from '../types/enums';
import { ApiError } from '../utils/ApiError';

export const lifecycle = [
    'placed',
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'rider_assigned',
    'picked_up',
    'out_for_delivery',
    'delivered',
] as const;
export const timestampFor: Partial<Record<OrderStatus, string>> = {
    placed: 'placedAt',
    confirmed: 'confirmedAt',
    preparing: 'preparingAt',
    ready_for_pickup: 'readyForPickupAt',
    rider_assigned: 'riderAssignedAt',
    picked_up: 'pickedUpAt',
    out_for_delivery: 'outForDeliveryAt',
    delivered: 'deliveredAt',
    cancelled: 'cancelledAt',
    declined: 'cancelledAt',
};

export function assertTransition(
    from: OrderStatus,
    to: OrderStatus,
    role: UserRole
): void {
    const owner: Partial<Record<OrderStatus, OrderStatus[]>> = {
        placed: [
            OrderStatus.CONFIRMED,
            OrderStatus.ACCEPTED,
            OrderStatus.DECLINED,
        ],
        accepted: [OrderStatus.CONFIRMED],
        confirmed: [OrderStatus.PREPARING],
        preparing: [OrderStatus.READY_FOR_PICKUP],
    };
    const rider: Partial<Record<OrderStatus, OrderStatus[]>> = {
        rider_assigned: [OrderStatus.PICKED_UP],
        picked_up: [OrderStatus.OUT_FOR_DELIVERY],
        out_for_delivery: [OrderStatus.DELIVERED],
    };
    const allowed =
        role === UserRole.DELIVERY_RIDER
            ? rider[from]
            : role === UserRole.CUSTOMER
              ? from === OrderStatus.PLACED
                  ? [OrderStatus.CANCELLED]
                  : []
              : owner[from];
    if (!allowed?.includes(to)) {
        throw new ApiError(
            409,
            `Cannot change order from ${from} to ${to} as ${role}`
        );
    }
}

export function settlementFor(subtotal: number, deliveryFee: number) {
    return {
        restaurantAmount: subtotal,
        riderAmount: deliveryFee,
        restaurantStatus: 'pending',
        riderStatus: 'pending',
    };
}
