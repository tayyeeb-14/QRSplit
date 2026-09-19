# SplitPay

SplitPay is an original academic prototype for UPI-inspired payment collection, merchant identity, and bill splitting. It demonstrates merchant workflows and payment state simulation without claiming to verify or process real financial transactions.

> This project is an educational prototype and does not process or verify real financial transactions unless connected to an authorized payment provider.

## Features

- Premium responsive merchant dashboard with mobile navigation.
- Stable human-readable merchant IDs and public merchant profile QR resolution.
- POS split preview with exact-cent arithmetic and configurable payment count.
- Simulated payment request states: `PENDING`, `PROCESSING`, `SUCCESS`, `FAILED`, and `EXPIRED`.
- Transaction ledger, educational cost simulator, merchant profile, and group split entry point.
- JWT authentication, bcrypt password hashing, security headers, rate limiting, and consistent API responses.
- MongoDB/Mongoose persistence across server restarts, indexed collections, and a repeatable fictional seed script.

## Run locally

Prerequisites: Node.js 20+, npm, and MongoDB (local or Atlas).

```bash
npm install --prefix server
npm install --prefix client
npm run dev --prefix server
npm run dev --prefix client
```

Open `http://localhost:5173`. The API listens on `http://localhost:5000`.

For a single command after installing the root dependency:

```bash
npm install
npm run install:all
npm run dev
```

## Environment

Copy `server/.env.example` to `server/.env`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-secret
MONGODB_URI=mongodb://127.0.0.1:27017/splitpay
```

The server requires `MONGODB_URI` and connects before accepting requests. Mongoose schemas and indexes are in `server/models/models.js`.

Seed fictional demo data after MongoDB is available:

```bash
npm run seed --prefix server
```

## Demo credentials

- Identifier: `demo@splitpay.local`
- Password: `demo1234`
- Merchant ID: `MCH-TYB-8F42K7`
- Demo QR token: `demo-profile-token`

Never use these credentials or sample UPI values for a real payment system.

## API surface

`GET /api/health` · `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` · `GET /api/merchant/me` · `GET /api/merchant/resolve/:token` · `POST /api/merchant/regenerate-qr` · `POST /api/payment-requests` · `GET /api/payment-requests` · `GET /api/payment-requests/:id` · `POST /api/tranches/:id/simulate-success` · `POST /api/tranches/:id/simulate-failure` · `GET /api/transactions` · `GET /api/analytics/dashboard`.

Protected endpoints expect `Authorization: Bearer <jwt>`. Responses use `{ success, message, data }`; errors use `{ success, message, error }`.

## Quality checks

```bash
npm test --prefix server
npm run lint --prefix client
npm run build --prefix client
```

The splitting tests cover 100, 1,999, 2,000.01, 4,500, 6,800, 10,000, zero, negative, and invalid count inputs and verify that tranche totals remain exact to cents.

## Demonstration flow

1. Open the dashboard and point out the explicit simulation-mode notice.
2. Open POS Split, change the amount and payment count, and show the exact tranche preview.
3. Open Transactions to explain status labels and the ledger view.
4. Open Profile to show the public merchant identity QR concept.
5. Open Analytics to explain that fee figures are educational estimates, not actual provider charges.
6. Mention that no UPI PIN is collected or stored and that real verification requires an authorized provider.

## Known limitations

The QR image download/scanner UI and admin screen still need a final browser-facing pass. Payment intents and simulation state are implemented, but provider webhooks, real verification, audit logs, and production payment processing are intentionally absent.