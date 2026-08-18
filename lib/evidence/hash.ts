import { createHash } from "node:crypto";

export function normalizeSource(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
}

export function contentHash(content: string): string {
  return createHash("sha256").update(normalizeSource(content)).digest("hex");
}
