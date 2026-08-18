import { z } from "zod";

export class ExternalServiceError extends Error {
  constructor(
    public readonly service: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ExternalServiceError";
  }
}

export async function fetchJson<T>(options: {
  service: string;
  url: string;
  schema: z.ZodType<T>;
  headers?: HeadersInit;
  timeoutMs?: number;
  notFoundAsNull?: boolean;
}): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);

  try {
    const response = await fetch(options.url, {
      headers: options.headers,
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 404 && options.notFoundAsNull) return null;
    if (!response.ok) {
      throw new ExternalServiceError(
        options.service,
        `${options.service} returned HTTP ${response.status}`,
        response.status,
      );
    }
    const parsed = options.schema.safeParse(await response.json());
    if (!parsed.success) {
      throw new ExternalServiceError(
        options.service,
        `${options.service} returned an invalid response`,
      );
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
    const message = error instanceof Error ? error.message : "Unknown network failure";
    throw new ExternalServiceError(options.service, `${options.service} request failed: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}
