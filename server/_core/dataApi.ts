/**
 * Quick example (matches curl usage):
 *   await callDataApi("Youtube/search", {
 *     query: { gl: "US", hl: "en", q: "chainshield" },
 *   })
 */
import { ENV } from "./env";

export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
};

/**
 * Call the built-in Data API (search, weather, etc.)
 * Available endpoints depend on the project configuration.
 */
export async function callDataApi(
  endpoint: string,
  options: DataApiCallOptions = {}
): Promise<unknown> {
  const dataApiUrl = ENV.dataApiUrl;
  const dataApiKey = ENV.dataApiKey;

  if (!dataApiUrl || !dataApiKey) {
    throw new Error(
      "Data API not configured: set DATA_API_URL and DATA_API_KEY"
    );
  }

  const url = new URL(endpoint, dataApiUrl.replace(/\/+$/, "") + "/");

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const isGet = !options.body;
  const response = await fetch(url.toString(), {
    method: isGet ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${dataApiKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Data API error (${response.status}): ${text}`);
  }

  return response.json();
}
