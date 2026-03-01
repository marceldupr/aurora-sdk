import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuroraClient } from "./index.js";

describe("AuroraClient", () => {
  const baseUrl = "https://api.example.com";
  const apiKey = "aur_test_abc123";
  const tenantSlug = "acme";

  let fetchSpy: { mock: { calls: unknown[] }; toHaveBeenCalledWith: (...args: unknown[]) => void; toHaveBeenCalled: () => boolean; toNotHaveBeenCalled?: () => void };

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({}),
      text: () => Promise.resolve("{}"),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("V1 APIs (no tenant required)", () => {
    it("lists tables at /v1/tables", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ slug: "products", name: "Products" }]),
        text: () => Promise.resolve("[]"),
      } as Response);

      await client.tables.list();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${baseUrl}/v1/tables`,
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({ "X-Api-Key": apiKey }),
        })
      );
    });

    it("lists records at /v1/tables/:slug/records", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [], total: 0, limit: 10, offset: 0 }),
        text: () => Promise.resolve("{}"),
      } as Response);

      await client.tables("products").records.list({ limit: 10, offset: 0 });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/v1/tables/products/records"),
        expect.any(Object)
      );
    });

    it("store.config calls /v1/store/config", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ enabled: true, catalogTableSlug: "products" }),
        text: () => Promise.resolve("{}"),
      } as Response);

      await client.store.config();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${baseUrl}/v1/store/config`,
        expect.any(Object)
      );
    });
  });

  describe("site APIs (require tenantSlug)", () => {
    it("site.search calls /api/tenants/:slug/site/search with query params", async () => {
      const client = new AuroraClient({ baseUrl, apiKey, tenantSlug });
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            hits: [],
            total: 0,
            facetDistribution: {},
            provider: "meilisearch",
          }),
        text: () => Promise.resolve("{}"),
      } as Response);

      await client.site.search({ q: "milk", limit: 20 });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(`${baseUrl}/api/tenants/${tenantSlug}/site/search\\?q=milk&limit=20`)
        ),
        expect.any(Object)
      );
    });

    it("site.stores calls /api/tenants/:slug/site/stores", async () => {
      const client = new AuroraClient({ baseUrl, apiKey, tenantSlug });
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
        text: () => Promise.resolve("{}"),
      } as Response);

      await client.site.stores();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${baseUrl}/api/tenants/${tenantSlug}/site/stores`,
        expect.any(Object)
      );
    });

    it("site.search throws when tenantSlug missing", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      const fn = () => client.site.search({ q: "x" });
      await expect(Promise.resolve().then(fn)).rejects.toThrow("tenantSlug is required");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("store APIs (require tenantSlug)", () => {
    it("store.deliverySlots calls /api/tenants/:slug/store/delivery-slots with lat/lng", async () => {
      const client = new AuroraClient({ baseUrl, apiKey, tenantSlug });
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
        text: () => Promise.resolve("{}"),
      } as Response);

      await client.store.deliverySlots(51.5, -0.1);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(
            `${baseUrl.replace(".", "\\.")}/api/tenants/${tenantSlug}/store/delivery-slots\\?lat=51\\.5&lng=-0\\.1`
          )
        ),
        expect.any(Object)
      );
    });

    it("store.checkout.sessions.create POSTs to checkout/sessions", async () => {
      const client = new AuroraClient({ baseUrl, apiKey, tenantSlug });
      const params = {
        lineItems: [{ priceData: { unitAmount: 1000 }, quantity: 1 }],
        successUrl: "https://store.com/success",
        cancelUrl: "https://store.com/cancel",
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "cs_123", url: "https://stripe.com/..." }),
        text: () => Promise.resolve("{}"),
      } as Response);

      await client.store.checkout.sessions.create(params);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${baseUrl}/api/tenants/${tenantSlug}/store/checkout/sessions`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(params),
        })
      );
    });

    it("store.checkout.acme.get calls acme endpoint with session param", async () => {
      const client = new AuroraClient({ baseUrl, apiKey, tenantSlug });
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            session_id: "acme_abc",
            line_items: [],
            total: 1000,
            currency: "GBP",
            success_url: "/success",
            cancel_url: "/cancel",
          }),
        text: () => Promise.resolve("{}"),
      } as Response);

      await client.store.checkout.acme.get("acme_abc");
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/store/checkout/acme?session=acme_abc`),
        expect.any(Object)
      );
    });

    it("store.checkout.acme.complete POSTs sessionId and shippingAddress", async () => {
      const client = new AuroraClient({ baseUrl, apiKey, tenantSlug });
      const shippingAddress = { line1: "1 High St", city: "London", postal_code: "SW1" };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, redirectUrl: "/success" }),
        text: () => Promise.resolve("{}"),
      } as Response);

      await client.store.checkout.acme.complete("acme_abc", shippingAddress);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${baseUrl}/api/tenants/${tenantSlug}/store/checkout/acme/complete`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ sessionId: "acme_abc", shippingAddress }),
        })
      );
    });

    it("store.deliverySlots throws when tenantSlug missing", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      const fn = () => client.store.deliverySlots(51, 0);
      await expect(Promise.resolve().then(fn)).rejects.toThrow("tenantSlug is required");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("holmes APIs (require tenantSlug)", () => {
    it("holmes.infer calls /api/tenants/:slug/holmes/infer with sid", async () => {
      const client = new AuroraClient({ baseUrl, apiKey, tenantSlug });
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ mission: { summary: "Buy milk", confidence: 0.8 } }),
        text: () => Promise.resolve("{}"),
      } as Response);

      await client.holmes.infer("session_xyz");
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/holmes/infer?sid=session_xyz`),
        expect.any(Object)
      );
    });

    it("holmes.infer throws when tenantSlug missing", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      const fn = () => client.holmes.infer("sid");
      await expect(Promise.resolve().then(fn)).rejects.toThrow("tenantSlug is required");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("throws with API error message on 4xx", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Invalid API key" }),
        text: () => Promise.resolve('{"error":"Invalid API key"}'),
      } as Response);

      await expect(client.tables.list()).rejects.toThrow("Aurora API 401: Invalid API key");
    });

    it("handles non-JSON error body", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      } as Response);

      await expect(client.tables.list()).rejects.toThrow("Aurora API 500");
    });
  });
});
