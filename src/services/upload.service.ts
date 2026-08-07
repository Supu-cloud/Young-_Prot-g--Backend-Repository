import {
    v2 as cloudinary,
    type UploadApiOptions,
    type UploadApiResponse,
} from 'cloudinary';

import { ApiError } from '../utils/ApiError';

export interface UploadedImage {
    publicId: string;
    url: string;
    width: number;
    height: number;
    format: string;
}

let configured = false;

const requireCloudinaryEnv = (name: string): string => {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new ApiError(500, `${name} is not configured`);
    }

    return value;
};

const configureCloudinary = (): void => {
    if (configured) {
        return;
    }

    cloudinary.config({
        cloud_name: requireCloudinaryEnv('CLOUDINARY_CLOUD_NAME'),
        api_key: requireCloudinaryEnv('CLOUDINARY_API_KEY'),
        api_secret: requireCloudinaryEnv('CLOUDINARY_API_SECRET'),
        secure: true,
    });
    configured = true;
};

export const uploadImage = async (
    buffer: Buffer,
    folder = 'food-ordering'
): Promise<UploadedImage> => {
    if (!buffer.length) {
        throw new ApiError(400, 'An image file is required');
    }

    configureCloudinary();

    const options: UploadApiOptions = {
        folder,
        resource_type: 'image',
    };

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            options,
            (error, uploadResult) => {
                if (error || !uploadResult) {
                    reject(error || new Error('Cloudinary upload failed'));
                    return;
                }

                resolve(uploadResult);
            }
        );

        stream.end(buffer);
    });

    return {
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
    };
};

export const deleteImage = async (publicId: string): Promise<void> => {
    if (!publicId.trim()) {
        throw new ApiError(400, 'Cloudinary public ID is required');
    }

    configureCloudinary();
    const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
    });

    if (result.result !== 'ok' && result.result !== 'not found') {
        throw new Error(`Cloudinary deletion failed: ${result.result}`);
    }
};
