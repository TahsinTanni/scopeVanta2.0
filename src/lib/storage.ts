import { put, del, get } from "@vercel/blob";

// Vercel Blob storage, split across two stores because Vercel sets public vs
// private per STORE, not per file:
//
// - "public" (BLOB_READ_WRITE_TOKEN): logos only. They appear on buyer-facing
//   share pages and PDFs, so they must load without a login.
// - "private" (BLOB_PRIVATE_READ_WRITE_TOKEN): knowledge documents, which can
//   hold a customer's pricing and client material. Private blob URLs require
//   the store token to read, so a leaked URL exposes nothing. The server reads
//   them only after the route has checked the caller's workspace.
//
// Storing a document with no private store configured is refused rather than
// silently falling back to public storage.

export type StorageVisibility = "public" | "private";

function privateToken(): string {
  const token = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_PRIVATE_READ_WRITE_TOKEN is not configured, so documents can't be stored privately.");
  return token;
}

/** Private blob URLs look like https://<store-id>.private.blob.vercel-storage.com/<pathname>. */
function isPrivateUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".private.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function storageWrite(path: string, base64Content: string, contentType: string, visibility: StorageVisibility): Promise<string> {
  const buffer = Buffer.from(base64Content, "base64");
  const blob =
    visibility === "private"
      ? await put(path, buffer, { access: "private", contentType, addRandomSuffix: true, token: privateToken() })
      : await put(path, buffer, { access: "public", contentType, addRandomSuffix: true });
  return blob.url;
}

export async function storageRead(url: string): Promise<{ content: string; contentType: string } | null> {
  try {
    if (isPrivateUrl(url)) {
      const result = await get(url, { access: "private", token: privateToken() });
      if (result?.statusCode !== 200) return null;
      const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
      return { content: buffer.toString("base64"), contentType: result.blob.contentType };
    }
    // Public blobs (logos, and documents uploaded before private storage).
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return { content: buffer.toString("base64"), contentType: response.headers.get("content-type") || "application/octet-stream" };
  } catch {
    return null;
  }
}

export async function storageDelete(url: string): Promise<boolean> {
  try {
    await del(url, isPrivateUrl(url) ? { token: privateToken() } : undefined);
    return true;
  } catch {
    return false;
  }
}
