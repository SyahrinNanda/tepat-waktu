/**
 * Turns a `data:` URL (e.g. from canvas.toDataURL) into a File without `fetch(dataUrl)`:
 * the Content-Security-Policy limits fetch to this site, so fetching a data: URL fails.
 */
export function dataUrlToFile(dataUrl: string, name: string) {
  const [header, payload = ""] = dataUrl.split(",", 2);
  const type = /^data:([^;,]+)/.exec(header)?.[1] ?? "application/octet-stream";
  const binary = header.includes(";base64") ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], name, { type });
}
