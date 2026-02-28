# @aurora-studio/sdk

Node.js SDK for Aurora Studio. Connect custom front-ends and storefronts to your Aurora data via the V1 API.

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

// List tables
const tables = await aurora.tables.list();

// List records
const { data, total } = await aurora.tables("products").records.list({ limit: 10 });

// Get single record
const product = await aurora.tables("products").records.get("uuid");

// Create record
const created = await aurora.tables("products").records.create({ name: "New Product" });

// Store config and pages
const config = await aurora.store.config();
const pages = await aurora.store.pages.list();
```

## API Surface

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

Create API keys in Aurora Studio → Settings → API Keys.
