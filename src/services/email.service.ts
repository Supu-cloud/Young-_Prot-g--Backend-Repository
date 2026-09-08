import nodemailer, { type Transporter } from 'nodemailer';

import { ApiError } from '../utils/ApiError';

export interface SendEmailInput {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

let transporter: Transporter | undefined;

const requireEmailEnv = (name: string): string => {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new ApiError(500, `${name} is not configured`);
    }

    return value;
};

const getTransporter = (): Transporter => {
    if (transporter) {
        return transporter;
    }

    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: requireEmailEnv('EMAIL_USER'),
            pass: requireEmailEnv('EMAIL_PASS'),
        },
    });

    return transporter;
};

export const verifyEmailConnection = async (): Promise<void> => {
    await getTransporter().verify();
};

export const sendEmail = async (input: SendEmailInput): Promise<string> => {
    if (!/^\S+@\S+\.\S+$/.test(input.to)) {
        throw new ApiError(400, 'A valid recipient email is required');
    }

    if (!input.subject.trim() || !input.text.trim()) {
        throw new ApiError(400, 'Email subject and text are required');
    }

    const result = await getTransporter().sendMail({
        from: `Foodie <${requireEmailEnv('EMAIL_USER')}>`,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
    });

    return String(result.messageId);
};

export const sendOrderConfirmation = async (
    email: string,
    orderId: string
): Promise<string> =>
    sendEmail({
        to: email,
        subject: 'Order confirmation',
        text: `Your order ${orderId} has been received.`,
    });

export const sendApplicationApprovalEmail = async (
    email: string,
    name: string,
    role: string
): Promise<string> =>
    sendEmail({
        to: email,
        subject: 'Your Foodie registration has been approved',
        text: [
            `Hello ${name},`,
            '',
            `Your Foodie ${role} registration has been approved by the administrator.`,
            'You can now sign in to your Foodie account.',
            '',
            'Thank you,',
            'The Foodie Team',
        ].join('\n'),
    });
