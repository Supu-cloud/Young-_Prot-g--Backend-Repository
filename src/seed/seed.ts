import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Models
import User from '../models/User.model';
import Restaurant from '../models/Restaurant.model';
import MenuItem from '../models/MenuItem.model';
import Order from '../models/Order.model';
import Review from '../models/Review.model';

// Sample data
import { sampleUsers } from './data/users';
import { sampleRestaurants } from './data/restaurants';
import { sampleMenuItems } from './data/menuItems';

const seedDatabase = async () => {
    try {
        // 1. Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log('✅ MongoDB connected!');

        // 2. Clear existing data
        console.log('\n🗑️  Clearing existing data...');
        await Promise.all([
            User.deleteMany({}),
            Restaurant.deleteMany({}),
            MenuItem.deleteMany({}),
            Order.deleteMany({}),
            Review.deleteMany({}),
        ]);
        console.log('✅ All collections cleared!');

        // 3. Seed Users
        console.log('\n👤 Seeding users...');
        const hashedUsers = await Promise.all(
            sampleUsers.map(async (user) => ({
                ...user,
                password: await bcrypt.hash(user.password, 10),
            }))
        );
        const createdUsers = await User.insertMany(hashedUsers);
        console.log(`✅ ${createdUsers.length} users created!`);

        const customers = createdUsers.filter((u) => u.role === 'customer');
        const restaurantOwner = createdUsers.find(
            (u) => u.role === 'restaurant_owner'
        );

        // 4. Seed Restaurants
        console.log('\n🍽️  Seeding restaurants...');
        const restaurantsWithOwner = sampleRestaurants.map((r) => ({
            ...r,
            owner: restaurantOwner?._id,
        }));
        const createdRestaurants =
            await Restaurant.insertMany(restaurantsWithOwner);
        console.log(`✅ ${createdRestaurants.length} restaurants created!`);

        // 5. Seed Menu Items
        console.log('\n🍕 Seeding menu items...');
        const menuItemsWithRestaurant = sampleMenuItems.map((item) => ({
            name: item.name,
            price: item.price,
            category: item.category,
            description: item.description,
            imageUrl: item.imageUrl,
            available: true,
            restaurant: createdRestaurants[item.restaurantIndex]._id,
        }));
        const createdMenuItems = await MenuItem.insertMany(
            menuItemsWithRestaurant
        );
        console.log(`✅ ${createdMenuItems.length} menu items created!`);

        // 6. Seed Sample Orders
        console.log('\n📦 Seeding sample orders...');
        const pizzaItems = createdMenuItems.filter(
            (item) =>
                item.restaurant.toString() ===
                createdRestaurants[0]._id.toString()
        );

        const sampleOrders = [
            {
                customer: customers[0]._id,
                restaurant: createdRestaurants[0]._id,
                items: [
                    {
                        menuItem: pizzaItems[0]._id,
                        name: pizzaItems[0].name,
                        quantity: 2,
                        price: pizzaItems[0].price,
                    },
                    {
                        menuItem: pizzaItems[3]._id,
                        name: pizzaItems[3].name,
                        quantity: 1,
                        price: pizzaItems[3].price,
                    },
                ],
                totalAmount: pizzaItems[0].price * 2 + pizzaItems[3].price,
                status: 'delivered',
                deliveryAddress: 'No. 45, Kandy Road, Colombo',
                paymentStatus: 'paid',
            },
            {
                customer: customers[1]._id,
                restaurant: createdRestaurants[1]._id,
                items: [
                    {
                        menuItem: createdMenuItems[5]._id,
                        name: createdMenuItems[5].name,
                        quantity: 1,
                        price: createdMenuItems[5].price,
                    },
                    {
                        menuItem: createdMenuItems[8]._id,
                        name: createdMenuItems[8].name,
                        quantity: 2,
                        price: createdMenuItems[8].price,
                    },
                ],
                totalAmount:
                    createdMenuItems[5].price + createdMenuItems[8].price * 2,
                status: 'preparing',
                deliveryAddress: 'No. 12, Galle Road, Gampaha',
                paymentStatus: 'paid',
            },
        ];

        const createdOrders = await Order.insertMany(sampleOrders);
        console.log(`✅ ${createdOrders.length} orders created!`);

        // 7. Seed Reviews
        console.log('\n⭐ Seeding reviews...');
        const sampleReviews = [
            {
                customer: customers[0]._id,
                restaurant: createdRestaurants[0]._id,
                rating: 5,
                comment: 'Amazing pizza! Best in Colombo 🍕',
            },
            {
                customer: customers[1]._id,
                restaurant: createdRestaurants[1]._id,
                rating: 4,
                comment: 'Great burgers, fast delivery!',
            },
        ];
        const createdReviews = await Review.insertMany(sampleReviews);
        console.log(`✅ ${createdReviews.length} reviews created!`);

        // 8. Print Summary
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 DATABASE SEEDED SUCCESSFULLY!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`👤 Users:       ${createdUsers.length}`);
        console.log(`🍽️  Restaurants: ${createdRestaurants.length}`);
        console.log(`🍕 Menu Items:  ${createdMenuItems.length}`);
        console.log(`📦 Orders:      ${createdOrders.length}`);
        console.log(`⭐ Reviews:     ${createdReviews.length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📧 Login Credentials:');
        console.log('   Admin:    admin@foodapp.com    / admin123');
        console.log('   Customer: vihanga@foodapp.com  / test123');
        console.log('   Customer: supuni@foodapp.com   / test123');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (error) {
        console.error('❌ Seed failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 MongoDB disconnected');
        process.exit(0);
    }
};

seedDatabase();
