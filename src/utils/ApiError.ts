export class ApiError extends Error {
    statusCode: number;

    constructor(
        statusCode: number,
        message: string,
        public errors?: Record<string, string>
    ) {
        super(message);
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }
}
