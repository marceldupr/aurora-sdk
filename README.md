# @aurora-studio/sdk

Node.js SDK for Aurora Studio. Connect custom front-ends and storefronts to your Aurora data via the V1 API. Features (store, site, holmes) are **discovered** from the API — only enabled capabilities expose methods.

**Aurora** is an all-in-one, no-code platform for stores, marketplaces, CRMs, and more. Design your data, generate your app, automate workflows. Ship in hours, not months.

[**Sign up for Aurora**](https://aurora.mandeville.digital) — currently in beta testing and free.

## Changelog

- **0.1.5** — Discovery-based: `client.capabilities()` fetches enabled features from `/v1/capabilities`. Store, site, holmes methods only available when installed. No template-specific hardcoding.
- **0.1.4** — Site search, stores, delivery slots, checkout, Holmes infer
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
});

// V1 APIs (always available)
const tables = await aurora.tables.list();
const config = await aurora.store.config(); // enabled: false when no store template

// Discover what's installed
const caps = await aurora.capabilities();
// { tenantSlug: "acme", features: { store: true, site: true, holmes: true } }

// Site/store/holmes only work when the feature is enabled
if (caps.features.site) {
  const result = await aurora.site.search({ q: "milk" });
}
if (caps.features.store) {
  const { data: slots } = await aurora.store.deliverySlots(51.5, -0.1);
}
if (caps.features.holmes) {
  const infer = await aurora.holmes.infer("session_id");
}

// If you call a disabled feature, you get a clear error:
// "Store is not available. This tenant may not have the relevant template installed."
```

## API Surface

### Capabilities (discovery)

| Method | Description |
| ------ | ----------- |
| `client.capabilities()` | Fetch enabled features. Cached. Returns `{ tenantSlug, features: { store?, site?, holmes? } }` |

### V1 APIs (always available)

| Method | Description |
| ------ | ----------- |
| `client.tables.list()` | List tables |
| `client.tables(slug).records.list(opts)` | List records |
| `client.tables(slug).records.get(id)` | Get record |
| `client.tables(slug).records.create(data)` | Create record |
| `client.tables(slug).records.update(id, data)` | Update record |
| `client.tables(slug).records.delete(id)` | Delete record |
| `client.store.config()` | Store config (enabled: false when no template) |
| `client.store.pages.list()` | List store pages |

### Site APIs (when `features.site` is true)

| Method | Description |
| ------ | ----------- |
| `client.site.search(opts)` | Meilisearch product search |
| `client.site.stores()` | List stores/vendors |

### Store APIs (when `features.store` is true)

| Method | Description |
| ------ | ----------- |
| `client.store.deliverySlots(lat, lng)` | Delivery slots |
| `client.store.checkout.sessions.create(params)` | Create checkout session |
| `client.store.checkout.acme.get(sessionId)` | Get ACME session |
| `client.store.checkout.acme.complete(sessionId, addr?)` | Complete ACME checkout |

### Holmes (when `features.holmes` is true)

| Method | Description |
| ------ | ----------- |
| `client.holmes.infer(sid)` | Mission inference |

Create API keys in Aurora Studio → Settings → API Keys.
