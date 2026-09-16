import { put, del } from "@vercel/blob";

// Replaces AppDeploy's `storage.write/read/delete/url` with Vercel Blob.
// Blobs are uploaded with an unguessable, workspace-prefixed pathname, but
// access control is enforced at the application layer, not by Blob ACLs:
// the raw blob URL is never handed to the browser directly. Every file read
// goes through an authenticated route (e.g. GET /api/files/:id) which
// checks workspace membership first, then fetches the blob server-side.
// This matches CLAUDE.md's migration-target "private object storage"
// requirement regardless of the exact access-control primitives a given
// Vercel Blob SDK version exposes.

export async function storageWrite(path: string, base64Content: string, contentType: string): Promise<string> {
  const buffer = Buffer.from(base64Content, "base64");
  const blob = await put(path, buffer, { access: "public", contentType, addRandomSuffix: false });
  return blob.url;
}

export async function storageRead(url: string): Promise<{ content: string; contentType: string } | null> {
  try {
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
    await del(url);
    return true;
  } catch {
    return false;
  }
}
