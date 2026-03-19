/**
 * Aurora Studio SDK - Discovery-based API for custom front-ends and storefronts.
 * Use with X-Api-Key authentication. Capabilities (store, site, holmes) are
 * discovered from the API - only enabled features expose methods.
 *
 * When specUrl is provided (or default baseUrl + /v1/openapi.json), the client
 * fetches the tenant OpenAPI spec and can adjust itself: request() uses the
 * spec's server URL, and search/me/events call the paths defined in the spec.
 */

export interface AuroraClientOptions {
  /** API base URL (e.g. https://api.aurora.com) */
  baseUrl: string;
  /** API key (storefront or workspace scope) */
  apiKey: string;
  /**
   * OpenAPI spec URL for this tenant. When set, the SDK fetches the spec and
   * uses it for request() base URL and for spec-driven methods (search, me, events).
   * Default: baseUrl + "/v1/openapi.json"
   */
  specUrl?: string;
}

/** Minimal OpenAPI 3 spec shape used by the SDK */
export interface OpenAPISpec {
  openapi: string;
  servers: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, unknown>>;
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

/**
 * Build the Holmes script URL for embedding in storefronts.
 * Use when you have apiBase and tenantSlug from env (e.g. in Next.js layout).
 */
export function getHolmesScriptUrl(apiBase: string, tenantSlug: string): string {
  const base = apiBase.replace(/\/$/, "");
  return `${base}/api/holmes/v1/script.js?site=${encodeURIComponent(tenantSlug)}`;
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
  /** Holmes session ID for session→order attribution (holdout, impact metrics) */
  holmes_session_id?: string;
  /** Timestamp (ms) when mission started (e.g. first add-to-cart) for time-to-completion metrics */
  holmes_mission_start_timestamp?: number;
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

export interface HolmesRecipe {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  ingredients: Array<{ name: string; quantity?: string; unit?: string }>;
  instructions: string | null;
  origin_tidbit: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface HolmesTidbit {
  id: string;
  category: string;
  content: string;
  source_url?: string;
}

export interface HolmesContextualHintResult {
  hint: string | null;
  products: Array<{ id: string; name: string; price?: number; image?: string }>;
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

export interface QuickAction {
  label: string;
  href: string;
}

export interface Mission {
  label: string;
  href: string;
}

export interface ShoppingListTemplate {
  slug: string;
  label: string;
  description?: string;
  searchTerms: string[];
}

export interface HomePersonalizationResult {
  mode?: "default" | "recipe_mission";
  recipeSlug?: string;
  recipeTitle?: string;
  hero: {
    title: string;
    subtitle: string;
    imageUrl: string | null;
    ctaButtons: Array<{ label: string; url: string }>;
  };
  sections: Array<{
    type: "meals" | "top_up" | "inspiration" | "promo" | "for_you" | "featured";
    title: string;
    subtitle?: string;
    products?: Array<{ id: string; name: string; price?: number; image_url?: string }>;
    cards?: Array<{ title: string; imageUrl: string | null; linkUrl: string }>;
    imageUrl?: string | null;
  }>;
  /** Holmes-influenced when inference >= 0.6; else time-of-day defaults */
  quickActions?: QuickAction[];
  /** Holmes-influenced when inference >= 0.6; else generic missions */
  missions?: Mission[];
  /** Shopping list templates when inference matches */
  shoppingListTemplates?: ShoppingListTemplate[];
  /** Trust signal: "Because it's 6pm", "Based on your browsing", etc. */
  trustSignal?: string;
}

// --- Auth (app users: storefront sign in/up, session, list customers) ---

export interface AuthSignInParams {
  email: string;
  password: string;
}

export interface AuthSignUpParams {
  email: string;
  password: string;
  options?: {
    data?: Record<string, unknown>;
    emailRedirectTo?: string;
  };
}

export interface AuthSessionResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  };
  expires_at?: number;
}

/** Signup may return a session or, when email confirmation is required, only user + message. */
export type AuthSignUpResponse =
  | AuthSessionResponse
  | { user: AuthSessionResponse["user"]; message: string };

export interface AuthSessionUser {
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  };
}

export interface AuthUserListItem {
  id?: string;
  user_id: string;
  email?: string;
  display_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuthUsersResponse {
  data: AuthUserListItem[];
  total: number;
  limit: number;
  offset: number;
}

export class AuroraClient {
  private baseUrl: string;
  private apiKey: string;
  private specUrl: string;
  private caps: Capabilities | null = null;
  private specPromise: Promise<OpenAPISpec> | null = null;

  constructor(options: AuroraClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.specUrl =
      options.specUrl ?? `${this.baseUrl}/v1/openapi.json`;
  }

  /**
   * Fetch and cache the tenant OpenAPI spec (from specUrl with API key).
   * Used by request() and by spec-driven methods.
   */
  async getSpec(): Promise<OpenAPISpec> {
    if (this.specPromise) return this.specPromise;
    this.specPromise = (async () => {
      const res = await fetch(this.specUrl, {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.apiKey,
        },
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to load OpenAPI spec: ${res.status} ${err}`);
      }
      return res.json() as Promise<OpenAPISpec>;
    })();
    return this.specPromise;
  }

  /**
   * Base URL for v1/spec-driven requests. Uses spec server URL when spec is loaded and absolute, else baseUrl + /v1.
   */
  private async getV1Base(): Promise<string> {
    const fallback = `${this.baseUrl}/v1`;
    try {
      const spec = await this.getSpec();
      const server = spec.servers?.[0]?.url;
      const base = server ? server.replace(/\/$/, "") : "";
      // Only use spec server URL if it's absolute (Node fetch rejects relative URLs)
      if (base && (base.startsWith("http://") || base.startsWith("https://"))) {
        return base;
      }
    } catch {
      // fallback to default
    }
    return fallback;
  }

  /**
   * Low-level request to the tenant API. Path is relative to the spec's server (e.g. /tables, /search).
   * Uses the tenant OpenAPI spec URL when available so the SDK adjusts to the tenant's surface.
   */
  async request<T = unknown>(
    method: string,
    path: string,
    opts?: { body?: unknown; query?: QueryParams; headers?: Record<string, string> }
  ): Promise<T> {
    const base = await this.getV1Base();
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}${buildQuery(opts?.query)}`;
    if (url.startsWith("/")) {
      throw new Error(
        "Aurora API baseUrl must be an absolute URL. Set AURORA_API_URL or NEXT_PUBLIC_AURORA_API_URL to your Aurora API root (e.g. https://api.youraurora.com)."
      );
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Api-Key": this.apiKey,
      ...opts?.headers,
    };
    const res = await fetch(url, {
      method,
      headers,
      body: opts?.body != null ? JSON.stringify(opts.body) : undefined,
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

  /**
   * Request using only Bearer token (no API key). Used for app-user session and signout.
   */
  private async requestWithBearer<T = unknown>(
    method: string,
    path: string,
    accessToken: string,
    opts?: { body?: unknown }
  ): Promise<T> {
    const base = await this.getV1Base();
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    if (url.startsWith("/")) {
      throw new Error(
        "Aurora API baseUrl must be an absolute URL. Set AURORA_API_URL or NEXT_PUBLIC_AURORA_API_URL to your Aurora API root (e.g. https://api.youraurora.com)."
      );
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    const res = await fetch(url, {
      method,
      headers,
      body: opts?.body != null ? JSON.stringify(opts.body) : undefined,
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

  /**
   * Provision schema from template (tables, optional reports/workflows).
   * Call on first run when your app needs its tables. Requires valid API key.
   * base: "marketplace-base" if the workspace is a marketplace (vendors, products); "base" or omit for non-marketplace.
   * Idempotent: only adds missing tables/columns.
   */
  async provisionSchema(
    schema: {
      tables: Array<{ slug: string; name: string; icon?: string; fields: unknown[] }>;
      reports?: Array<{
        name: string;
        description?: string;
        config: Record<string, unknown>;
        lock_level?: "locked" | null;
      }>;
      workflows?: Array<{
        name: string;
        definition: { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] };
        lock_level?: "locked" | null;
      }>;
    },
    options?: { base?: "marketplace-base" | "base" }
  ): Promise<{
    ok: boolean;
    base: "marketplace-base" | "base";
    tablesCreated: number;
    reportsCreated: number;
    workflowsCreated: number;
    message: string;
  }> {
    return this.req("POST", "/v1/provision-schema", {
      body: { schema, base: options?.base ?? "base" },
    });
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
    /** Holmes-driven home page personalization (hero + sections). Requires sid from Holmes script. */
    homePersonalization: async (
      sessionId: string,
      storeId?: string
    ): Promise<HomePersonalizationResult> => {
      const caps = await this.capabilities();
      if (!caps.features.store) notAvailable("Store");
      return this.req(
        "GET",
        this.tenantPath("/store/home-personalization", caps.tenantSlug),
        { query: { sid: sessionId, ...(storeId && { storeId }) } }
      );
    },
    /** Always available - returns enabled: false when no store template installed */
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
    /** Holmes insights: products for a recipe (paella, curry, pasta, etc.). Uses holmes_insights.recipe_ideas search. */
    holmesRecipeProducts: async (
      recipe: string,
      limit = 12
    ): Promise<{ products: SearchHit[]; total: number; recipe: string }> => {
      const caps = await this.capabilities();
      if (!caps.features.store) notAvailable("Store");
      return this.req(
        "GET",
        this.tenantPath("/store/holmes/recipe-products", caps.tenantSlug),
        { query: { recipe, limit: String(limit) } }
      );
    },
    /** Holmes insights: products that go well with a given product. Uses holmes_insights.goes_well_with. */
    holmesGoesWith: async (
      productId: string,
      limit = 8
    ): Promise<{ products: SearchHit[]; total: number }> => {
      const caps = await this.capabilities();
      if (!caps.features.store) notAvailable("Store");
      return this.req(
        "GET",
        this.tenantPath("/store/holmes/goes-with", caps.tenantSlug),
        { query: { product_id: productId, limit: String(limit) } }
      );
    },
    /** Holmes recent recipes from cache. Returns list ordered by most recently updated. */
    holmesRecentRecipes: async (limit = 8): Promise<{ recipes: Array<{ id: string; slug: string; title: string; description: string | null }> }> => {
      const caps = await this.capabilities();
      if (!caps.features.store) notAvailable("Store");
      try {
        return await this.req(
          "GET",
          this.tenantPath("/store/holmes/recipes", caps.tenantSlug),
          { query: { limit: String(limit) } }
        );
      } catch {
        return { recipes: [] };
      }
    },
    /** Holmes cached recipe. Fetches via AI on cache miss. Returns null if not found. */
    holmesRecipe: async (slug: string): Promise<HolmesRecipe | null> => {
      const caps = await this.capabilities();
      if (!caps.features.store) notAvailable("Store");
      try {
        return await this.req<HolmesRecipe>(
          "GET",
          this.tenantPath(`/store/holmes/recipe/${encodeURIComponent(slug)}`, caps.tenantSlug)
        );
      } catch {
        return null;
      }
    },
    /** Holmes tidbits for entity (recipe, ingredient, product). */
    holmesTidbits: async (
      entity: string,
      entityType = "recipe"
    ): Promise<{ tidbits: HolmesTidbit[] }> => {
      const caps = await this.capabilities();
      if (!caps.features.store) notAvailable("Store");
      try {
        return await this.req(
          "GET",
          this.tenantPath("/store/holmes/tidbits", caps.tenantSlug),
          { query: { entity, entity_type: entityType } }
        );
      } catch {
        return { tidbits: [] };
      }
    },
    /** Holmes contextual hint - "paying attention" suggestion based on cart and mission. */
    holmesContextualHint: async (params: {
      sid?: string;
      cartNames?: string[];
      currentProduct?: string;
    }): Promise<HolmesContextualHintResult> => {
      const caps = await this.capabilities();
      if (!caps.features.store) notAvailable("Store");
      const query: QueryParams = {};
      if (params.sid) query.sid = params.sid;
      if (params.cartNames?.length) query.cart_names = params.cartNames.join(",");
      if (params.currentProduct) query.current_product = params.currentProduct;
      try {
        return await this.req(
          "GET",
          this.tenantPath("/store/holmes/contextual-hint", caps.tenantSlug),
          { query }
        );
      } catch {
        return { hint: null, products: [] };
      }
    },
    /** Holmes-driven category order for home page. Returns empty when sid missing or no suggestions. */
    categorySuggestions: async (sid: string): Promise<{ suggested: string[] }> => {
      const caps = await this.capabilities();
      if (!caps.features.store) notAvailable("Store");
      try {
        return await this.req(
          "GET",
          this.tenantPath("/store/category-suggestions", caps.tenantSlug),
          { query: { sid } }
        );
      } catch {
        return { suggested: [] };
      }
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
    /**
     * Returns the full URL for the Holmes embeddable script.
     * Use this in your storefront layout instead of hardcoding the script URL.
     * @param tenantSlug - Optional; if not provided, uses tenant from capabilities
     */
    scriptUrl: async (tenantSlug?: string): Promise<string> => {
      const slug =
        tenantSlug ?? (await this.capabilities()).tenantSlug;
      const base = this.baseUrl.replace(/\/$/, "");
      return `${base}/api/holmes/v1/script.js?site=${encodeURIComponent(slug)}`;
    },
    infer: async (sessionId: string): Promise<HolmesInferResult> => {
      const caps = await this.capabilities();
      if (!caps.features.holmes) notAvailable("Holmes");
      return this.req("GET", this.tenantPath("/holmes/infer", caps.tenantSlug), {
        query: { sid: sessionId },
      });
    },
    /** Poll unconsumed offers for a session (e.g. custom offers sent from Control Dashboard) */
    offers: async (sessionId: string): Promise<Array<{ id: string; offer_type: string; payload: unknown }>> => {
      const caps = await this.capabilities();
      if (!caps.features.holmes) notAvailable("Holmes");
      return this.req("GET", this.tenantPath("/holmes/offers", caps.tenantSlug), {
        query: { session_id: sessionId },
      });
    },
    chat: {
      /** Send a user message (storefront → Holmes) */
      send: async (sessionId: string, content: string): Promise<{ id: string; role: string; content: string; created_at: string }> => {
        const caps = await this.capabilities();
        if (!caps.features.holmes) notAvailable("Holmes");
        return this.req("POST", this.tenantPath("/holmes/chat", caps.tenantSlug), {
          body: { session_id: sessionId, content },
        });
      },
      /** List chat messages for a session */
      list: async (sessionId: string): Promise<Array<{ id: string; role: string; content: string; created_at: string }>> => {
        const caps = await this.capabilities();
        if (!caps.features.holmes) notAvailable("Holmes");
        return this.req("GET", this.tenantPath("/holmes/chat", caps.tenantSlug), {
          query: { session_id: sessionId },
        });
      },
    },
  };

  // --- Spec-driven methods (use tenant OpenAPI spec; paths like /search, /me, /events) ---

  /** Search across catalog. Uses GET /search from tenant spec. */
  search = (params?: SearchParams): Promise<SearchResult> =>
    this.request<SearchResult>("GET", "/search", { query: params as QueryParams });

  /** Current user metadata and template-defined related data (e.g. addresses). Pass userId in headers via request(). */
  me = (opts?: { userId?: string }): Promise<{ tenantId: string; user?: { id: string }; addresses?: unknown[]; [key: string]: unknown }> =>
    this.request("GET", "/me", {
      headers: opts?.userId ? { "X-User-Id": opts.userId } : undefined,
    });

  /** Raise a domain event. Uses POST /events from tenant spec. */
  events = {
    emit: (body: {
      type: string;
      entityType: string;
      entityId?: string;
      payload?: Record<string, unknown>;
      dedupeKey?: string;
    }) => this.request<{ eventId: string; type: string; entityType: string; entityId: string }>("POST", "/events", { body }),
  };

  /** Inbound webhook: POST payload to tenant. Uses POST /webhooks/inbound from tenant spec. */
  webhooks = {
    inbound: (payload: Record<string, unknown>, headers?: { source?: string; event?: string; path?: string }) =>
      this.request("POST", "/webhooks/inbound", {
        body: payload,
        headers: {
          ...(headers?.source && { "X-Webhook-Source": headers.source }),
          ...(headers?.event && { "X-Webhook-Event": headers.event }),
          ...(headers?.path && { "X-Webhook-Path": headers.path }),
        },
      }),
  };

  /**
   * Auth for app users (storefront customers). Sign in/up require API key; session/signout use Bearer only.
   * List users is for tenant admins (API key). Not for studio users (members/vendors).
   */
  auth = {
    /** Sign in app user (storefront). Returns session with access_token; use as Bearer for session/me. */
    signin: (params: AuthSignInParams): Promise<AuthSessionResponse> =>
      this.request<AuthSessionResponse>("POST", "/auth/signin", { body: params }),

    /** Sign up app user (storefront). Returns session, or user + message when email confirmation is required. */
    signup: (params: AuthSignUpParams): Promise<AuthSignUpResponse> =>
      this.request<AuthSignUpResponse>("POST", "/auth/signup", { body: params }),

    /** Validate Bearer token and return current app user. No API key; use access_token from signin/signup. */
    session: (accessToken: string): Promise<AuthSessionUser> =>
      this.requestWithBearer<AuthSessionUser>("GET", "/auth/session", accessToken),

    /** Sign out app user. Client should discard stored tokens after calling. */
    signout: (accessToken: string): Promise<{ success: boolean }> =>
      this.requestWithBearer<{ success: boolean }>("POST", "/auth/signout", accessToken),

    /** List app users (storefront customers) for this tenant. Requires API key. Paginated. */
    users: (opts?: { limit?: number; offset?: number }): Promise<AuthUsersResponse> =>
      this.request<AuthUsersResponse>("GET", "/auth/users", { query: opts as QueryParams }),
  };
}
