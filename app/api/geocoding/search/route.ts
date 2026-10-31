import { featureContext } from "@/features/generic-modules/server/feature-records";

type Provider = "tomtom" | "geoapify" | "nominatim";
type SearchResult = { displayName: string; latitude: number; longitude: number; type: string; provider: Provider };
type TomTomResult = { title?: string; subtitles?: string[]; type?: string; position?: { coordinates?: [number, number] } };
type TomTomResponse = { results?: TomTomResult[] };
type NominatimResult = { display_name?: string; lat?: string; lon?: string; type?: string };
type GeoapifyFeature = {
  properties?: { formatted?: string; name?: string; lat?: number; lon?: number; result_type?: string; rank?: { confidence?: number } };
  geometry?: { coordinates?: [number, number] };
};
type GeoapifyResponse = { features?: GeoapifyFeature[] };

let geocodingQueue = Promise.resolve();
let nextRequestAt = 0;

function scheduleNominatim<T>(task: () => Promise<T>) {
  const run = geocodingQueue.then(async () => {
    const waitMilliseconds = Math.max(0, nextRequestAt - Date.now());
    if (waitMilliseconds > 0) await new Promise((resolve) => setTimeout(resolve, waitMilliseconds));
    nextRequestAt = Date.now() + 1_000;
    return task();
  });
  geocodingQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function fetchNominatim(url: URL) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await scheduleNominatim(() => fetch(url, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "id,en;q=0.8",
          "User-Agent": process.env.GEOCODING_USER_AGENT ?? "TepatWaktu/0.1",
        },
        next: { revalidate: 86_400 },
        signal: AbortSignal.timeout(15_000),
      }));
      if (response.ok || (response.status !== 429 && response.status < 500)) return response;
      lastError = new Error(`Nominatim returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Nominatim request failed");
}

function mapCenter(searchParams: URLSearchParams) {
  if (!searchParams.has("lat") || !searchParams.has("lon")) return null;
  const latitude = Number(searchParams.get("lat"));
  const longitude = Number(searchParams.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude, inIndonesia: latitude >= -11 && latitude <= 6 && longitude >= 95 && longitude <= 141 };
}

async function searchTomTom(query: string, key: string, center: ReturnType<typeof mapCenter>, inIndonesia: boolean): Promise<SearchResult[]> {
  const point = center ? { type: "point", coordinates: [center.longitude, center.latitude] } : undefined;
  const response = await fetch("https://api.tomtom.com/maps/orbis/places/discover", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      "Content-Type": "application/json",
      "TomTom-Api-Key": key,
      "TomTom-Api-Version": "3",
      Attributes: "results(title,subtitles,position,type)",
    },
    body: JSON.stringify({
      query,
      maxResults: 6,
      filters: {
        types: ["poi", "address", "street", "area"],
        ...(inIndonesia ? { countryCodesIso2: ["ID"] } : {}),
      },
      ...(point ? { preferences: { geometry: point } } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`TomTom returned ${response.status}`);
  const data = await response.json() as TomTomResponse;
  return (data.results ?? []).flatMap((item) => {
    const latitude = item.position?.coordinates?.[1];
    const longitude = item.position?.coordinates?.[0];
    if (!item.title || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const subtitle = item.subtitles?.filter(Boolean).join(", ");
    return [{
      displayName: subtitle ? `${item.title}, ${subtitle}` : item.title,
      latitude: latitude as number,
      longitude: longitude as number,
      type: item.type ?? "location",
      provider: "tomtom" as const,
    }];
  });
}

async function searchGeoapify(query: string, key: string, center: ReturnType<typeof mapCenter>, inIndonesia: boolean): Promise<SearchResult[]> {
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", query);
  url.searchParams.set("format", "geojson");
  url.searchParams.set("lang", "id");
  url.searchParams.set("limit", "10");
  url.searchParams.set("apiKey", key);
  if (center) {
    url.searchParams.set("bias", `proximity:${center.longitude},${center.latitude}`);
  }
  if (inIndonesia) url.searchParams.set("filter", "countrycode:id");

  const response = await fetch(url, {
    headers: { Accept: "application/geo+json, application/json" },
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Geoapify returned ${response.status}`);
  const data = await response.json() as GeoapifyResponse;
  return (data.features ?? []).flatMap((feature) => {
    if (feature.properties?.rank?.confidence === 0) return [];
    const latitude = feature.properties?.lat ?? feature.geometry?.coordinates?.[1];
    const longitude = feature.properties?.lon ?? feature.geometry?.coordinates?.[0];
    const formatted = feature.properties?.formatted;
    const name = feature.properties?.name;
    const displayName = name && formatted && !formatted.toLowerCase().includes(name.toLowerCase()) ? `${name}, ${formatted}` : formatted ?? name;
    if (!displayName || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [{ displayName, latitude: latitude as number, longitude: longitude as number, type: feature.properties?.result_type ?? "location", provider: "geoapify" as const }];
  }).slice(0, 6);
}

