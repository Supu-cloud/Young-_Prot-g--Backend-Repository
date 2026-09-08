export const RESTAURANT_CATEGORIES = [
    'Sri Lankan',
    'Breakfast',
    'Kottu',
    'Rice & Curry',
    'Short Eats',
    'Burgers',
    'Pizza',
    'Desserts',
    'Sweets',
    'Healthy',
    'Beverages',
    'Other',
] as const;

export const RESTAURANT_DAYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
] as const;

export const RESTAURANT_LIMITS = { name: 120, description: 2000, address: 500 };
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
];
// Sri Lankan landline/mobile, local or international form; spaces and hyphens allowed.
export const RESTAURANT_PHONE_PATTERN =
    '^(?:0[1-9][0-9]{8}|\\+94[1-9][0-9]{8})$';
