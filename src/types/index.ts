import type { UserRole } from './enums';

export interface AuthenticatedUser {
    id: string;
    userId: string;
    role: UserRole;
}

export interface TokenUser {
    userId: string;
    role: UserRole;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}
