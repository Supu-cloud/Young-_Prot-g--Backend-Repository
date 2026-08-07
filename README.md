# Food Ordering Backend

TypeScript, Express, MongoDB, and Mongoose backend for the IEEE Young Protégé 2026 Food Ordering Project.

## Requirements

- Node.js
- npm
- MongoDB

## Setup

1. Install the dependencies:

    ```bash
    npm install
    ```

2. Copy `.env.example` to `.env` and provide the required local values.

3. Start the development server:

    ```bash
    npm run dev
    ```

The server uses port `5000` by default. Check its status at:

```text
GET http://localhost:5000/health
```

## Environment variables

The main variables are:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/food-ordering-db
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

Generate different random values of at least 32 characters for both JWT secrets. Never commit the real `.env` file.

## Available commands

```bash
npm run dev          # Start the development server
npm run build        # Compile TypeScript into dist/
npm start            # Start the compiled server
npm run seed         # Seed development data
npm run db:check     # Check the MongoDB connection
npm run typecheck    # Check TypeScript without generating files
npm run lint         # Run ESLint
npm run format       # Format the project with Prettier
npm run format:check # Check formatting
npm run verify       # Run ESLint and TypeScript checks
```

## API route groups

All application routes use the `/api` prefix:

- `/api/auth`
- `/api/users`
- `/api/restaurants`
- `/api/menu`
- `/api/orders`
- `/api/reviews`

## Project structure

```text
src/
├── config/       Database and environment configuration
├── controllers/ Request handlers
├── middleware/  Authentication, validation, uploads, and errors
├── models/       Mongoose database models
├── routes/       Express API routes
├── seed/         Development seed data
├── services/     Reusable business services, including JWT tokens
├── types/        Shared TypeScript types
├── utils/        Common helpers
└── server.ts     Application entry point

scripts/          Repository helper scripts
tests/            Test placeholders
test-db.ts        MongoDB connection check
```

## Git checks

Husky runs these checks automatically:

- `pre-commit`: ESLint and Prettier on staged files
- `commit-msg`: Conventional Commit message validation
- `pre-push`: ESLint and TypeScript verification

Example commit message:

```text
feat(auth): add login endpoint
```
