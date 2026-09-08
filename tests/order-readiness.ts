import 'dotenv/config';
import mongoose from 'mongoose';
import Stripe from 'stripe';

async function main() {
    const result: Record<string, unknown> = {
        mongoConfigured: Boolean(process.env.MONGO_URI),
        stripeTestConfigured: /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? ''),
    };
    try {
        await mongoose.connect(process.env.MONGO_URI!, { serverSelectionTimeoutMS: 5000, autoIndex: false });
        const db = mongoose.connection.db!;
        const hello = await db.admin().command({ hello: 1 });
        result.transactionsSupported = Boolean(hello.setName || hello.msg === 'isdbgrid');
        result.approvedRoles = await db.collection('users').aggregate([
            { $match: { accountStatus: 'approved', isEmailVerified: true } },
            { $group: { _id: '$role', count: { $sum: 1 } } },
        ]).toArray();
        result.availableProfiles = await db.collection('deliveryriderprofiles').countDocuments({ isAvailable: true });
        result.openRestaurants = await db.collection('restaurants').countDocuments({ isOpen: true, owner: { $exists: true } });
        const owners = await db.collection('users').find({ role: 'restaurant_owner', accountStatus: 'approved', isEmailVerified: true }).project({ _id: 1 }).toArray();
        result.approvedOwnerRestaurants = await db.collection('restaurants').aggregate([
            { $match: { owner: { $in: owners.map(owner => owner._id) } } },
            { $lookup: { from: 'menuitems', localField: '_id', foreignField: 'restaurant', as: 'menu' } },
            { $project: { name: 1, isOpen: 1, menuCount: { $size: '$menu' }, availableItems: { $size: { $filter: { input: '$menu', as: 'item', cond: { $eq: ['$$item.available', true] } } } } } },
        ]).toArray();
        result.mongoReachable = true;
    } catch { result.mongoReachable = false; }
    finally { await mongoose.disconnect(); }
    if (result.stripeTestConfigured) {
        try {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 5000, maxNetworkRetries: 0 });
            const balance = await stripe.balance.retrieve();
            result.stripeReachable = true; result.stripeLiveMode = balance.livemode;
        } catch { result.stripeReachable = false; }
    }
    console.log(JSON.stringify(result));
    if (result.mongoReachable === false || result.stripeReachable === false) { process.exitCode = 1; }
}
void main();
