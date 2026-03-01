# @aurora-studio/sdk

Node.js SDK for Aurora Studio. Connect custom front-ends and storefronts to your Aurora data via the V1 API, site APIs, and store APIs.

**Aurora** is an all-in-one, no-code platform for stores, marketplaces, CRMs, and more. Design your data, generate your app, automate workflows. Ship in hours, not months.

[**Sign up for Aurora**](https://aurora.mandeville.digital) — currently in beta testing and free.

## Changelog

- **0.1.4** — Site search, stores, delivery slots, checkout (Stripe/ACME), Holmes infer. Pass `tenantSlug` for tenant-scoped APIs.
- **0.1.3** — Add repository field for provenance
- **0.1.2** — Trusted publishing (OIDC) configured
- **0.1.1** — CI/CD setup
- **0.1.0** — Initial release

## Install

```bash
npm install @aurora-studio/sdk
```

## Usage

```ts
import { AuroraClient } from "@aurora-studio/sdk";

const aurora = new AuroraClient({
  baseUrl: "https://api.youraurora.com",
  apiKey: "aur_xxx...",
  tenantSlug: "acme", // Required for site, store, and holmes APIs
});

// V1 APIs (tenant from API key)
const tables = await aurora.tables.list();
const { data, total } = await aurora.tables("products").records.list({ limit: 10 });
const config = await aurora.store.config();

// Site APIs (require tenantSlug)
const searchResult = await aurora.site.search({ q: "milk", limit: 20 });
const { data: stores } = await aurora.site.stores();

// Store APIs (require tenantSlug)
const { data: slots } = await aurora.store.deliverySlots(51.5, -0.1);
const { id, url } = await aurora.store.checkout.sessions.create({
  lineItems: [{ priceData: { unitAmount: 1000 }, quantity: 1 }],
  successUrl: "https://store.com/success",
  cancelUrl: "https://store.com/cancel",
});

// ACME checkout (require tenantSlug)
const session = await aurora.store.checkout.acme.get("acme_abc");
const { redirectUrl } = await aurora.store.checkout.acme.complete("acme_abc", {
  line1: "1 High St",
  city: "London",
  postal_code: "SW1",
});

// Holmes AI (require tenantSlug)
const infer = await aurora.holmes.infer("session_id");
```

## API Surface

### V1 APIs (tenant from API key)

| Method                                         | Description        |
| ---------------------------------------------- | ------------------ |
| `client.tables.list()`                         | List tables        |
| `client.tables(slug).records.list(opts)`       | List records       |
| `client.tables(slug).records.get(id)`          | Get record         |
| `client.tables(slug).records.create(data)`     | Create record      |
| `client.tables(slug).records.update(id, data)` | Update record      |
| `client.tables(slug).records.delete(id)`       | Delete record      |
| `client.tables(slug).sectionViews.list()`      | List section views |
| `client.views.list()`                          | List report views  |
| `client.views(slug).data()`                    | Get view data      |
| `client.reports.list()`                        | List reports       |
| `client.reports(id).data()`                    | Get report data    |
| `client.store.config()`                        | Get store config   |
| `client.store.pages.list()`                    | List store pages   |
| `client.store.pages.get(slug)`                 | Get store page     |

### Site APIs (require `tenantSlug`)

| Method                    | Description              |
| ------------------------- | ------------------------ |
| `client.site.search(opts)` | Meilisearch product search |
| `client.site.stores()`    | List stores/vendors      |

### Store APIs (require `tenantSlug`)

| Method                                    | Description               |
| ----------------------------------------- | ------------------------- |
| `client.store.deliverySlots(lat, lng)`    | Get delivery slots        |
| `client.store.checkout.sessions.create(params)` | Create checkout session   |
| `client.store.checkout.acme.get(sessionId)`      | Get ACME session          |
| `client.store.checkout.acme.complete(sessionId, addr?)` | Complete ACME checkout |

### Holmes (require `tenantSlug`)

| Method                   | Description        |
| ------------------------ | ------------------ |
| `client.holmes.infer(sid)` | Mission inference  |

Create API keys in Aurora Studio → Settings → API Keys.
