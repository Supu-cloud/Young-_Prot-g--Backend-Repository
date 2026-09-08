# Foodie order lifecycle implementation report

Status: implementation and automated checks passed. **The live end-to-end demonstration is pending an existing restaurant-to-approved-owner assignment.** No order or payment was created by the attempted live demo.

## 1. Existing architecture

The backend already had MongoDB `Order`, `DeliveryAssignment`, `DeliveryRiderProfile`, and restaurant ownership; JWT authentication re-reads the user’s current role, approval and email-verification state. The website already had centralized `orderApi`, `paymentApi`, `ownerApi`, `riderApi`, real menu/cart APIs, and connected role pages.

The old flow created an unpaid order before payment, required a separate accepted/confirmed owner step, mapped rider pickup directly to out-for-delivery, and accepted an assignment payout from the caller. Owner totals included delivery fees. Tracking showed four steps and could highlight a status that had not happened. The pre-existing test files were empty.

## 2. Lifecycle

`placed → confirmed → preparing → ready_for_pickup → rider_assigned → picked_up → out_for_delivery → delivered`

Owner acceptance now advances directly to confirmed. Legacy accepted/declined remain supported. A legacy picked-up assignment whose order already says out-for-delivery can reconcile without regressing its order or inventing timestamps. Cancellation is allowed only from placed. Terminal orders cannot restart processing.

## 3. Backend endpoints

All paths below are relative to `/api`.

| Endpoint                                                                         | Behavior                                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| POST `/payments/checkout`                                                        | New: persist/recover a server-priced checkout attempt using a stable key; reuse its Stripe test intent |
| POST `/payments/checkout/:id/complete`                                           | New: verify Stripe success and atomically create/recover the one paid order                            |
| POST `/orders/:id/delivery-review`                                               | New: one customer-owned delivery review after delivery                                                 |
| GET `/orders/my`, `/orders/:id`                                                  | Existing customer list and authorized shared order detail                                              |
| PATCH `/orders/:id/status`                                                       | Existing owner/admin processing endpoint; centralized transition validation                            |
| PATCH `/orders/:id/cancel`                                                       | Existing customer cancellation, restricted to placed                                                   |
| GET `/owner/dashboard`, `/owner/orders`, `/owner/orders/:id`, `/owner/analytics` | Existing owner-scoped views and earnings                                                               |
| GET `/deliveries/available-riders`                                               | Existing approved, verified, available rider selection                                                 |
| POST `/deliveries/orders/:orderId/assign`                                        | Existing owner/admin assignment, now transactional and server-priced                                   |
| GET `/deliveries/my`, `/deliveries/my/earnings`                                  | Existing assigned deliveries and order-based internal earnings                                         |
| PATCH `/deliveries/:id/status`                                                   | Existing assigned-rider endpoint; separate pickup, start delivery and delivered actions                |
| PATCH `/roles/rider/availability`                                                | Existing availability; prevents going available with an active order                                   |

Legacy order creation and order-specific payment endpoints remain. The React showcase checkout uses the new Stripe test flow.

## 4. Model changes

`Order` keeps existing customer, restaurant, items, totalAmount, deliveryFee, paymentIntentId and deliveryRider fields. Added subtotal, paymentMethod, lifecycle dates, cancelledAt, embedded settlement and embedded deliveryReview. `DeliveryAssignment` gains out_for_delivery and its timestamp.

`CheckoutAttempt` holds an immutable server-priced payment snapshot and Stripe reference before an order exists. It is not a dashboard order. Its deterministic ID becomes the eventual Order ID, using MongoDB’s existing unique `_id` constraint to prevent duplicate orders. No duplicate order collection or dashboard-specific order copy was added.

## 5. Payment behavior

Menu IDs, restaurant membership, availability, quantities, approved ownership, prices and totals are checked server-side. The authenticated customer ID is used; client prices and customer IDs are ignored. Delivery is the existing LKR 350 fee.

The backend requires Stripe test credentials and verifies intent status, test mode, currency, received amount, checkout ID and customer metadata. The frontend also requires a configured test publishable key; a hardcoded key fallback was removed without modifying `.env`.

The checkout key is stored per customer before sending the first request. Reloads reuse the same attempt/intent. Payment-success/order-save-failure keeps the cart and offers recovery of the same checkout. Concurrent completion returns the same order, including a duplicate-key race recovery path. Cart clearing happens only after paid order persistence; a cleanup failure navigates to the saved order with an explanatory message and retains the checkout recovery key.

