import { sendEmail as sendServiceEmail } from '../services/email.service';

// Backward-compatible adapter for older callers. The Gmail transport remains
// centralized in services/email.service.ts.
export const sendEmail = async (options: {
    email: string;
    subject: string;
    message: string;
}) =>
    sendServiceEmail({
        to: options.email,
        subject: options.subject,
        text: options.message.replace(/<[^>]+>/g, ' '),
        html: options.message,
    });
