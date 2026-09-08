import { randomUUID } from 'crypto';
import { mkdir, stat, writeFile } from 'fs/promises';
import path from 'path';
import { IMAGE_MAX_BYTES, IMAGE_TYPES } from '../config/restaurant';
import { ApiError } from '../utils/ApiError';

const logoError = (message: string) =>
    new ApiError(400, message, { imageUrl: message });
export function restaurantImageExtension(file: Express.Multer.File): string {
    const b = file.buffer;
    if (!b.length || b.length > IMAGE_MAX_BYTES)
        throw logoError('Choose an image no larger than 5 MB.');
    if (!IMAGE_TYPES.includes(file.mimetype))
        throw logoError('Choose a JPG, PNG or WebP image.');
    if (
        ['image/jpeg', 'image/jpg'].includes(file.mimetype) &&
        b[0] === 0xff &&
        b[1] === 0xd8 &&
        b[2] === 0xff
    )
        return 'jpg';
    if (
        file.mimetype === 'image/png' &&
        b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
        return 'png';
    if (
        file.mimetype === 'image/webp' &&
        b.toString('ascii', 0, 4) === 'RIFF' &&
        b.toString('ascii', 8, 12) === 'WEBP'
    )
        return 'webp';
    throw logoError(
        'This file does not match its image type. Choose a valid JPG, PNG or WebP.'
    );
}

export async function storeRestaurantLogo(
    file: Express.Multer.File,
    ownerId: string
) {
    const extension = restaurantImageExtension(file);
    const filename = `${ownerId}-${randomUUID()}.${extension}`;
    const directory = path.join(process.cwd(), 'public', 'restaurants');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), file.buffer, {
        flag: 'wx',
    });
    return `/images/restaurants/${filename}`;
}

export async function validateRestaurantLogo(
    value: unknown,
    ownerId: string,
    existing?: string
) {
    if (value === undefined || value === '' || value === existing) return;
    if (
        typeof value !== 'string' ||
        !new RegExp(
            `^/images/restaurants/${ownerId}-[a-f0-9-]{36}\\.(jpg|png|webp)$`
        ).test(value)
    ) {
        throw logoError('Upload a logo using your restaurant account.');
    }
    const file = await stat(
        path.join(process.cwd(), 'public', 'restaurants', path.basename(value))
    ).catch(() => null);
    if (!file?.isFile())
        throw logoError(
            'This upload is no longer available. Please upload your logo again.'
        );
}
