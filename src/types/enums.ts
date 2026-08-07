export enum UserRole {
    CUSTOMER = 'customer',
    ADMIN = 'admin',
}

export enum OrderStatus {
    PLACED = 'placed',
    CONFIRMED = 'confirmed',
    PREPARING = 'preparing',
    OUT_FOR_DELIVERY = 'out_for_delivery',
    DELIVERED = 'delivered',
    CANCELLED = 'cancelled',
}

export enum PaymentStatus {
    PENDING = 'pending',
    PAID = 'paid',
    FAILED = 'failed',
}
