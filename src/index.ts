/**
 * Aurora Studio SDK - Fluent API for custom front-ends and storefronts.
 * Use with X-Api-Key authentication.
 */

export interface AuroraClientOptions {
  /** API base URL (e.g. https://api.aurora.com) */
  baseUrl: string;
  /** API key (storefront or workspace scope) */
  apiKey: string;
  /** Tenant slug — required for site, store, and holmes APIs. Omit for v1 tables/views/reports only. */
  tenantSlug?: string;
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

function requireTenant(tenantSlug: string | undefined): string {
  if (!tenantSlug) {
    throw new Error("tenantSlug is required for this API. Pass it in AuroraClientOptions.");
  }
  return tenantSlug;
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
  private tenantSlug: string | undefined;

  constructor(options: AuroraClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.tenantSlug = options.tenantSlug;
  }

  private req<T>(
    method: string,
    path: string,
    opts?: { body?: unknown; query?: QueryParams }
  ): Promise<T> {
    return request<T>(this.baseUrl, this.apiKey, method, path, opts);
  }

  private tenantPath(segment: string): string {
    const slug = requireTenant(this.tenantSlug);
    return `/api/tenants/${encodeURIComponent(slug)}${segment}`;
  }

  // --- V1 APIs (tenant from API key) ---

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
    /** Delivery slots for a location. Requires tenantSlug. */
    deliverySlots: (lat: number, lng: number): Promise<{ data: DeliverySlot[] }> => {
      return this.req("GET", this.tenantPath("/store/delivery-slots"), {
        query: { lat: String(lat), lng: String(lng) },
      });
    },
    /** Create checkout session (Stripe or ACME). Requires tenantSlug. */
    checkout: {
      sessions: {
        create: (params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult> =>
          this.req("POST", this.tenantPath("/store/checkout/sessions"), { body: params }),
      },
      acme: {
        get: (sessionId: string): Promise<AcmeSession> =>
          this.req("GET", this.tenantPath("/store/checkout/acme"), {
            query: { session: sessionId },
          }),
        complete: (
          sessionId: string,
          shippingAddress?: {
            line1?: string;
            line2?: string;
            city?: string;
            postal_code?: string;
            country?: string;
          }
        ): Promise<AcmeCompleteResult> =>
          this.req("POST", this.tenantPath("/store/checkout/acme/complete"), {
            body: { sessionId, shippingAddress },
          }),
      },
    },
  };

  /** Meilisearch-powered site search. Requires tenantSlug. */
  site = {
    search: (params: SearchParams): Promise<SearchResult> =>
      this.req("GET", this.tenantPath("/site/search"), { query: params as QueryParams }),
    /** List stores/vendors for storefront. Requires tenantSlug. */
    stores: (): Promise<{ data: StoreItem[] }> =>
      this.req("GET", this.tenantPath("/site/stores")),
  };

  /** Holmes AI mission inference. Requires tenantSlug. */
  holmes = {
    infer: (sessionId: string): Promise<HolmesInferResult> =>
      this.req("GET", this.tenantPath("/holmes/infer"), {
        query: { sid: sessionId },
      }),
  };
}
