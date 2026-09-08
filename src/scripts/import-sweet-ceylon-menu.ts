import 'dotenv/config';
import { access } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';

import MenuItem from '../models/MenuItem.model';
import Restaurant from '../models/Restaurant.model';

type SweetMenuDefinition = {
    name: string;
    description: string;
    price: number;
    imageUrl: string;
};

const SWEET_MENU: readonly SweetMenuDefinition[] = [
    {
        name: 'Konda Kawum',
        description:
            'Deep golden-brown oil cakes with their traditional raised konda tops.',
        price: 220,
        imageUrl: '/images/food/kavum.jpg',
    },
    {
        name: 'Handi Kawum',
        description:
            'Flat, round rice-flour cakes fried to a warm golden brown.',
        price: 200,
        imageUrl: '/images/food/handi_kawum.jpg',
    },
    {
        name: 'Kokis',
        description:
            'Crisp flower-shaped rice-flour treats, a festive Sri Lankan favourite.',
        price: 180,
        imageUrl: '/images/food/kokis.jpg',
    },
    {
        name: 'Pani Walalu',
        description:
            'Handmade flower-like tangled loops soaked in fragrant treacle.',
        price: 280,
        imageUrl: '/images/food/pani_walalu.jpg',
    },
    {
        name: 'Mung Kawum',
        description:
            'Folded mung-filled pieces with yellow coating and browned fried edges.',
        price: 240,
        imageUrl: '/images/food/mung_kavum.jpg',
    },
    {
        name: 'Mun Guli',
        description:
            'Rustic mung balls with a coarse golden surface and caramelised patches.',
        price: 220,
        imageUrl: '/images/food/mun_guli.jpg',
    },
    {
        name: 'Laveria',
        description:
            'Soft white string-hopper rolls filled with coconut and jaggery.',
        price: 260,
        imageUrl: '/images/food/lavariya.jpg',
    },
    {
        name: 'Coconut Pancake',
        description:
            'Smooth golden pancakes rolled around sweet coconut and treacle.',
        price: 240,
        imageUrl: '/images/food/pancake.jpg',
    },
    {
        name: 'Aasmi',
        description:
            'Delicate white lacy pieces decorated with ribbons of brown syrup.',
        price: 260,
        imageUrl: '/images/food/asmi.jpg',
    },
    {
        name: 'Gotu Pittu',
        description:
            'Small traditional pittu portions prepared in folded leaf cups.',
        price: 300,
        imageUrl: '/images/food/gotu_pittu.jpg',
    },
    {
        name: 'Puhul Dosi',
        description:
            'Soft crystallised winter-melon confection with a delicate sweetness.',
        price: 190,
        imageUrl: '/images/food/puhul_dosi.jpg',
    },
    {
        name: 'Kiri Toffee',
        description:
            'Rich Sri Lankan milk toffee cut into soft, creamy squares.',
        price: 240,
        imageUrl: '/images/food/kiri_toffee.jpg',
    },
    {
        name: 'Sau Dodol',
        description: 'Glossy, slow-cooked coconut and jaggery confection.',
        price: 280,
        imageUrl: '/images/food/sau_dodol.jpg',
    },
    {
        name: 'Pani Aluwa',
        description: 'Rice-flour diamonds sweetened with coconut treacle.',
        price: 210,
        imageUrl: '/images/food/pani_aluwa.jpg',
    },
    {
        name: 'Boondi',
        description:
            'Tiny golden gram-flour pearls lightly bound with sugar syrup.',
        price: 180,
        imageUrl: '/images/food/boondi.jpg',
    },
    {
        name: 'Aggala',
        description:
            'Traditional roasted-rice and coconut balls sweetened with treacle.',
        price: 190,
        imageUrl: '/images/food/aggala.jpg',
    },
];

const normalizeName = (value: string): string =>
    value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');

const printSummary = (
    created: number,
    skipped: number,
    failed: number
): void => {
    console.log(`created: ${created}`);
    console.log(`skipped: ${skipped}`);
    console.log(`failed: ${failed}`);
};

const importSweetCeylonMenu = async (): Promise<void> => {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI is not configured');

    // Fail before any database writes if a backend-served source image is missing.
    for (const item of SWEET_MENU) {
        const relativeImagePath = item.imageUrl.replace(/^\/images\//, '');
        await access(path.join(process.cwd(), 'public', relativeImagePath));
    }

    await mongoose.connect(mongoUri);

    const restaurants = await Restaurant.find({ name: /^Sweet Ceylon$/i })
        .select('_id')
        .lean();
    if (restaurants.length !== 1) {
        throw new Error('Expected exactly one Sweet Ceylon restaurant');
    }

    const restaurantId = restaurants[0]._id;
    const existing = await MenuItem.find({ restaurant: restaurantId })
        .select('name')
        .lean();
    const existingNames = new Set(
        existing.map((item) => normalizeName(item.name))
    );

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of SWEET_MENU) {
        const key = normalizeName(item.name);
        if (existingNames.has(key)) {
            skipped += 1;
            continue;
        }

        try {
            await MenuItem.create({
                ...item,
                category: 'Sweets',
                restaurant: restaurantId,
                available: true,
            });
            existingNames.add(key);
            created += 1;
        } catch {
            failed += 1;
        }
    }

    printSummary(created, skipped, failed);
};

importSweetCeylonMenu()
    .catch(() => {
        printSummary(0, 0, SWEET_MENU.length);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });
