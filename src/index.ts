/**
 * Aurora Studio SDK - Fluent API for custom front-ends and storefronts.
 * Use with X-Api-Key authentication.
 */

export interface AuroraClientOptions {
  baseUrl: string;
  apiKey: string;
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

export class AuroraClient {
  private baseUrl: string;
  private apiKey: string;

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
  };
}
