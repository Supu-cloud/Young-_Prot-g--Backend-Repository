import mongoose from 'mongoose';

import '../config/env';
import connectDB from '../config/db';
import Cart from '../models/Cart.model';
import DeliveryAssignment from '../models/DeliveryAssignment.model';
import DeliveryRiderProfile from '../models/DeliveryRiderProfile.model';
import Order from '../models/Order.model';
import Restaurant from '../models/Restaurant.model';
import RestaurantOwnerProfile from '../models/RestaurantOwnerProfile.model';
import Review from '../models/Review.model';
import User from '../models/User.model';
import { UserRole } from '../types/enums';

const targetEmails = [
    'supuniwelarupitiya64@gmail.com',
    'supuniclass@gmail.com',
].map((email) => email.trim().toLowerCase());

type SafeUser = {
    _id: mongoose.Types.ObjectId;
    name: string;
    email: string;
    role: string;
    accountStatus: string;
    isEmailVerified?: boolean;
    createdAt?: Date;
};

const id = (value: unknown): string => String(value);

const printUser = (label: string, user: SafeUser): void => {
    console.log(`${label}:`);
    console.log(`  _id: ${id(user._id)}`);
    console.log(`  name: ${user.name}`);
    console.log(`  email: ${user.email}`);
    console.log(`  role: ${user.role}`);
    console.log(`  accountStatus: ${user.accountStatus}`);
    console.log(`  isEmailVerified: ${user.isEmailVerified === true}`);
    console.log(
        `  createdAt: ${user.createdAt?.toISOString() ?? 'not available'}`
    );
};

const referenceSummary = async (userId: mongoose.Types.ObjectId) => {
    const [
        ordersAsCustomer,
        ordersAsRider,
        carts,
        assignments,
        restaurants,
        ownerProfiles,
        riderProfiles,
        reviews,
    ] = await Promise.all([
        Order.find({ customer: userId }).select('_id').lean(),
        Order.find({ deliveryRider: userId }).select('_id').lean(),
        Cart.find({ customer: userId }).select('_id').lean(),
        DeliveryAssignment.find({ rider: userId }).select('_id').lean(),
        Restaurant.find({ owner: userId }).select('_id name').lean(),
        RestaurantOwnerProfile.find({ user: userId }).select('_id').lean(),
        DeliveryRiderProfile.find({ user: userId })
            .select('_id isAvailable')
            .lean(),
        Review.find({ customer: userId }).select('_id restaurant').lean(),
    ]);

    return [
        { model: 'Order', field: 'customer', records: ordersAsCustomer },
        { model: 'Order', field: 'deliveryRider', records: ordersAsRider },
        { model: 'Cart', field: 'customer', records: carts },
        { model: 'DeliveryAssignment', field: 'rider', records: assignments },
        { model: 'Restaurant', field: 'owner', records: restaurants },
        {
            model: 'RestaurantOwnerProfile',
            field: 'user',
            records: ownerProfiles,
        },
        {
            model: 'DeliveryRiderProfile',
            field: 'user',
            records: riderProfiles,
        },
        { model: 'Review', field: 'customer', records: reviews },
    ];
};

const printReferences = async (
    user: SafeUser,
    label: string
): Promise<void> => {
    const references = await referenceSummary(user._id);
    console.log(`${label} references:`);
    let total = 0;
    for (const reference of references) {
        if (reference.records.length === 0) continue;
        total += reference.records.length;
        console.log(
            `  ${reference.model}.${reference.field}: ${reference.records.length}`
        );
        console.log(
            `    documentIds: ${reference.records.map((record) => id(record._id)).join(', ')}`
        );
    }
    if (total === 0) console.log('  none');
};

const printOwnerRelationship = async (user: SafeUser): Promise<void> => {
    const restaurants = await Restaurant.find({ owner: user._id })
        .select('_id name')
        .lean();
    console.log('  restaurant relationship:');
    console.log(`    owner user _id: ${id(user._id)}`);
    if (restaurants.length === 0) {
        console.log('    linked restaurant: none');
        console.log('    relationship valid: no');
        return;
    }
    for (const restaurant of restaurants) {
        console.log(`    linked restaurant _id: ${id(restaurant._id)}`);
        console.log(`    restaurant name: ${restaurant.name}`);
    }
    console.log('    relationship valid: yes');
};

const printRiderRelationship = async (user: SafeUser): Promise<void> => {
    const profiles = await DeliveryRiderProfile.find({ user: user._id })
        .select('_id isAvailable')
        .lean();
    console.log('  rider profile relationship:');
    console.log(`    rider user _id: ${id(user._id)}`);
    if (profiles.length === 0) {
        console.log('    rider/profile _id: none');
        console.log('    relationship valid: no');
        return;
    }
    for (const profile of profiles) {
        console.log(`    rider/profile _id: ${id(profile._id)}`);
        console.log(
            `    availability: ${profile.isAvailable ? 'available' : 'offline'}`
        );
    }
    console.log('    relationship valid: yes');
};

const audit = async (): Promise<void> => {
    await connectDB();
    console.log('READ-ONLY duplicate-user audit');
    console.log('No write operations are performed by this script.');

    const users = await User.find({ email: { $in: targetEmails } })
        .select('_id name email role accountStatus isEmailVerified createdAt')
        .lean<SafeUser[]>();

    for (const email of targetEmails) {
        const matches = users.filter(
            (user) => user.email.trim().toLowerCase() === email
        );
        const keepRole =
            email === targetEmails[0]
                ? UserRole.RESTAURANT_OWNER
                : UserRole.DELIVERY_RIDER;
        const keepers = matches.filter((user) => user.role === keepRole);
        const duplicates = matches.filter(
            (user) => user.role === UserRole.CUSTOMER
        );

        console.log(`\n${email}`);
        if (matches.length === 0) {
            console.log('  matching records: none');
            continue;
        }
        console.log(`  matching records: ${matches.length}`);
        for (const user of matches) {
            const label =
                user.role === keepRole
                    ? 'KEEP'
                    : user.role === UserRole.CUSTOMER
                      ? 'DUPLICATE CANDIDATE'
                      : 'OTHER ROLE';
            printUser(label, user);
        }

        console.log(
            `  KEEP ${keepRole} _id: ${keepers.map((user) => id(user._id)).join(', ') || 'none'}`
        );
        console.log(
            `  DUPLICATE customer _id(s): ${duplicates.map((user) => id(user._id)).join(', ') || 'none'}`
        );
        for (const duplicate of duplicates)
            await printReferences(
                duplicate,
                `  duplicate ${id(duplicate._id)}`
            );

        for (const keeper of keepers) {
            if (keepRole === UserRole.RESTAURANT_OWNER)
                await printOwnerRelationship(keeper);
            if (keepRole === UserRole.DELIVERY_RIDER)
                await printRiderRelationship(keeper);
        }
    }

    console.log('\nPROPOSED CLEANUP PLAN');
    console.log(
        '1. Review the printed duplicate references and confirm the intended keeper account.'
    );
    console.log(
        '2. Export a backup and obtain explicit approval for any account merge or deletion.'
    );
    console.log(
        '3. Reassign or preserve every verified reference before removing a duplicate.'
    );
    console.log(
        '4. Perform cleanup in a separate approved migration; do not use this audit script for cleanup.'
    );
    console.log('\nNO DATABASE RECORD WAS MODIFIED OR DELETED.');
};

audit()
    .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Audit failed';
        console.error(`Audit failed: ${message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    });
