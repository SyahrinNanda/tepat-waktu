"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { LocateFixed, MapPin, Search, X } from "lucide-react";

export function LocationModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="location-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="location-modal" role="dialog" aria-modal="true" aria-label={title}>
      <header><h2>{title}</h2><button type="button" aria-label="Tutup" onClick={onClose}><X size={18}/></button></header>
      {children}
    </section>
  </div>;
}

type GeocodingProvider = "tomtom" | "geoapify" | "nominatim";
type GeocodingResult = { displayName: string; latitude: number; longitude: number; type?: string; provider: GeocodingProvider };
const providerName = (provider: GeocodingProvider) => provider === "tomtom" ? "TomTom" : provider === "geoapify" ? "Geoapify" : "OpenStreetMap";

type CoordinateMapProps = {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
  searchEnabled?: boolean;
  searchBiasEnabled?: boolean;
  onAddressSelect?: (address: string) => void;
};

const validCoordinate = (latitude: number, longitude: number) => Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
const rounded = (value: number) => Number(value.toFixed(7));

export function CoordinateMap({ latitude, longitude, onChange, searchEnabled = false, searchBiasEnabled = false, onAddressSelect }: CoordinateMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchProviders, setSearchProviders] = useState<GeocodingProvider[]>([]);
  const [locationError, setLocationError] = useState("");
  const [latitudeDraft, setLatitudeDraft] = useState(String(latitude));
  const [longitudeDraft, setLongitudeDraft] = useState(String(longitude));
  const editingAxis = useRef<"latitude" | "longitude" | null>(null);
  const hasSearchBias = useRef(searchBiasEnabled);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    let initializedMap: LeafletMap | null = null;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      const center: [number, number] = validCoordinate(latitude, longitude) ? [latitude, longitude] : [-7.7956, 110.3695];
      const map = L.map(containerRef.current, { center, zoom: 16, zoomControl: true });
      initializedMap = map;
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const icon = L.divIcon({ className: "coordinate-marker", html: "<span></span>", iconSize: [24, 24], iconAnchor: [12, 12] });
      const marker = L.marker(center, { draggable: true, icon, title: "Geser untuk mengubah titik lokasi" }).addTo(map);
      markerRef.current = marker;
      map.on("click", (event) => { hasSearchBias.current = true; onChangeRef.current(rounded(event.latlng.lat), rounded(event.latlng.lng)); });
      marker.on("dragend", () => {
        const point = marker.getLatLng();
        hasSearchBias.current = true;
        onChangeRef.current(rounded(point.lat), rounded(point.lng));
      });
      window.setTimeout(() => map.invalidateSize({ pan: false }), 0);
    });

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current = null;
      initializedMap?.remove();
    };
    // Peta cukup dibuat sekali selama modal terbuka; koordinat berikutnya disinkronkan oleh efek di bawah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!validCoordinate(latitude, longitude)) return;
    if (editingAxis.current !== "latitude") setLatitudeDraft(String(latitude));
    if (editingAxis.current !== "longitude") setLongitudeDraft(String(longitude));
    markerRef.current?.setLatLng([latitude, longitude]);
    const map = mapRef.current;
    if (map) map.panTo([latitude, longitude], { animate: true, duration: .35 });
  }, [latitude, longitude]);

  function useCurrentLocation() {
    setLocationError("");
    if (!navigator.geolocation) return setLocationError("Perangkat ini tidak mendukung geolokasi.");
    navigator.geolocation.getCurrentPosition((position) => {
      const nextLatitude = rounded(position.coords.latitude), nextLongitude = rounded(position.coords.longitude);
      hasSearchBias.current = true;
      mapRef.current?.setView([nextLatitude, nextLongitude], 18, { animate: true });
      onChange(nextLatitude, nextLongitude);
      if (position.coords.accuracy > 25) setLocationError(`Akurasi lokasi perangkat ±${Math.round(position.coords.accuracy)} m. Periksa dan sesuaikan pin sebelum menyimpan.`);
    }, () => setLocationError("Lokasi saat ini tidak dapat dibaca. Periksa izin lokasi browser."), { enableHighAccuracy: true, timeout: 10000 });
  }

  async function searchLocation() {
    const term = query.trim();
    if (term.length < 3) return setSearchError("Masukkan minimal 3 karakter.");
    setSearching(true); setSearchError(""); setResults([]); setSearchProviders([]);
    try {
      const center = mapRef.current?.getCenter();
      const searchParams = new URLSearchParams({ q: term });
      searchParams.set("country", "id");
      if (center && hasSearchBias.current) {
        searchParams.set("lat", String(rounded(center.lat)));
        searchParams.set("lon", String(rounded(center.lng)));
      }
      const response = await fetch(`/api/geocoding/search?${searchParams}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Pencarian lokasi gagal.");
      setResults(payload.results ?? []);
      setSearchProviders(payload.providers ?? []);
      if (!payload.results?.length) setSearchError("Lokasi tidak ditemukan. Coba nama unik tanpa awalan PT, atau pilih titik pada peta.");
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Pencarian lokasi gagal.");
    } finally { setSearching(false); }
  }

  function selectResult(result: GeocodingResult) {
    setQuery(result.displayName);
    setResults([]);
    hasSearchBias.current = true;
    mapRef.current?.setView([result.latitude, result.longitude], 18, { animate: true });
    onChange(result.latitude, result.longitude);
    onAddressSelect?.(result.displayName);
  }

  function updateManual(axis: "latitude" | "longitude", rawValue: string) {
    editingAxis.current = axis;
    if (axis === "latitude") setLatitudeDraft(rawValue);
    else setLongitudeDraft(rawValue);
    if (!rawValue.trim()) return;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    const nextLatitude = axis === "latitude" ? value : latitude;
    const nextLongitude = axis === "longitude" ? value : longitude;
    if (validCoordinate(nextLatitude, nextLongitude)) { hasSearchBias.current = true; onChange(nextLatitude, nextLongitude); }
  }

  return <>
    <div className="location-map">
      <div ref={containerRef} className="location-map-canvas" aria-label="Peta interaktif lokasi"/>
      {searchEnabled && <div className="location-map-search-wrap">
        <div className="location-map-search" role="search">
          <Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); void searchLocation(); } }} placeholder="Cari nama tempat atau alamat..." aria-label="Cari lokasi"/><button type="button" onClick={() => void searchLocation()} disabled={searching}>{searching ? "Mencari..." : "Cari"}</button>
        </div>
        {results.length > 0 && <div className="location-search-results">{results.map((result, index) => <button type="button" key={`${result.latitude}-${result.longitude}-${index}`} onClick={() => selectResult(result)}><MapPin size={15}/><span>{result.displayName}<small>{providerName(result.provider)}</small></span></button>)}</div>}
        {searchProviders.length > 0 && !searchError && <div className="location-search-source">Sumber: {searchProviders.map(providerName).join(" + ")}</div>}
        {searchError && <div className="location-search-error">{searchError}</div>}
      </div>}
      <div className="location-map-hint"><MapPin size={14}/> Klik peta atau geser pin untuk memilih titik</div>
      <button className="location-current-button" type="button" onClick={useCurrentLocation}><LocateFixed size={16}/> Gunakan lokasi saya</button>
    </div>
    {locationError && <div className="location-coordinate-error">{locationError}</div>}
    <div className="coordinate-fields">
      <label><span>Latitude</span><input aria-label="Latitude" inputMode="decimal" type="number" min="-90" max="90" step="any" value={latitudeDraft} onChange={(event) => updateManual("latitude", event.target.value)} onBlur={() => { editingAxis.current = null; setLatitudeDraft(String(latitude)); }} required/></label>
      <label><span>Longitude</span><input aria-label="Longitude" inputMode="decimal" type="number" min="-180" max="180" step="any" value={longitudeDraft} onChange={(event) => updateManual("longitude", event.target.value)} onBlur={() => { editingAxis.current = null; setLongitudeDraft(String(longitude)); }} required/></label>
    </div>
  </>;
}