async function searchNominatim(query: string, inIndonesia: boolean): Promise<SearchResult[]> {
  const baseUrl = process.env.GEOCODING_BASE_URL ?? "https://nominatim.openstreetmap.org";
  const url = new URL("search", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  if (inIndonesia) url.searchParams.set("countrycodes", "id");

  const response = await fetchNominatim(url);
  if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
  const data = await response.json() as NominatimResult[];
  return data.flatMap((item) => {
    const latitude = Number(item.lat);
    const longitude = Number(item.lon);
    if (!item.display_name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [{ displayName: item.display_name, latitude, longitude, type: item.type ?? "location", provider: "nominatim" as const }];
  });
}

function mergeResults(groups: SearchResult[][]) {
  const results: SearchResult[] = [];
  for (const result of groups.flat()) {
    const name = result.displayName.split(",")[0].toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const duplicate = results.some((existing) =>
      existing.displayName.split(",")[0].toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === name
      && Math.abs(existing.latitude - result.latitude) < 0.0001
      && Math.abs(existing.longitude - result.longitude) < 0.0001);
    if (!duplicate) results.push(result);
  }
  return results;
}

export async function GET(request: Request) {
  const context = await featureContext(request, "master/lokasi-presensi", "read");
  if ("error" in context) return context.error;

  const searchParams = new URL(request.url).searchParams;
  const query = searchParams.get("q")?.trim() ?? "";
  if (query.length < 3 || query.length > 160) {
    return Response.json({ error: "Masukkan nama tempat atau alamat antara 3 sampai 160 karakter." }, { status: 400 });
  }

  const center = mapCenter(searchParams);
  const inIndonesia = center?.inIndonesia ?? searchParams.get("country") === "id";
  const tomtomKey = process.env.TOMTOM_API_KEY?.trim();
  const geoapifyKey = process.env.GEOAPIFY_API_KEY?.trim();
  const searches: Array<{ provider: Provider; promise: Promise<SearchResult[]> }> = [];
  if (tomtomKey) searches.push({ provider: "tomtom", promise: searchTomTom(query, tomtomKey, center, inIndonesia) });
  if (geoapifyKey) searches.push({ provider: "geoapify", promise: searchGeoapify(query, geoapifyKey, center, inIndonesia) });
  searches.push({ provider: "nominatim", promise: searchNominatim(query, inIndonesia) });
  const settled = await Promise.allSettled(searches.map(({ promise }) => promise));
  const available: Provider[] = [];
  const groups: SearchResult[][] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      available.push(searches[index].provider);
      groups.push(result.value);
    } else {
      console.error(`${searches[index].provider} search failed:`, result.reason instanceof Error ? result.reason.message : "Unknown upstream error");
    }
  });

  if (!available.length) {
    return Response.json({ error: "Layanan pencarian lokasi sedang tidak tersedia. Pilih titik pada peta atau isi koordinat manual." }, { status: 502 });
  }
  return Response.json({ results: mergeResults(groups), providers: available });
}
