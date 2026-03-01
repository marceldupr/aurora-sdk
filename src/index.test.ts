import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuroraClient } from "./index.js";

const capabilitiesResponse = {
  tenantSlug: "acme",
  features: { store: true, site: true, holmes: true },
};

describe("AuroraClient", () => {
  const baseUrl = "https://api.example.com";
  const apiKey = "aur_test_abc123";

  let fetchSpy: {
    mock: { calls: unknown[] };
    toHaveBeenCalledWith: (...args: unknown[]) => void;
    toHaveBeenCalled: () => boolean;
  };

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/v1/capabilities")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(capabilitiesResponse),
          text: () => Promise.resolve(JSON.stringify(capabilitiesResponse)),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve("{}"),
      } as Response);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("V1 APIs (no capabilities required)", () => {
    it("lists tables at /v1/tables", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      (fetchSpy as ReturnType<typeof vi.spyOn>).mockResolvedValueOnce({
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

    it("store.config calls /v1/store/config", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      (fetchSpy as ReturnType<typeof vi.spyOn>).mockResolvedValueOnce({
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

  describe("capabilities discovery", () => {
    it("capabilities() fetches /v1/capabilities and caches result", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      const caps = await client.capabilities();
      expect(caps).toEqual(capabilitiesResponse);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/v1/capabilities"),
        expect.any(Object)
      );
      const caps2 = await client.capabilities();
      expect(caps2).toBe(caps);
      expect((fetchSpy as ReturnType<typeof vi.spyOn>).mock.calls.filter((c) => String(c[0]).includes("capabilities"))).toHaveLength(1);
    });
  });

  describe("site APIs (require site capability)", () => {
    it("site.search fetches capabilities then calls site/search", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      (fetchSpy as ReturnType<typeof vi.spyOn>)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(capabilitiesResponse),
          text: () => Promise.resolve("{}"),
        } as Response)
        .mockResolvedValueOnce({
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
          new RegExp(`${baseUrl}/api/tenants/acme/site/search\\?q=milk&limit=20`)
        ),
        expect.any(Object)
      );
    });

    it("site.search throws when site not available", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      (fetchSpy as ReturnType<typeof vi.spyOn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            tenantSlug: "acme",
            features: { store: true, site: false, holmes: true },
          }),
        text: () => Promise.resolve("{}"),
      } as Response);

      await expect(client.site.search({ q: "x" })).rejects.toThrow(
        "Site search is not available"
      );
    });
  });

  describe("store APIs (require store capability)", () => {
    it("store.deliverySlots fetches capabilities then calls delivery-slots", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      (fetchSpy as ReturnType<typeof vi.spyOn>)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(capabilitiesResponse),
          text: () => Promise.resolve("{}"),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [] }),
          text: () => Promise.resolve("{}"),
        } as Response);

      await client.store.deliverySlots(51.5, -0.1);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(
            `${baseUrl.replace(".", "\\.")}/api/tenants/acme/store/delivery-slots\\?lat=51\\.5&lng=-0\\.1`
          )
        ),
        expect.any(Object)
      );
    });

    it("store.deliverySlots throws when store not available", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      (fetchSpy as ReturnType<typeof vi.spyOn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            tenantSlug: "acme",
            features: { store: false, site: false, holmes: true },
          }),
        text: () => Promise.resolve("{}"),
      } as Response);

      await expect(client.store.deliverySlots(51, 0)).rejects.toThrow("Store is not available");
    });
  });

  describe("holmes APIs (require holmes capability)", () => {
    it("holmes.infer throws when holmes not available", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      (fetchSpy as ReturnType<typeof vi.spyOn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            tenantSlug: "acme",
            features: { store: true, site: true, holmes: false },
          }),
        text: () => Promise.resolve("{}"),
      } as Response);

      await expect(client.holmes.infer("sid")).rejects.toThrow("Holmes is not available");
    });
  });

  describe("error handling", () => {
    it("throws with API error message on 4xx", async () => {
      const client = new AuroraClient({ baseUrl, apiKey });
      (fetchSpy as ReturnType<typeof vi.spyOn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Invalid API key" }),
        text: () => Promise.resolve('{"error":"Invalid API key"}'),
      } as Response);

      await expect(client.tables.list()).rejects.toThrow("Aurora API 401: Invalid API key");
    });
  });
});