Stripe intent creation uses an idempotency key. An attempt older than 23 hours with no saved intent ID requires support rather than risking another charge after Stripe’s key retention window. This follows Stripe’s [PaymentIntent guidance](https://docs.stripe.com/payments/payment-intents) and [idempotency behavior](https://docs.stripe.com/api/idempotent_requests).

## 6–10. Owner, assignment, rider, tracking and settlement

Owners see real incoming orders, payment status, creation time, customer, items and the same order reference. Actions follow the allowed transitions. Ready orders offer an approved available rider selector.

Assignment verifies the owning restaurant or admin role, rider role/approval/verification/profile/availability, no active rider order and ready/unassigned order status. A transaction updates the order, assignment and rider availability together. Payout input from the caller is ignored; the delivery fee is used.

Riders see their own assignments referencing the same populated Order. Pickup, start delivery and delivered each persist separately. Order assignment is checked again on every action. Assignment IDs still identify API resources; visible references use the Order ID.

Customer tracking displays all eight stages using saved lifecycle dates, plus items, payment, address and rider. Legacy missing dates are not fabricated. Cancelled/declined orders show their terminal state. The full MongoDB order ID is available in tracking.

Settlement remains pending until a paid delivery completes. That transaction makes restaurant subtotal and rider delivery fee available. Dashboards aggregate those Order settlement fields. Repeated delivered requests return the existing result without changing deliveredAt or crediting anything again. **These are internal test earnings, not Stripe Connect or bank payouts.**

## 11–13. Reviews, refresh and security

A delivered order’s customer can submit integer 1–5 rider and service ratings with an optional comment. The rider must exist. An atomic absent-review condition prevents duplicates. Restaurant food reviews remain separate.

Customer orders/tracking, owner orders/details/analytics and rider deliveries/dashboard/earnings refetch every seven seconds. Owner dashboard retains its restaurant-event refresh and polls every seven seconds while visible. Cleanup stops timers and stale responses after unmount. Shared order polling avoids overlapping requests and shows last-known data with a refresh error during network failures. Actions refetch immediately.

Authorization uses current authenticated IDs and roles, never emails. Customers cannot change processing/delivery status. Owners cannot access another owner’s order or deliver it. Riders cannot prepare an order or update another rider’s assignment. Admin processing also follows valid transitions; assignment uses the controlled assignment endpoint.

## 14. Live demo result

Read-only checks confirmed MongoDB connectivity, transaction support, Stripe connectivity and Stripe test mode. There are two approved verified customer accounts, two approved verified owner accounts, one approved verified rider, and one admin. The rider is offline. Eight restaurants are open, but **none is linked to either approved owner**.

The explicit real-demo script stopped at this prerequisite before creating a checkout, Stripe payment, order or assignment. No rider availability or restaurant ownership was changed. The user has been asked which existing restaurant and approved owner to link (or to assign them through the existing Admin page).

The full three-browser login/cart/card-entry demonstration has **not** been performed. Automated controller tests are not represented as a live MongoDB/Stripe demonstration.

Once the relationship is configured, an existing real available menu item is required. Run:

```powershell
npm.cmd run check:order-demo
npm.cmd run demo:orders -- --create-test-order
```

The opt-in demo creates one real Stripe TEST payment and one MongoDB order, deliberately tests a save failure, recovers concurrently, processes it with existing approved identities, assigns an idle rider, verifies status/earnings/review invariants and restores initial rider availability after completion. It never seeds, deletes orders, resets data or clears existing customer carts. Authentication tokens remain in memory; this script exercises APIs, not password login or browser card entry.

For the presentation: log into customer, owner and rider in three separate browser profiles. Make the restaurant open and rider available. Purchase a real menu item with a [Stripe test card](https://docs.stripe.com/testing). Trace the same order ID through owner acceptance/preparation/readiness, rider selection, pickup/start delivery/completion, customer tracking and ratings. Observe the internal earnings on the owner and rider dashboards.

## 15. Files changed

Backend: `package.json`; controllers `checkout`, `delivery`, `order`, `owner`, `payment`, `role`; models `CheckoutAttempt`, `DeliveryAssignment`, `Order`; routes `order`, `payment`; services `order-lifecycle`, `order-quote`, `payment`; tests `order-lifecycle.test.ts`, `order-live-demo.ts`, `order-readiness.ts`; this document.

Website: `CheckoutConnectedPage`, `CustomerOrderDetailConnectedPage`, `CustomerOrdersConnectedPage`, `CartContext`; owner `OwnerAnalyticsPage`, `OwnerDashboard`, `OwnerOrderDetailPage`, `OwnerOrdersV2Page`; rider `RiderConnectedPages`, `RiderPortalProfilePage`, `RiderPremiumDashboard`; API `restaurantRefresh`, `services`, `useAsyncResource`; API types; environment source configuration; new `RiderAssignment` component.

## 16. Verification

Passed: backend lint, backend typecheck, eight automated controller/service tests; targeted React ESLint with zero warnings; React TypeScript and Vite production build; scoped Git whitespace checks.

Tests cover the full one-order lifecycle and timestamps, pending/available settlement, duplicate delivery completion, payment-save failure recovery, repeated order completion, live/wrong-amount/wrong-customer payments, wrong owner/customer access, wrong rider updates, unavailable assignment, invalid transitions, cancellation, fake menu IDs, quantities, legacy statuses and one review per delivery. Persistence and Stripe are mocked in this suite; real MongoDB transaction concurrency remains part of the pending integration demo.

No unrelated build/lint failures remain in the checks run. The live demo was blocked by data prerequisites, not reported as passed.

## 17. Limitations

- Existing restaurant-owner mapping must be supplied before the real demo can run.
- MongoDB replica-set/sharded transaction support is required; the configured server supports it.
- Cancelled/declined paid test orders record the payment and suppress earnings; test refunds require support. No automatic refund or bank payout was added.
- Browser-close payment completion relies on resuming the saved checkout; no new webhook infrastructure was introduced.
- Legacy orders are not backfilled with guessed timestamps or historical settlements. Legacy cash APIs remain, but the website showcase is Stripe TEST checkout.
- Unpaid legacy cash orders cannot complete the new paid-delivery/earnings step until payment is confirmed; cash collection recording was not added.
- GPS/map navigation was outside scope and remains unchanged.

## 18–19. Git and safety

Backend branch: `feature/setup-backend-structure`. Website branch: `develop`. Both retain their pre-existing uncommitted and untracked work. The mobile repository was not changed for this task.

Review artifacts are in the parent workspace: `tmp/order-lifecycle-task.diff` (changes against the pre-task snapshot, with the removed key redacted), `tmp/order-lifecycle-git-status.txt`, and `tmp/order-lifecycle-changed-files.json`.

No `.env` edits, seeds, database resets, order deletions, destructive Git operations, commits or pushes were performed.
