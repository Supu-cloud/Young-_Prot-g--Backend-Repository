# Food Ordering System - Backend API

Backend REST API for the IEEE Young Protege 2026 Food Ordering Project, developed by Software Development Group 04.

The application provides authentication, user management, restaurant and menu management, order processing, and restaurant reviews. It is built with TypeScript, Express, MongoDB, and Mongoose.

## Table of contents

- [Project overview](#project-overview)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Main features](#main-features)
- [Project structure](#project-structure)
- [Installation](#installation)
- [Environment configuration](#environment-configuration)
- [Running the project](#running-the-project)
- [API endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Data models](#data-models)
- [Service integrations](#service-integrations)
- [Code-quality tools](#code-quality-tools)
- [Testing and verification](#testing-and-verification)
- [Frontend integration](#frontend-integration)
- [Security notes](#security-notes)
- [Current limitations](#current-limitations)

## Project overview

This backend supports four user roles:

- `customer`: manage a cart, browse restaurants and menus, place and pay for orders, and add reviews.
- `restaurant_owner`: manage an approved restaurant, its menu, incoming orders, riders, and sales analytics.
- `delivery_rider`: manage availability, accept assigned deliveries, update delivery progress, and view earnings.
- `admin`: approve role applications and manage users and platform operations.

The API returns JSON responses and is intended to be consumed by a separate frontend application such as a React and TypeScript website.

## Architecture

The project follows a layered REST API architecture based on MVC concepts:

```text
Client / Frontend
       |
       | HTTP request
       v
Express Routes
       |
       v
Middleware (authentication, validation, uploads, errors)
       |
       v
Controllers (request and response handling)
       |
       v
Services (business logic and external integrations)
       |
       v
Mongoose Models
       |
       v
MongoDB
```

This is not currently an event-driven or microservice architecture. It is a single Express application with separated layers for maintainability.

### Layer responsibilities

| Layer       | Responsibility                                                         |
| ----------- | ---------------------------------------------------------------------- |
| Routes      | Map HTTP methods and URLs to controllers and middleware                |
| Controllers | Read requests, call business logic, and return responses               |
| Services    | Authentication logic, JWT handling, email, uploads, and payments       |
| Models      | Define MongoDB collections and validation rules with Mongoose          |
| Middleware  | Authenticate users, authorize roles, validate files, and handle errors |
| Types       | Provide shared TypeScript interfaces and enums                         |
| Utilities   | Provide reusable response, error, logging, and async helpers           |

## Technology stack

### Backend

- Node.js
- TypeScript
- Express 4
- MongoDB
- Mongoose

### Authentication and security

- JSON Web Tokens (`jsonwebtoken`)
- Access and refresh tokens
- Password hashing with `bcryptjs`
- Role-based authorization

### Optional integrations

- Nodemailer for SMTP email
- Cloudinary for image storage
- Stripe for payment processing
- Multer for validating uploaded image files

### Development tools

- ESLint
- Prettier
- Husky
- lint-staged
- Nodemon
- ts-node and tsx

## Main features

- Customer registration and login
- Restaurant-owner and delivery-rider applications with administrator approval
- Password hashing before database storage
- JWT access and refresh token generation
- Protected routes using Bearer authentication
- Customer and administrator authorization
- User profile management
- Restaurant CRUD operations
- Menu-item CRUD operations
- Menu-item availability management
- Order placement and order-history retrieval
- Administrative order-status management
- Order cancellation
- Restaurant review creation and deletion
- Persistent customer carts with server-calculated totals
- Stripe test-mode Payment Intent creation from trusted order totals
- Restaurant-owner sales summaries and order history
- Delivery assignment, progress tracking, rider availability, and earnings summaries
- Development database seeding
- MongoDB connection checking
- SMTP, Cloudinary, and Stripe service foundations

## Project structure

```text
.
|-- .husky/                    Git hook scripts
|-- postman/                   Postman API collection
|-- scripts/                   Repository helper scripts
|   `-- validate-commit-msg.mjs
|-- src/
|   |-- config/                Database and environment configuration
|   |-- controllers/           Express request handlers
|   |-- middleware/            Auth, errors, uploads, and validation
|   |-- models/                Mongoose models
|   |-- routes/                API route definitions
|   |-- seed/                  Development seed data
|   |-- services/              Business logic and external integrations
|   |-- types/                 Shared TypeScript types and enums
|   |-- utils/                 API response, error, logger, and async helpers
|   `-- server.ts              Application entry point
|-- tests/                     Test placeholders
|-- .env.example               Environment-variable template
|-- eslint.config.mjs          ESLint configuration
|-- test-db.ts                 MongoDB connection check
|-- tsconfig.json              TypeScript configuration
|-- package.json               Dependencies and npm scripts
`-- README.md                  Project documentation
```

## Installation

### Requirements

Install the following software first:

- Node.js
- npm
- MongoDB Community Server or a MongoDB Atlas database
- Git

### Clone and install

```bash
git clone <repository-url>
cd IEEE-Young-protege--Food-Ordering-Project-Backend-Repository
npm install
```

Create the local environment file by copying `.env.example` to `.env`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

Bash:

```bash
cp .env.example .env
```

Never commit the real `.env` file.

## Environment configuration

### Required variables

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/food-ordering-db

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=food-ordering-api
JWT_AUDIENCE=food-ordering-client
```

Generate separate random JWT secrets of at least 32 characters:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run the command twice and use a different result for each secret. Do not publish the generated values.

### Optional email variables

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=
```

### Optional Cloudinary variables

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Optional Stripe variables

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

The optional credentials can remain empty until their services are connected to API endpoints.

## Running the project

### Development mode

```bash
npm run dev
```

The default URL is:

```text
http://localhost:5000
```

Health check:

```http
GET http://localhost:5000/health
```

Example response:

```json
{
    "status": "OK",
    "message": "Food Ordering API is running"
}
```

### Check the MongoDB connection

```bash
npm run db:check
```

### Seed development data

```bash
npm run seed
```

Run the seed command only against a development database after reviewing the seed data.

### Production build

```bash
npm run build
npm start
```

TypeScript source files are compiled from `src/` into `dist/`.

### Available scripts

| Command                | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Start the TypeScript development server with Nodemon |
| `npm run build`        | Clean and compile the production JavaScript output   |
| `npm start`            | Start the compiled application from `dist/server.js` |
| `npm run seed`         | Insert development seed data                         |
| `npm run db:check`     | Connect to MongoDB, ping it, and disconnect          |
| `npm run typecheck`    | Check TypeScript without producing build files       |
| `npm run lint`         | Check TypeScript source with ESLint                  |
| `npm run lint:fix`     | Automatically fix supported ESLint issues            |
| `npm run format`       | Format supported files with Prettier                 |
| `npm run format:check` | Check formatting without modifying files             |
| `npm run verify`       | Run ESLint and TypeScript checks                     |

## API endpoints

All application routes use the `/api` prefix.

Legend:

- Public: no token required
- Customer: valid access token required
- Owner/Rider/Admin: valid access token with the stated role required

### Authentication

| Method | Endpoint                            | Access        | Purpose                                      |
| ------ | ----------------------------------- | ------------- | -------------------------------------------- |
| POST   | `/api/auth/signup`                  | Public        | Register a customer account                  |
| POST   | `/api/auth/signup/restaurant-owner` | Public        | Submit a restaurant-owner application        |
| POST   | `/api/auth/signup/delivery-rider`   | Public        | Submit a delivery-rider application          |
| POST   | `/api/auth/login`                   | Public        | Log in and receive access and refresh tokens |
| GET    | `/api/auth/me`                      | Authenticated | Get the authenticated user                   |

Signup request example:

```json
{
    "name": "Example Customer",
    "email": "customer@example.com",
    "password": "password123",
    "phone": "0771234567",
    "address": "Colombo"
}
```

Login request example:

```json
{
    "email": "customer@example.com",
    "password": "password123"
}
```

Login response structure:

```json
{
    "success": true,
    "message": "Login successful",
    "data": {
        "accessToken": "<jwt-access-token>",
        "refreshToken": "<jwt-refresh-token>",
        "user": {
            "_id": "<user-id>",
            "name": "Example Customer",
            "email": "customer@example.com",
            "role": "customer"
        }
    }
}
```

Public signup always creates a customer account. Administrator accounts must not be created by accepting an untrusted role from a public request.

### Users

| Method | Endpoint              | Access         | Purpose                     |
| ------ | --------------------- | -------------- | --------------------------- |
| GET    | `/api/users/profile`  | Customer/Admin | Get the current profile     |
| PUT    | `/api/users/profile`  | Customer/Admin | Update the current profile  |
| PATCH  | `/api/users/password` | Customer/Admin | Change the current password |
| GET    | `/api/users`          | Admin          | List users                  |
| DELETE | `/api/users/:id`      | Admin          | Delete a user               |

### Restaurants

| Method | Endpoint                      | Access      | Purpose                    |
| ------ | ----------------------------- | ----------- | -------------------------- |
| GET    | `/api/restaurants`            | Public      | List restaurants           |
| GET    | `/api/restaurants/:id`        | Public      | Get one restaurant         |
| POST   | `/api/restaurants`            | Owner/Admin | Create a restaurant        |
| PUT    | `/api/restaurants/:id`        | Owner/Admin | Update an owned restaurant |
| DELETE | `/api/restaurants/:id`        | Owner/Admin | Delete an owned restaurant |
| PATCH  | `/api/restaurants/:id/toggle` | Owner/Admin | Toggle restaurant status   |

### Menu items

| Method | Endpoint                             | Access      | Purpose                   |
| ------ | ------------------------------------ | ----------- | ------------------------- |
| GET    | `/api/menu/restaurant/:restaurantId` | Public      | Get a restaurant's menu   |
| GET    | `/api/menu/item/:id`                 | Public      | Get one menu item         |
| POST   | `/api/menu`                          | Owner/Admin | Create a menu item        |
| PUT    | `/api/menu/:id`                      | Owner/Admin | Update an owned menu item |
| DELETE | `/api/menu/:id`                      | Owner/Admin | Delete an owned menu item |
| PATCH  | `/api/menu/:id/toggle`               | Owner/Admin | Toggle item availability  |

### Orders

| Method | Endpoint                      | Access         | Purpose                             |
| ------ | ----------------------------- | -------------- | ----------------------------------- |
| POST   | `/api/orders`                 | Customer/Admin | Place an order                      |
| GET    | `/api/orders/my`              | Customer/Admin | Get the current user's orders       |
| GET    | `/api/orders/all`             | Admin          | List all orders                     |
| GET    | `/api/orders/:id`             | Customer/Admin | Get an authorized order             |
| PATCH  | `/api/orders/:id/status`      | Admin          | Update an order status              |
| PATCH  | `/api/orders/:id/cancel`      | Customer/Admin | Cancel an authorized order          |
| GET    | `/api/orders/analytics/sales` | Owner/Admin    | Get delivered-order sales analytics |

### Cart

| Method | Endpoint                      | Access   | Purpose                |
| ------ | ----------------------------- | -------- | ---------------------- |
| GET    | `/api/cart`                   | Customer | Get the cart and total |
| POST   | `/api/cart/items`             | Customer | Add an item            |
| PATCH  | `/api/cart/items/:menuItemId` | Customer | Change item quantity   |
| DELETE | `/api/cart/items/:menuItemId` | Customer | Remove an item         |
| DELETE | `/api/cart`                   | Customer | Clear the cart         |

### Role profiles and approvals

| Method | Endpoint                          | Access | Purpose                             |
| ------ | --------------------------------- | ------ | ----------------------------------- |
| PATCH  | `/api/roles/applications/:userId` | Admin  | Approve or reject an application    |
| PUT    | `/api/roles/owner/profile`        | Owner  | Save owner business profile         |
| PUT    | `/api/roles/rider/profile`        | Rider  | Save rider and verification details |
| PATCH  | `/api/roles/rider/availability`   | Rider  | Set online/offline status           |

### Deliveries

| Method | Endpoint                                 | Access      | Purpose                       |
| ------ | ---------------------------------------- | ----------- | ----------------------------- |
| GET    | `/api/deliveries/available-riders`       | Owner/Admin | List available riders         |
| POST   | `/api/deliveries/orders/:orderId/assign` | Owner/Admin | Assign an order to a rider    |
| GET    | `/api/deliveries/my`                     | Rider       | Get assigned trips            |
| GET    | `/api/deliveries/my/earnings`            | Rider       | Get trip and earnings summary |
| PATCH  | `/api/deliveries/:id/status`             | Rider       | Accept/reject/update a trip   |

### Payments

| Method | Endpoint                               | Access   | Purpose                        |
| ------ | -------------------------------------- | -------- | ------------------------------ |
| POST   | `/api/payments/orders/:orderId/intent` | Customer | Create a Stripe Payment Intent |

### Reviews

| Method | Endpoint                     | Access         | Purpose                       |
| ------ | ---------------------------- | -------------- | ----------------------------- |
| GET    | `/api/reviews/:restaurantId` | Public         | List reviews for a restaurant |
| POST   | `/api/reviews`               | Customer/Admin | Add a review                  |
| DELETE | `/api/reviews/:id`           | Customer/Admin | Delete an authorized review   |

## Authentication

### Password handling

Passwords are hashed with bcrypt before they are stored. Plain-text passwords must never be stored or returned by the API.

### JWT flow

```text
User submits email and password
             |
             v
Backend verifies the password
             |
             v
Backend creates an access token and refresh token
             |
             v
Client sends the access token with protected requests
```

Access tokens expire after 15 minutes by default. Refresh tokens expire after 7 days by default.

Protected request header:

```http
Authorization: Bearer <access-token>
```

The backend validates the signature, expiration, issuer, audience, token type, user ID, and user role.

### Authorization

Authentication answers, "Who is the user?"

Authorization answers, "Is this user allowed to perform this action?"

The backend always performs authorization checks. Hiding an admin button in the frontend is not a security control.

## Data models

### User

- Name
- Email
- Hashed password
- Role (`customer`, `restaurant_owner`, `delivery_rider`, or `admin`)
- Account approval status
- Optional phone number and address

### Restaurant

- Restaurant details and category
- Address and contact details
- Image URL
- Active/inactive status
- Owner reference
- Optional operating hours

### Menu item

- Name, description, category, and price
- Restaurant reference
- Image URL
- Availability status

### Order

- Customer and restaurant references
- Selected items, quantities, and prices
- Trusted total amount calculated by the backend
- Delivery address and optional note
- Order status
- Payment status

Order statuses:

```text
placed -> confirmed -> preparing -> out_for_delivery -> delivered
```

An order can also become `cancelled`.

Payment statuses are `pending`, `paid`, and `failed`.

### Cart

- One cart per customer
- Items from one restaurant per cart
- Menu-item references and quantities
- Total calculated from current menu prices by the backend

### Delivery profiles and assignments

- Rider vehicle, licence, availability, and verification-document URLs
- Assignment status and lifecycle timestamps
- Delivery payout for completed-trip earnings summaries

### Review

- Customer reference
- Restaurant reference
- Rating and comment

## Service integrations

### Authentication service

`auth.service.ts` contains registration and login business logic. It validates input, normalizes email addresses, checks duplicates, hashes passwords, and requests tokens from `token.service.ts`.

### Token service

`token.service.ts` creates and verifies separate access and refresh tokens. It uses different secrets, restricts verification to HS256, and checks issuer, audience, role, and token type.

### Email service

`email.service.ts` supports SMTP connection verification, general email sending, and order-confirmation messages.

SMTP credentials are optional during core development. The email service is implemented but is not yet connected to an order or account-verification endpoint.

### Upload service

`upload.middleware.ts` accepts JPG, PNG, and WebP files up to 5 MB in memory. `upload.service.ts` can upload those buffers to Cloudinary and delete Cloudinary images.

The Cloudinary service is implemented but is not yet connected to the restaurant or menu routes.

### Payment service

`payment.service.ts` can create Stripe Payment Intents, request refunds, and verify Stripe webhook signatures.

`POST /api/payments/orders/:orderId/intent` creates a Payment Intent using the authenticated customer's order and a total calculated by the backend. A verified raw-body Stripe webhook is still required before production use so successful or failed payments can update the order payment status safely.

Stripe account availability depends on the business country. The team must confirm that the chosen payment provider supports its legal business location before production deployment.

## Code-quality tools

### ESLint

ESLint checks TypeScript code and includes rules that prohibit unsafe constructs such as `eval`, `new Function`, and non-strict equality.

### Prettier

Prettier provides consistent formatting across TypeScript, JSON, Markdown, and configuration files.

### Git hooks

Husky runs automated checks during the Git workflow:

| Hook         | Check                                                       |
| ------------ | ----------------------------------------------------------- |
| `pre-commit` | Run ESLint and Prettier on staged files through lint-staged |
| `commit-msg` | Require a Conventional Commit message                       |
| `pre-push`   | Run ESLint and TypeScript verification                      |

Valid commit-message examples:

```text
feat(auth): add login endpoint
fix(orders): prevent invalid order totals
docs: update API documentation
```

## Testing and verification

Run the available automated quality checks:

```bash
npm run typecheck
npm run build
npm run lint
npm run format:check
npm run db:check
```

The `tests/` files are currently placeholders, and no automated test runner is configured in `package.json`. Unit and integration testing is therefore an identified next step rather than a completed feature.

Recommended future test coverage:

- Authentication success and failure cases
- Token expiration and tampering
- Role-based authorization
- Restaurant and menu CRUD operations
- Order ownership and total calculation
- Review ownership
- File type and size validation
- Payment webhook signature validation

The Postman collection under `postman/` can be used for manual API testing.

## Frontend integration

The recommended frontend is a separate React and TypeScript repository.

Local development layout:

```text
Food-Ordering-Project/
|-- backend/     Express API on http://localhost:5000
`-- frontend/    React application on http://localhost:5173
```

Frontend environment variable:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Example frontend request:

```ts
const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/restaurants`
);
```

Never place backend secrets in a frontend environment file. Variables beginning with `VITE_` are included in browser-delivered code and must be treated as public.

The frontend must know the API contract—URLs, methods, request bodies, response structures, authentication headers, and error messages—but it does not need to be stored in the backend repository.

## Security notes

- Never commit `.env`.
- Never expose JWT, SMTP, Cloudinary, database, or Stripe secrets.
- Use separate access-token and refresh-token secrets.
- Use short-lived access tokens.
- Use test payment credentials during development.
- Calculate payment totals from trusted database data, not frontend input.
- Verify Stripe webhook signatures before updating payment status.
- Validate uploaded file type and size.
- Do not allow public signup to select an administrator role.
- Keep authorization checks in the backend even when the frontend hides restricted actions.
- Rotate any secret that is accidentally exposed.

## Current limitations

- Refresh-token rotation, persistence, revocation, and logout are not implemented.
- Email-account verification and password-reset flows are not implemented.
- Email and Cloudinary services are not yet exposed through API endpoints.
- Stripe Payment Intent creation is implemented, but raw-body webhook handling and automatic payment-status updates are not.
- Real-time WebSocket/SSE notifications are not implemented; clients must currently poll order and delivery endpoints.
- Menu categories are stored on menu items; separate category CRUD and ordering are not implemented.
- Rider verification document URLs can be stored, but multipart document upload is not connected to the rider-profile route.
- Automated unit and integration tests are not configured.
- API schemas are not yet published through Swagger/OpenAPI.
- CORS currently requires additional restriction to the deployed frontend origin before production use.

These limitations are documented so they are not mistaken for completed functionality and can be planned as future development tasks.

## Team workflow

Before opening a pull request:

```bash
npm install
npm run verify
npm run build
npm run format:check
git status
```

Use feature branches and Conventional Commit messages. Do not commit generated `dist/`, local `.env`, IDE settings, or `node_modules/`.
