import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Fetching a URL a customer typed in (their company website) from our server
// is a server-side request forgery risk: without checks it could reach
// localhost, the private network, or cloud metadata endpoints, and the text
// would flow into an AI prompt and back out in a proposal. This helper only
// talks to public internet addresses.
//
// Limitation: the hostname is resolved here and again by fetch(), so a DNS
// record that changes between the two (DNS rebinding) isn't fully covered.
// Redirects are re-checked hop by hop, which closes the common bypass.

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || // "this" network
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata 169.254.169.254
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 192 && b === 0) || // IETF protocol assignments
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast and reserved
  );
}

function ipv6Private(ip: string): boolean {
  const v = ip.toLowerCase();
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Private(mapped[1]);
  return (
    v === "::" ||
    v === "::1" ||
    v.startsWith("fc") || // unique local fc00::/7
    v.startsWith("fd") ||
    /^fe[89ab]/.test(v) || // link-local fe80::/10
    v.startsWith("ff") || // multicast
    v.startsWith("64:ff9b:") || // NAT64
    v.startsWith("2001:db8:") // documentation
  );
}

function isPrivateAddress(ip: string): boolean {
  return isIP(ip) === 4 ? ipv4Private(ip) : ipv6Private(ip);
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http(s) URLs are allowed");
  if (url.username || url.password) throw new Error("URLs with credentials are not allowed");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Only standard ports are allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error("URL resolves to a non-public address");
  return url;
}

/**
 * GETs a public web page as text: public addresses only (every redirect hop
 * re-checked), at most `maxRedirects` redirects, HTML/text responses only,
 * and the body cut off at `maxBytes`.
 */
export async function safeFetchText(
  raw: string,
  opts: { maxBytes?: number; maxRedirects?: number; timeoutMs?: number; userAgent?: string } = {},
): Promise<{ status: number; text: string }> {
  const { maxBytes = 2_000_000, maxRedirects = 3, timeoutMs = 10_000, userAgent } = opts;
  const signal = AbortSignal.timeout(timeoutMs);
  let current = raw;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertPublicUrl(current);
    const response = await fetch(url, { redirect: "manual", signal, headers: userAgent ? { "User-Agent": userAgent } : undefined });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) return { status: response.status, text: "" };
      current = new URL(location, url).toString();
      continue;
    }
    if (response.status >= 400) {
      await response.body?.cancel();
      return { status: response.status, text: "" };
    }

    const type = (response.headers.get("content-type") || "").toLowerCase();
    if (type && !type.startsWith("text/") && !type.includes("html") && !type.includes("xml")) {
      await response.body?.cancel();
      return { status: 415, text: "" };
    }

    // Read at most maxBytes, then stop downloading.
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
      if (size >= maxBytes) {
        await reader.cancel();
        break;
      }
    }
    return { status: response.status, text: new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes)) };
  }
  return { status: 508, text: "" }; // too many redirects
}
