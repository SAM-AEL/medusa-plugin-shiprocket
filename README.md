<p align="center">
  <img src="https://img.shields.io/npm/v/@sam-ael/medusa-plugin-shiprocket?style=flat-square&color=F97316" alt="npm version" />
  <img src="https://img.shields.io/badge/medusa-v2-7C3AED?style=flat-square" alt="Medusa v2" />
  <img src="https://img.shields.io/npm/l/@sam-ael/medusa-plugin-shiprocket?style=flat-square" alt="license" />
</p>

# @sam-ael/medusa-plugin-shiprocket

A complete **Shiprocket** fulfillment integration for **MedusaJS v2** stores operating in India.

This plugin handles the full lifecycle of shipping through Shiprocket: from fetching live courier rates and delivery estimates at checkout, to automatically generating shipments, AWBs, and shipping labels when a fulfillment is created in the Medusa Admin.

---

## Features

- 🚚 **Live Shipping Rates** — Provides live courier rates and delivery estimates during checkout based on the customer's pincode.
- 📦 **Automated Fulfillment** — Automatically generate Shiprocket orders, AWBs, and shipping labels whenever a Medusa fulfillment is created.
- 🪝 **Real-Time Tracking** — Receive automated status updates via webhooks and synchronize them deeply within Medusa for customers and admins.
- 🖥️ **Admin Tracking Widget** — Custom widget inside the Medusa Admin for viewing live statuses, shipping timelines, and quickly downloading AWBs/Invoices.
- 💵 **Cash on Delivery Flow** — Easily configurable to accept COD payments with Shiprocket natively.
- ⚙️ **Courier Preferences** — Tell the fulfillment engine to prefer `FAST` deliveries or `CHEAP` deliveries. 

---

## Prerequisites

- **MedusaJS v2** (`>= 2.x`)
- A **Shiprocket** Account
- Properly configured Product Variants (Weight in grams, Length/Width/Height in cm) — required by Shiprocket.

---

## Installation

```bash
yarn add @sam-ael/medusa-plugin-shiprocket
```

Or with npm:

```bash
npm install @sam-ael/medusa-plugin-shiprocket
```

---

## Configuration

### 1. Set environment variables

Add the required credentials to your `.env` file:

```env
# Required
SHIPROCKET_EMAIL="your_email@example.com"
SHIPROCKET_PASSWORD="your_shiprocket_password"

# Optional
SHIPROCKET_PICKUP_LOCATION="Primary"           # The exact nickname of your pickup location in Shiprocket
SHIPROCKET_WEBHOOK_TOKEN="secure_random_token" # Token for authenticating incoming webhooks from Shiprocket
SHIPROCKET_DELIVERY_PREFERENCE="FAST"          # FAST or CHEAP (default: FAST)
```

### 2. Configure the plugin in `medusa-config.ts`

You need to add it to both the `modules` section (for the fulfillment provider) and the `plugins` section (for the admin UI and API routes).

```typescript
import { defineConfig } from "@medusajs/framework/utils"

export default defineConfig({
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
              cod: "false", // set to "true" if you want to enable automatic Cash on Delivery flows
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
  ],
})
```

---

## How It Works

### Live Shipping Rates & Delivery Estimates
At checkout, your storefront can query the plugin to get live delivery estimates and check if a pincode is serviceable by Shiprocket. It uses the `SHIPROCKET_DELIVERY_PREFERENCE` to pick the best courier based on speed or price. 
> *Note: These API endpoints are heavily rate-limited and cached in-memory to prevent abuse.*

### Order Fulfillment
When you create a fulfillment in the Medusa admin, this plugin automatically maps the order details, calculates total weights and dimensions, and sends a create order request to Shiprocket. It will then automatically assign an AWB (Air Waybill) and generate the shipping label, invoice, and manifest.

**⚠️ Important Note on Dimensions:**
Shiprocket is very strict about calculating shipping costs based on volumetric weight. If dimensions are missing, Shiprocket can penalize your account. This plugin requires you to set the `weight` (in grams), `length`, `width`, and `height` (in cm) on your Medusa Product Variants. The plugin will throw an error and refuse to create the fulfillment if these are missing.

### Automated Tracking via Webhooks
You can set up webhooks in your Shiprocket dashboard to send real-time tracking updates back to Medusa.
1. Go to Shiprocket Settings → Webhooks
2. Add Webhook URL: `https://your-domain.com/hooks/fulfillment/shiprocket`
3. Add a custom header `x-api-key` and set it to match your `SHIPROCKET_WEBHOOK_TOKEN` in Medusa.

When updates hit this endpoint, the plugin will sync the status to the Medusa order so your customers and admins always see the latest tracking info.

### Admin Dashboard Widget
We inject a custom tracking widget directly into the Order detail page in the Medusa Admin. This widget lets you:
- See the current tracking status
- View a timeline of shipping events
- Download the shipping label, invoice, and manifest directly from Medusa
- Manually trigger a tracking sync if you don't want to use webhooks

---

## API Reference

### Storefront APIs

| Method | Endpoint | Description | Query Params |
|---|---|---|---|
| `GET` | `/store/shiprocket/delivery-estimate` | Checks if a pincode is serviceable and returns an estimated delivery date and price. | `delivery_pincode`, `weight` (opt), `cod` (opt) |
| `GET` | `/store/shiprocket/tracking/:awb` | Returns the tracking history for a specific AWB. | — |

### Admin APIs

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/admin/shiprocket/tracking/:awb/sync` | Manually pull the latest tracking details and regenerate document URLs. |

---

## License

MIT
