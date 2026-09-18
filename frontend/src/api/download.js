import client from "./client";

/**
 * Download a file from an authenticated API route.
 *
 * The request goes through the normal API client, so it carries the session
 * token and is authorised by the server like any other call. The file name
 * comes from the server's Content-Disposition header.
 */
export async function downloadFile(url, params = {}, fallbackName = "download") {
  const res = await client.get(url, { params, responseType: "blob" });
  const disposition = res.headers["content-disposition"] || "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = match ? match[1] : fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1500);
}

/** Error responses to blob requests arrive as a Blob; read the JSON message. */
export async function downloadError(err, fallback = "Could not download the file.") {
  try {
    const data = err?.response?.data;
    if (data instanceof Blob) {
      const parsed = JSON.parse(await data.text());
      return parsed.error || fallback;
    }
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}
