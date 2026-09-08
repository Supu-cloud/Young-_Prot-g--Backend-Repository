import {
    RESTAURANT_CATEGORIES,
    RESTAURANT_DAYS,
    RESTAURANT_LIMITS,
    RESTAURANT_PHONE_PATTERN,
} from '../config/restaurant';
import { ApiError } from '../utils/ApiError';

export type OperatingHours = Record<
    string,
    { open: string; close: string; closed: boolean }
>;
const record = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);

export function validateOperatingHours(value: unknown): OperatingHours {
    const errors: Record<string, string> = {};
    const result: OperatingHours = {};
    if (!record(value))
        throw new ApiError(400, 'Check your operating hours.', {
            operatingHours: 'Choose hours for each configured day.',
        });
    for (const [day, hours] of Object.entries(value)) {
        const key = `operatingHours.${day}`;
        if (
            !(RESTAURANT_DAYS as readonly string[]).includes(day) ||
            !record(hours)
        ) {
            errors[key] = 'Choose a valid day and opening hours.';
            continue;
        }
        const { open, close, closed } = hours;
        if (typeof closed !== 'boolean')
            errors[key] = 'Choose whether this day is closed.';
        const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
        if (
            closed !== true &&
            (typeof open !== 'string' ||
                typeof close !== 'string' ||
                !time.test(open) ||
                !time.test(close) ||
                open === close)
        ) {
            errors[key] =
                'Enter different opening and closing times in HH:MM format.';
        }
        result[day] = {
            open: closed === true ? '' : String(open),
            close: closed === true ? '' : String(close),
            closed: closed === true,
        };
    }
    if (Object.keys(errors).length)
        throw new ApiError(400, 'Check your operating hours.', errors);
    return result;
}

export function validateRestaurantInput(body: unknown, partial = false) {
    if (!record(body))
        throw new ApiError(400, 'Restaurant details are required.');
    const values: Record<string, unknown> = {};
    const errors: Record<string, string> = {};
    for (const field of [
        'name',
        'description',
        'address',
        'phone',
        'category',
    ] as const) {
        if (partial && body[field] === undefined) continue;
        const value = typeof body[field] === 'string' ? body[field].trim() : '';
        values[field] = value;
        if (!value)
            errors[field] =
                `Please enter ${field === 'category' ? 'a category' : `your restaurant ${field}`}.`;
    }
    for (const [field, limit] of Object.entries(RESTAURANT_LIMITS)) {
        if (typeof values[field] === 'string' && values[field].length > limit)
            errors[field] = `Use ${limit} characters or fewer.`;
    }
    if (
        values.category &&
        !(RESTAURANT_CATEGORIES as readonly unknown[]).includes(values.category)
    )
        errors.category = 'Choose a category from the list.';
    if (typeof values.phone === 'string') {
        values.phone = values.phone.replace(/[\s()-]/g, '');
        if (!new RegExp(RESTAURANT_PHONE_PATTERN).test(String(values.phone)))
            errors.phone =
                'Use a Sri Lankan phone number, such as 0771234567 or +94771234567.';
    }
    if (body.isOpen !== undefined) {
        if (typeof body.isOpen !== 'boolean')
            errors.isOpen = 'Choose Open or Closed.';
        else values.isOpen = body.isOpen;
    }
    if (body.imageUrl !== undefined) {
        if (typeof body.imageUrl !== 'string')
            errors.imageUrl = 'Please upload a JPG, PNG or WebP logo.';
        else values.imageUrl = body.imageUrl.trim();
    }
    if (body.operatingHours !== undefined) {
        try {
            values.operatingHours = validateOperatingHours(body.operatingHours);
        } catch (error) {
            if (!(error instanceof ApiError)) throw error;
            Object.assign(errors, error.errors);
        }
    }
    if (Object.keys(errors).length)
        throw new ApiError(400, 'Please check the highlighted fields.', errors);
    return values;
}
