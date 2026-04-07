<p align="center">
  <img src="https://img.shields.io/npm/v/@sam-ael/medusa-plugin-shiprocket?style=flat-square&color=EA580C" alt="npm version" />
  <img src="https://img.shields.io/badge/medusa-v2-0F172A?style=flat-square" alt="Medusa v2" />
  <img src="https://img.shields.io/badge/category-shipping-7C2D12?style=flat-square" alt="shipping plugin" />
  <img src="https://img.shields.io/npm/l/@sam-ael/medusa-plugin-shiprocket?style=flat-square" alt="license" />
</p>

# @sam-ael/medusa-plugin-shiprocket

Production-focused Shiprocket integration for Medusa v2 with fulfillment automation, delivery estimate APIs, and tracking synchronization.

## Highlights

- Shiprocket fulfillment provider integration
- Delivery estimate endpoint for storefront experiences
- Tracking sync endpoints for admin and storefront views
- Webhook ingestion for status updates
- Hardened API responses and stricter payload validation
- Webhook idempotency guard and explicit public webhook handling
- Tracking ownership hardening and AWB validation

## Install

```bash
yarn add @sam-ael/medusa-plugin-shiprocket
```

## Medusa Configuration

```ts
modules: [
  {
    resolve: "@medusajs/medusa/fulfillment",
    options: {
      providers: [
        {
          resolve: "@sam-ael/medusa-plugin-shiprocket",
          id: "shiprocket",
          options: {
            email: process.env.SHIPROCKET_EMAIL,
            password: process.env.SHIPROCKET_PASSWORD,
            pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION,
          },
        },
      ],
    },
  },
],
plugins: [
  {
    resolve: "@sam-ael/medusa-plugin-shiprocket",
    options: {},
  },
]
```

## Environment Variables

```env
SHIPROCKET_EMAIL=your_email@example.com
SHIPROCKET_PASSWORD=your_password
SHIPROCKET_PICKUP_LOCATION=Primary
SHIPROCKET_WEBHOOK_TOKEN=your_webhook_token
SHIPROCKET_DELIVERY_PREFERENCE=FAST

SHIPROCKET_API_TIMEOUT_MS=15000
SHIPROCKET_WEBHOOK_PAYLOAD_RETENTION_DAYS=30
```

## API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/store/shiprocket/delivery-estimate` | Delivery estimate lookup |
| `GET` | `/store/shiprocket/tracking/:awb` | Store tracking lookup |
| `POST` | `/hooks/fulfillment/shiprocket` | Shiprocket webhook receiver |
| `GET` | `/admin/shiprocket/tracking/:awb` | Admin tracking details |
| `POST` | `/admin/shiprocket/tracking/:awb/sync` | Force tracking/document sync |

## Security and Reliability Notes

- Unified error contract: `{ success: false, code, message, details? }`
- AWB and query validation added for tracking and estimate APIs
- Webhook token validation with constant-time compare
- Webhook replay/idempotency keying on AWB + status/timestamp
- Public route boundaries are explicit
- Retention cleanup job for webhook raw payload minimization
- Indexes added for high-frequency lookup fields

## Quality Gates

```bash
yarn typecheck
yarn lint
yarn test
yarn build
```

Smoke tests are available under `src/tests`.

## License

MIT
