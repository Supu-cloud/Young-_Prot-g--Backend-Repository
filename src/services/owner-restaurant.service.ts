import Restaurant from '../models/Restaurant.model';
import { ApiError } from '../utils/ApiError';
import { validateRestaurantInput } from './restaurant-validation';
import { validateRestaurantLogo } from './restaurant-logo.service';

let ownerIndex: Promise<void> | undefined;
// Remove the legacy one-restaurant-per-owner index without changing any records.
export async function ensureRestaurantOwnerIndex() {
    ownerIndex ??= (async () => {
        const current = (await Restaurant.collection.indexes()).find(
            (index) => index.name === 'restaurant_owner_unique'
        );
        if (current)
            await Restaurant.collection.dropIndex('restaurant_owner_unique');
    })().catch(() => {
        ownerIndex = undefined;
        throw new ApiError(
            503,
            'Restaurant owner assignment setup is temporarily unavailable. Please contact support.'
        );
    });
    await ownerIndex;
}

export async function saveOwnerRestaurant(ownerId: string, body: unknown) {
    const values = validateRestaurantInput(body);
    const existing = await Restaurant.findOne({ owner: ownerId });
    await validateRestaurantLogo(values.imageUrl, ownerId, existing?.imageUrl);
    await ensureRestaurantOwnerIndex();
    try {
        return await Restaurant.findOneAndUpdate(
            { owner: ownerId },
            { $set: values, $setOnInsert: { owner: ownerId } },
            {
                upsert: true,
                new: true,
                runValidators: true,
                setDefaultsOnInsert: true,
            }
        );
    } catch (error) {
        // A concurrent first save can lose the insert race; update the winning record.
        if ((error as { code?: number }).code !== 11000) throw error;
        return Restaurant.findOneAndUpdate(
            { owner: ownerId },
            { $set: values },
            { new: true, runValidators: true }
        );
    }
}
