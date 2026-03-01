/**
 * Aurora Studio SDK - Discovery-based API for custom front-ends and storefronts.
 * Use with X-Api-Key authentication. Capabilities (store, site, holmes) are
 * discovered from the API — only enabled features expose methods.
 */

export interface AuroraClientOptions {
  /** API base URL (e.g. https://api.aurora.com) */
  baseUrl: string;
  /** API key (storefront or workspace scope) */
  apiKey: string;
}

export interface Capabilities {
  tenantSlug: string;
  features: {
    store?: boolean;
    site?: boolean;
    holmes?: boolean;
  };
}

type QueryParams = Record<string, string | number | boolean | undefined>;

function buildQuery(params?: QueryParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      search.set(k, String(v));
    }
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

async function request<T>(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  opts?: { body?: unknown; query?: QueryParams }
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}${buildQuery(opts?.query)}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.text();
    let msg: string;
    try {
      const j = JSON.parse(errBody);
      msg = (j?.error as string) ?? errBody ?? res.statusText;
    } catch {
      msg = errBody || res.statusText;
    }
    throw new Error(`Aurora API ${res.status}: ${msg}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function notAvailable(feature: string): never {
  throw new Error(
    `${feature} is not available. This tenant may not have the relevant template installed. ` +
      `Check client.capabilities() to see what features are enabled.`
  );
}

// --- Types for site/store/holmes APIs ---

export interface SearchParams {
  q?: string;
  limit?: number;
  offset?: number;
  vendorId?: string;
  category?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface SearchHit {
  id: string;
  docType?: string;
  tableSlug: string;
  recordId: string;
  snippet?: string;
  name?: string;
  title?: string;
  price?: number;
  image_url?: string;
  vendor_id?: string;
  [key: string]: unknown;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  facetDistribution: Record<string, unknown>;
  provider: "meilisearch" | "fallback";
}

export interface DeliverySlot {
  id: string;
  vendor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_orders: number;
  orders_count: number;
}

export interface StoreItem {
  id: string;
  email?: string;
  name: string;
  location?: unknown;
  address?: string;
  image_url?: string;
}

export interface CheckoutLineItem {
  productId?: string;
  tableSlug?: string;
  quantity?: number;
  sellByWeight?: boolean;
  priceData: {
    unitAmount: number;
    currency?: string;
    productData?: { name?: string };
  };
}

export interface CreateCheckoutSessionParams {
  lineItems: CheckoutLineItem[];
  successUrl: string;
  cancelUrl: string;
  currency?: string;
  deliverySlotId?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
}

export interface AcmeSession {
  session_id: string;
  line_items: Array<{
    name?: string;
    quantity?: number;
    unitAmount?: number;
  }>;
  total: number;
  currency: string;
  success_url: string;
  cancel_url: string;
  requireShipping?: boolean;
}

export interface AcmeCompleteResult {
  success: boolean;
  redirectUrl?: string;
}

export interface HolmesInferResult {
  mission?: { summary: string; confidence: number };
  bundle?: {
    headline: string;
    subheadline?: string;
    productIds: string[];
    productTableSlug?: string;
    products?: Array<{ id: string; name: string; price?: number; image?: string }>;
    reasoning?: string;
  };
}

export class AuroraClient {
  private baseUrl: string;
  private apiKey: string;
  private caps: Capabilities | null = null;

  constructor(options: AuroraClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
  }

  private req<T>(
    method: string,
    path: string,
    opts?: { body?: unknown; query?: QueryParams }
  ): Promise<T> {
    return request<T>(this.baseUrl, this.apiKey, method, path, opts);
  }

  private tenantPath(segment: string, slug: string): string {
    return `/api/tenants/${encodeURIComponent(slug)}${segment}`;
  }

  /**
   * Discover what features are installed for this tenant.
   * Store, site, and holmes methods are only available when the corresponding feature is enabled.
   */
  async capabilities(): Promise<Capabilities> {
    if (this.caps) return this.caps;
    this.caps = await this.req<Capabilities>("GET", "/v1/capabilities");
    return this.caps;
  }

  // --- V1 APIs (always available) ---

  tables = Object.assign(
    (slug: string) => ({
      records: {
        list: (opts?: {
          limit?: number;
          offset?: number;
          sort?: string;
          order?: "asc" | "desc";
          filter?: string;
        }) =>
          this.req<{
            data: Record<string, unknown>[];
            total: number;
            limit: number;
            offset: number;
          }>("GET", `/v1/tables/${slug}/records`, { query: opts as QueryParams }),
        get: (id: string) =>
          this.req<Record<string, unknown>>("GET", `/v1/tables/${slug}/records/${id}`),
        create: (data: Record<string, unknown>) =>
          this.req<Record<string, unknown>>("POST", `/v1/tables/${slug}/records`, { body: data }),
        update: (id: string, data: Record<string, unknown>) =>
          this.req<Record<string, unknown>>("PATCH", `/v1/tables/${slug}/records/${id}`, {
            body: data,
          }),
        delete: (id: string) => this.req<void>("DELETE", `/v1/tables/${slug}/records/${id}`),
      },
      sectionViews: {
        list: () =>
          this.req<Array<{ id: string; name: string; view_type: string; config: unknown }>>(
            "GET",
            `/v1/tables/${slug}/views`
          ),
      },
    }),
    {
      list: () => this.req<Array<{ slug: string; name: string }>>("GET", "/v1/tables"),
    }
  );

  views = Object.assign(
    (slug: string) => ({
      data: () => this.req<{ data: unknown[] }>("GET", `/v1/views/${slug}/data`),
    }),
    { list: () => this.req<Array<{ slug: string; name: string }>>("GET", "/v1/views") }
  );

  reports = Object.assign(
    (id: string) => ({
      data: () => this.req<{ data: unknown[] }>("GET", `/v1/reports/${id}/data`),
    }),
    {
      list: () =>
        this.req<Array<{ id: string; name: string; description?: string; config: unknown }>>(
          "GET",
          "/v1/reports"
        ),
    }
  );

  store = {
    /** Always available — returns enabled: false when no store template installed */
    config: () =>
      this.req<{
        enabled: boolean;
        catalogTableSlug?: string;
        displayField?: string;
        listFields?: string[];
        detailFields?: string[];
        groupingFields?: string[];
        branding?: {
          name: string;
          logo_url?: string;
          accent_color?: string;
          show_powered_by?: boolean;
        };
        theme?: { primaryColor?: string; fontFamily?: string; spacingScale?: string };
      }>("GET", "/v1/store/config"),
    pages: {
      list: () => this.req<Array<{ slug: string; name: string }>>("GET", "/v1/store/pages"),
      get: (slug: string) =>
        this.req<{ slug: string; name: string; blocks: unknown[] }>(
          "GET",
          `/v1/store/pages/${slug}`
        ),
    },
    deliverySlots: async (lat: number, lng: number): Promise<{ data: DeliverySlot[] }> => {
      const caps = await this.capabilities();
      if (!caps.features.store) notAvailable("Store");
      return this.req("GET", this.tenantPath("/store/delivery-slots", caps.tenantSlug), {
        query: { lat: String(lat), lng: String(lng) },
      });
    },
    checkout: {
      sessions: {
        create: async (params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult> => {
          const caps = await this.capabilities();
          if (!caps.features.store) notAvailable("Store");
          return this.req("POST", this.tenantPath("/store/checkout/sessions", caps.tenantSlug), {
            body: params,
          });
        },
      },
      acme: {
        get: async (sessionId: string): Promise<AcmeSession> => {
          const caps = await this.capabilities();
          if (!caps.features.store) notAvailable("Store");
          return this.req("GET", this.tenantPath("/store/checkout/acme", caps.tenantSlug), {
            query: { session: sessionId },
          });
        },
        complete: async (
          sessionId: string,
          shippingAddress?: {
            line1?: string;
            line2?: string;
            city?: string;
            postal_code?: string;
            country?: string;
          }
        ): Promise<AcmeCompleteResult> => {
          const caps = await this.capabilities();
          if (!caps.features.store) notAvailable("Store");
          return this.req("POST", this.tenantPath("/store/checkout/acme/complete", caps.tenantSlug), {
            body: { sessionId, shippingAddress },
          });
        },
      },
    },
  };

  site = {
    search: async (params: SearchParams): Promise<SearchResult> => {
      const caps = await this.capabilities();
      if (!caps.features.site) notAvailable("Site search");
      return this.req("GET", this.tenantPath("/site/search", caps.tenantSlug), {
        query: params as QueryParams,
      });
    },
    stores: async (): Promise<{ data: StoreItem[] }> => {
      const caps = await this.capabilities();
      if (!caps.features.site) notAvailable("Site stores");
      return this.req("GET", this.tenantPath("/site/stores", caps.tenantSlug));
    },
  };

  holmes = {
    infer: async (sessionId: string): Promise<HolmesInferResult> => {
      const caps = await this.capabilities();
      if (!caps.features.holmes) notAvailable("Holmes");
      return this.req("GET", this.tenantPath("/holmes/infer", caps.tenantSlug), {
        query: { sid: sessionId },
      });
    },
  };
}
