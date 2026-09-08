# Food Ordering System - Backend API

Backend REST API for the IEEE Young Protege 2026 Food Ordering Project, developed by Software Development Group 04.

The application provides authentication, user management, restaurant and menu management, order processing, and restaurant reviews. It is built with TypeScript, Express, MongoDB, and Mongoose.

Project creation date recorded in the original README: July 10, 2026.

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
- [Team workflow](#team-workflow)

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

### Integrations and uploads

- Nodemailer for Gmail email
- Cloudinary for image storage
- Stripe for test-mode payment processing
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
- Role-based authorization with current account approval and email-verification checks
- Google sign-in, email verification, verification resend, and refresh sessions
- User profile management
- Restaurant CRUD operations
- Menu-item CRUD operations
- Menu-item availability management
- Order placement and order-history retrieval
- Owner and administrator order-status management
- Order cancellation
- Restaurant review creation and deletion
- Persistent customer carts with server-calculated totals
- Stripe test-mode Payment Intent creation from trusted order totals
- Restaurant-owner sales summaries and order history
- Delivery assignment, progress tracking, rider availability, and earnings summaries
- Development database seeding
- MongoDB connection checking
- Gmail verification and approval emails, local restaurant-logo uploads, and Cloudinary utilities
- Idempotent Stripe test checkout and payment confirmation
- Administrator dashboards, reports, and restaurant-owner assignment

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
|   |-- scripts/               Administrator provisioning and menu import
|   |-- seed/                  Development seed data
|   |-- services/              Business logic and external integrations
|   |-- types/                 Shared TypeScript types and enums
|   |-- utils/                 API response, error, logger, and async helpers
|   `-- server.ts              Application entry point
|-- docs/                      Order lifecycle implementation notes
|-- public/                    Static images, logos, videos, and uploaded logos
|-- tests/                     Order lifecycle tests, readiness checks, and demo scripts
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
- MongoDB Atlas or a MongoDB deployment with replica-set/sharded transaction support for delivery assignment and settlement
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

GOOGLE_CLIENT_ID=
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

The startup validator requires `MONGO_URI`, both JWT secrets, and `GOOGLE_CLIENT_ID`. Add `GOOGLE_CLIENT_ID` to your local `.env`; it is currently missing from `.env.example`. `PORT` and JWT lifetime/issuer/audience settings have defaults.

### Email configuration

```env
EMAIL_USER=
EMAIL_PASS=
```

The Nodemailer service uses Gmail. Configure these credentials to send signup verification, resend-verification, and application-approval emails. Password login requires a verified email; owner and rider accounts also require administrator approval.

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

Cloudinary credentials are optional for the existing utility service; owner logo uploads use local storage. Stripe test credentials are required for payment endpoints. `STRIPE_WEBHOOK_SECRET` is reserved for the signature-verification utility; no webhook route is mounted.

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

**The seed script deletes all existing users, restaurants, menu items, orders, and reviews before inserting sample data.** Use only a disposable development database. Set `SEED_ADMIN_PASSWORD` before running it; the script checks this after deleting data.

To provision an administrator without seeding, set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`, then run `npm run create-admin`. Review `src/scripts/create-admin.ts` before use.

### Production build

```bash
npm run build
npm start
```

TypeScript source files are compiled from `src/` into `dist/`.

### Available scripts

| Command                | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `npm run dev`          | Start the TypeScript development server with Nodemon        |
| `npm run build`        | Clean and compile the production JavaScript output          |
| `npm start`            | Start the compiled application from `dist/server.js`        |
| `npm run seed`         | Reset selected collections and insert development seed data |
| `npm run db:check`     | Connect to MongoDB, ping it, and disconnect                 |
| `npm run typecheck`    | Check TypeScript without producing build files              |
| `npm run lint`         | Check TypeScript source with ESLint                         |
| `npm run lint:fix`     | Automatically fix supported ESLint issues                   |
| `npm run format`       | Format supported files with Prettier                        |
| `npm run format:check` | Check formatting without modifying files                    |
| `npm run verify`       | Run ESLint and TypeScript checks                            |

Additional scripts:

| Command                                      | Purpose                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run create-admin`                       | Provision an administrator from environment variables                          |
| `npm run import:sweet-ceylon`                | Import the Sweet Ceylon menu; review the script before modifying database data |
| `npm run test:orders`                        | Run order lifecycle tests with mocked persistence and Stripe                   |
| `npm run check:order-demo`                   | Check database, Stripe test mode, and demo data prerequisites                  |
| `npm run demo:orders -- --create-test-order` | Run the opt-in demo, creating a Stripe test payment and database order         |

## API endpoints

All application routes use the `/api` prefix.

Legend:

- Public: no token required
- Authenticated: valid access token and an approved, email-verified account
- Customer: authenticated user with the customer role
- Owner/Rider/Admin: valid access token with the stated role required

#`GET /api/reviews` and `GET /api/reviews/featured` expose public feedback lists. The same review router is also mounted at `/api/feedbacks`. Review deletion requires ownership.

## Authentication

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

Additional public authentication endpoints (refresh requires a refresh token in the request body):

| Method | Endpoint                               | Purpose                                              |
| ------ | -------------------------------------- | ---------------------------------------------------- |
| GET    | `/api/auth/verify-email?token=<token>` | Verify an email address                              |
| POST   | `/api/auth/resend-verification`        | Resend the verification email                        |
| POST   | `/api/auth/google`                     | Authenticate with a Google ID token                  |
| POST   | `/api/auth/refresh`                    | Validate a refresh token and return a new token pair |

Signup, login, Google authentication, refresh, and resend routes are rate limited.

### Users

| Method | Endpoint              | Access        | Purpose                     |
| ------ | --------------------- | ------------- | --------------------------- |
| GET    | `/api/users/profile`  | Authenticated | Get the current profile     |
| PUT    | `/api/users/profile`  | Authenticated | Update the current profile  |
| PATCH  | `/api/users/password` | Authenticated | Change the current password |
| GET    | `/api/users`          | Admin         | List users                  |
| DELETE | `/api/users/:id`      | Admin         | Delete a user               |

### Restaurants

| Method | Endpoint                      | Access      | Purpose                    |
| ------ | ----------------------------- | ----------- | -------------------------- |
| GET    | `/api/restaurants`            | Public      | List restaurants           |
| GET    | `/api/restaurants/:id`        | Public      | Get one restaurant         |
| POST   | `/api/restaurants`            | Owner       | Create a restaurant        |
| PUT    | `/api/restaurants/:id`        | Owner       | Update an owned restaurant |
| DELETE | `/api/restaurants/:id`        | Owner/Admin | Delete an owned restaurant |
| PATCH  | `/api/restaurants/:id/toggle` | Owner       | Toggle restaurant status   |

`GET /api/restaurants/options` provides public restaurant form options. Owner operations enforce restaurant ownership.

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

| Method | Endpoint                      | Access        | Purpose                             |
| ------ | ----------------------------- | ------------- | ----------------------------------- |
| POST   | `/api/orders`                 | Customer      | Place an order                      |
| GET    | `/api/orders/my`              | Customer      | Get the current user's orders       |
| GET    | `/api/orders/all`             | Owner/Admin   | List orders within role scope       |
| GET    | `/api/orders/:id`             | Authenticated | Get an authorized order             |
| PATCH  | `/api/orders/:id/status`      | Owner/Admin   | Update an order status              |
| PATCH  | `/api/orders/:id/cancel`      | Customer      | Cancel an authorized order          |
| GET    | `/api/orders/analytics/sales` | Owner/Admin   | Get delivered-order sales analytics |

Additional customer routes: `POST /api/orders/:id/delivery-review` submits a delivery review, and `PATCH /api/orders/:id/receipt` updates receipt confirmation. Order detail access is checked against the caller's role and relationship to the order.

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

`GET /api/roles/rider/profile` retrieves the authenticated rider profile.

### Deliveries

| Method | Endpoint                                 | Access      | Purpose                       |
| ------ | ---------------------------------------- | ----------- | ----------------------------- |
| GET    | `/api/deliveries/available-riders`       | Owner/Admin | List available riders         |
| POST   | `/api/deliveries/orders/:orderId/assign` | Owner/Admin | Assign an order to a rider    |
| GET    | `/api/deliveries/my`                     | Rider       | Get assigned trips            |
| GET    | `/api/deliveries/my/earnings`            | Rider       | Get trip and earnings summary |
| PATCH  | `/api/deliveries/:id/status`             | Rider       | Accept/reject/update a trip   |

### Payments

| Method | Endpoint                                | Access   | Purpose                                                    |
| ------ | --------------------------------------- | -------- | ---------------------------------------------------------- |
| POST   | `/api/payments/orders/:orderId/intent`  | Customer | Create a Stripe Payment Intent                             |
| POST   | `/api/payments/orders/:orderId/confirm` | Customer | Verify payment and mark an existing order paid             |
| POST   | `/api/payments/checkout`                | Customer | Create or recover a server-priced checkout attempt         |
| POST   | `/api/payments/checkout/:id/complete`   | Customer | Verify Stripe success and create or recover one paid order |

### Owner portal

All `/api/owner` routes require the restaurant-owner role.

| Method   | Endpoint                                     | Purpose                               |
| -------- | -------------------------------------------- | ------------------------------------- |
| GET      | `/api/owner/dashboard`                       | Owner dashboard                       |
| GET, PUT | `/api/owner/restaurant`                      | Retrieve or save the owned restaurant |
| POST     | `/api/owner/restaurant/logo`                 | Upload a logo as multipart image data |
| GET      | `/api/owner/menu`, `/api/owner/menu/:id`     | Owner menu views                      |
| GET      | `/api/owner/orders`, `/api/owner/orders/:id` | Owner order views                     |
| GET      | `/api/owner/analytics`                       | Owner sales and earnings              |

### Administration

All `/api/admin` routes require the administrator role.

| Method        | Endpoint                                                                    | Purpose                     |
| ------------- | --------------------------------------------------------------------------- | --------------------------- |
| GET           | `/api/admin/dashboard`, `/api/admin/analytics`                              | Platform summaries          |
| GET           | `/api/admin/applications`, `/api/admin/applications/:id`                    | Review applications         |
| PATCH         | `/api/admin/applications/:id/approve`, `/api/admin/applications/:id/reject` | Decide applications         |
| GET           | `/api/admin/users`, `/api/admin/users/:id`                                  | User views                  |
| DELETE        | `/api/admin/users/:id`                                                      | Delete a user               |
| PATCH         | `/api/admin/users/:id/status`                                               | Update account status       |
| GET           | `/api/admin/restaurants`, `/api/admin/restaurants/:id`                      | Restaurant views            |
| GET           | `/api/admin/restaurant-owners/assignable`                                   | List assignable owners      |
| PATCH, DELETE | `/api/admin/restaurants/:id/owner`                                          | Assign or unassign an owner |
| GET           | `/api/admin/orders`, `/api/admin/orders/:id`                                | Order views                 |
| GET           | `/api/admin/reports/:type`                                                  | Generate a report           |

### Reviews

| Method | Endpoint                     | Access        | Purpose                       |
| ------ | ---------------------------- | ------------- | ----------------------------- |
| GET    | `/api/reviews/:restaurantId` | Public        | List reviews for a restaurant |
| POST   | `/api/reviews`               | Authenticated | Add a review                  |
| DELETE | `/api/reviews/:id`           | Authenticated | Delete an authorized review   |

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

The backend validates the signature, expiration, issuer, audience, token type, and user ID, then reads the current role, approval status, and email-verification state from MongoDB. `POST /api/auth/refresh` accepts `{ "refreshToken": "<refresh-token>" }` and issues a new token pair after checking the account. Previously issued refresh tokens are not persisted or revoked.

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
placed -> confirmed -> preparing -> ready_for_pickup -> rider_assigned
       -> picked_up -> out_for_delivery -> delivered
```

Additional statuses include legacy `accepted`, `declined`, `delivery_failed`, and `cancelled`. Customer cancellation is allowed only from `placed`; transition rules are centralized in `src/services/order-lifecycle.ts`.

Orders also record lifecycle timestamps, customer receipt confirmation, delivery reviews, and internal settlement amounts. `CheckoutAttempt` stores a server-priced snapshot before a paid order is created. See [order lifecycle notes](docs/order-lifecycle.md) for checkout recovery, assignment, and settlement details; its live-demo observations describe the state at the time of that report.

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

`email.service.ts` centralizes Gmail transport, connection verification, general email, and order-confirmation helpers. Signup verification, verification resend, and application-approval notifications are connected to account flows.

### Upload service

`upload.middleware.ts` accepts JPG, PNG, and WebP files up to 5 MB in memory. `upload.service.ts` can upload those buffers to Cloudinary and delete Cloudinary images.

The Cloudinary utility is not connected to restaurant/menu routes. The owner logo endpoint instead validates image signatures and stores files in `public/restaurants/`, served under `/images/restaurants/`. Preserve that directory across deployments when using local uploads.

### Payment service

`payment.service.ts` can create Stripe Payment Intents, request refunds, and verify Stripe webhook signatures.

`POST /api/payments/checkout` creates or recovers a server-priced checkout and Stripe test intent. Completion verifies Stripe status, test mode, currency, amount, and metadata before creating or recovering the paid order. Existing order-specific intent and confirmation endpoints remain available.

Delivery assignment and settlement use MongoDB transactions. Earnings are internal accounting records; no bank payouts or Stripe Connect transfers are implemented. A mounted raw-body webhook endpoint and automatic refunds are still absent; interrupted payments rely on checkout recovery.

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

Run `npm run test:orders` for the Node.js test-runner suite covering order transitions, checkout recovery, payment validation, authorization, assignment, settlement, and delivery reviews. Persistence and Stripe are mocked; these checks do not prove live database transaction behavior. Older auth/menu/restaurant/order test files remain placeholders.

`npm run check:order-demo` checks live prerequisites. The opt-in `npm run demo:orders -- --create-test-order` creates a real database order and Stripe test payment; it requires suitable approved accounts, restaurant ownership, menu data, and transaction support. Review [the lifecycle report](docs/order-lifecycle.md) before running it.

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

- Refresh issues a new token pair, but server-side refresh-token persistence, reuse detection, revocation, and logout are not implemented.
- Password-reset flows are not implemented.
- Cloudinary utilities are not connected to API routes; logo uploads use local storage.
- Stripe test checkout and confirmation are implemented, but webhook reconciliation, automatic refunds, and external payouts are not.
- Real-time WebSocket/SSE notifications are not implemented; clients must currently poll order and delivery endpoints.
- Menu categories are stored on menu items; separate category CRUD and ordering are not implemented.
- Rider verification document URLs can be stored, but multipart document upload is not connected to the rider-profile route.
- Automated order tests use mocks; broader authentication/CRUD coverage and live integration verification remain necessary.
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
