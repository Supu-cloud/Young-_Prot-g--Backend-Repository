export enum UserRole {
    CUSTOMER = 'customer',
    RESTAURANT_OWNER = 'restaurant_owner',
    DELIVERY_RIDER = 'delivery_rider',
    ADMIN = 'admin',
}

export enum AccountStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    SUSPENDED = 'suspended',
}

export enum OrderStatus {
    PLACED = 'placed',
    ACCEPTED = 'accepted',
    DECLINED = 'declined',
    CONFIRMED = 'confirmed',
    PREPARING = 'preparing',
    READY_FOR_PICKUP = 'ready_for_pickup',
    RIDER_ASSIGNED = 'rider_assigned',
    PICKED_UP = 'picked_up',
    OUT_FOR_DELIVERY = 'out_for_delivery',
    DELIVERED = 'delivered',
    DELIVERY_FAILED = 'delivery_failed',
    CANCELLED = 'cancelled',
}

export enum PaymentStatus {
    PENDING = 'pending',
    PAID = 'paid',
    FAILED = 'failed',
}
