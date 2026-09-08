import mongoose, { Document, Schema } from 'mongoose';

export enum DeliveryAssignmentStatus {
    ASSIGNED = 'assigned',
    ACCEPTED = 'accepted',
    PICKED_UP = 'picked_up',
    OUT_FOR_DELIVERY = 'out_for_delivery',
    DELIVERED = 'delivered',
    FAILED = 'failed',
    REJECTED = 'rejected',
}

export interface IDeliveryAssignment extends Document {
    order: mongoose.Types.ObjectId;
    rider: mongoose.Types.ObjectId;
    status: DeliveryAssignmentStatus;
    assignedAt: Date;
    acceptedAt?: Date;
    pickedUpAt?: Date;
    outForDeliveryAt?: Date;
    deliveredAt?: Date;
    failedAt?: Date;
    payout: number;
}

const DeliveryAssignmentSchema = new Schema<IDeliveryAssignment>(
    {
        order: {
            type: Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
        },
        rider: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        status: {
            type: String,
            enum: Object.values(DeliveryAssignmentStatus),
            default: DeliveryAssignmentStatus.ASSIGNED,
        },
        assignedAt: { type: Date, default: Date.now },
        acceptedAt: Date,
        pickedUpAt: Date,
        outForDeliveryAt: Date,
        deliveredAt: Date,
        failedAt: Date,
        payout: { type: Number, required: true, min: 0, default: 0 },
    },
    { timestamps: true }
);

DeliveryAssignmentSchema.index({ rider: 1, status: 1 });
DeliveryAssignmentSchema.index({ order: 1, createdAt: -1 });

export default mongoose.model<IDeliveryAssignment>(
    'DeliveryAssignment',
    DeliveryAssignmentSchema
);
