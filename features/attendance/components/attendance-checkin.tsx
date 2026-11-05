"use client";
/* eslint-disable @next/next/no-img-element -- camera previews are ephemeral data URLs */

import { Camera, Check, Clock3, LoaderCircle, LocateFixed, RefreshCw, ShieldCheck, X } from "lucide-react";
import { resolveTimeZone } from "@/lib/timezone";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "ready" | "camera" | "preview" | "success";
type AttendanceAction = "check_in" | "check_out";
type DayStatus = "missing-checkin" | "missing-checkout" | "complete";
type StatusResponse = {
  employee: { id: string; name: string };
  company: { id: string; name: string; timezone: string };
  schedule: { name: string; startTime: string; endTime: string; graceMinutes: number };
  attendance: { id: string; checkIn: string | null; checkOut: string | null; status: string } | null;
  nextAction: AttendanceAction | null;
  serverTime: string;
  /** Set when the company IP whitelist does not include this network. */
  networkError?: string | null;
};

export function AttendanceCheckin() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [action, setAction] = useState<AttendanceAction>("check_in");
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [location, setLocation] = useState("Mendeteksi lokasi saat kamera dibuka");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number; accuracyMeters: number } | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/attendance/me", { cache: "no-store" });
      const body = await response.json() as StatusResponse & { message?: string };
      if (!response.ok) throw new Error(body.message || "Status presensi belum dapat dimuat.");
      setStatus(body);
      const localStatus: DayStatus = !body.attendance?.checkIn ? "missing-checkin" : !body.attendance.checkOut ? "missing-checkout" : "complete";
      window.localStorage.setItem("tepatwaktu-attendance-state", localStatus);
      window.dispatchEvent(new Event("tepatwaktu:attendance-updated"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Status presensi belum dapat dimuat.");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadStatus(), 0);
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      stopCamera();
    };
  }, [loadStatus, stopCamera]);

  useEffect(() => {
    if (phase !== "camera" || cameraStarting) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    let cancelled = false;
    let previewReady = false;
    const markReady = () => {
      if (cancelled || previewReady) return;
      previewReady = true;
      setCameraReady(true);
      setCameraFailed(false);
      setError("");
    };
    const startPreview = async () => {
      try {
        if (video.srcObject !== stream) video.srcObject = stream;
        video.muted = true;
        await video.play();
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) markReady();
      } catch (cause) {
        if (!cancelled && cause instanceof DOMException && cause.name === "NotAllowedError") {
          setCameraFailed(true);
          setError("Pemutaran kamera diblokir browser. Izinkan kamera dan pemutaran media, lalu coba lagi.");
        }
      }
    };
    const handleMediaReady = () => {
      markReady();
      void startPreview();
    };
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", startPreview);
    video.addEventListener("loadeddata", handleMediaReady);
    video.addEventListener("canplay", handleMediaReady);
    video.addEventListener("playing", markReady);
    void startPreview();
    const previewTimeout = window.setTimeout(() => {
      if (cancelled || previewReady) return;
      setCameraReady(false);
      setCameraFailed(true);
      setError("Kamera terdeteksi tetapi pratinjau belum berjalan. Tutup aplikasi lain yang memakai kamera, periksa izin browser, lalu coba lagi.");
    }, 12000);

    return () => {
      cancelled = true;
      window.clearTimeout(previewTimeout);
      video.removeEventListener("loadedmetadata", startPreview);
      video.removeEventListener("loadeddata", handleMediaReady);
      video.removeEventListener("canplay", handleMediaReady);
      video.removeEventListener("playing", markReady);
    };
  }, [cameraStarting, phase]);

  const openCamera = useCallback(async (nextAction: AttendanceAction) => {
    if (status?.networkError) { setError(status.networkError); return; }
    setError("");
    setPhoto("");
    setAction(nextAction);
    setCoordinates(null);
    setCameraReady(false);
    setCameraFailed(false);
    setCameraStarting(true);
    setLocation("Mendeteksi lokasi perangkat");
    stopCamera();
    setPhase("camera");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStarting(false);
      setCameraFailed(true);
      setError(window.isSecureContext
        ? "Browser ini tidak mendukung akses kamera. Gunakan Chrome, Edge, atau Safari versi terbaru."
        : "Kamera hanya dapat digunakan melalui HTTPS atau localhost. Buka aplikasi dari alamat yang aman.");
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await requestCameraStream({
          audio: false,
          video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "OverconstrainedError") {
          stream = await requestCameraStream({ audio: false, video: true });
        } else {
          throw cause;
        }
      }
      streamRef.current = stream;
      setCameraStarting(false);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const next = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy };
            setCoordinates(next);
            setLocation(`Lokasi terdeteksi · akurasi ±${Math.round(next.accuracyMeters)} m`);
          },
          () => setLocation("Lokasi belum diizinkan · kebijakan perusahaan dapat mewajibkannya"),
          { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 },
        );
      }
    } catch (cause) {
      setCameraStarting(false);
      setCameraReady(false);
      setCameraFailed(true);
      setError(cameraErrorMessage(cause));
    }
  }, [status, stopCamera]);

  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    const requestedAction = new URLSearchParams(window.location.search).get("camera");
    if (requestedAction !== "check_in" && requestedAction !== "check_out") return;
    autoOpenedRef.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    const timer = window.setTimeout(() => void openCamera(requestedAction), 0);
    return () => window.clearTimeout(timer);
  }, [openCamera]);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("Kamera masih menyiapkan gambar. Tunggu sebentar lalu coba lagi.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.86));
    stopCamera();
    setPhase("preview");
  }

  async function confirmAttendance() {
    if (!photo) return;
    setSubmitting(true);
    setError("");
    try {
      const photoBlob = await (await fetch(photo)).blob();
      const form = new FormData();
      form.set("action", action);
      form.set("clientCapturedAt", new Date().toISOString());
      form.set("photo", new File([photoBlob], `${action}-${Date.now()}.jpg`, { type: "image/jpeg" }));
      if (coordinates) {
        form.set("latitude", String(coordinates.latitude));
        form.set("longitude", String(coordinates.longitude));
        form.set("accuracyMeters", String(coordinates.accuracyMeters));
      }
      const response = await fetch("/api/attendance/me", { method: "POST", body: form });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message || "Presensi belum dapat disimpan.");
      await loadStatus();
      setPhase("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Presensi belum dapat disimpan.");
    } finally {
      setSubmitting(false);
    }
  }

  function closeCamera() {
    stopCamera();
    setCameraReady(false);
    setCameraStarting(false);
    setCameraFailed(false);
    setError("");
    setPhase("ready");
    setPhoto("");
  }

  const timezone = resolveTimeZone(status?.company.timezone);
  const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: timezone }).format(now);
  const date = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: timezone }).format(now);
  const dayStatus: DayStatus = !status?.attendance?.checkIn ? "missing-checkin" : !status.attendance.checkOut ? "missing-checkout" : "complete";
  const nextAction = status?.nextAction ?? (dayStatus === "missing-checkin" ? "check_in" : "check_out");
  const actionLabel = (value: AttendanceAction) => value === "check_in" ? "Check-in" : "Check-out";
  const shortTime = (value: string | null | undefined) => value?.slice(0, 5) ?? null;

  return (
    <div className="attendance-self-page">
      <header className="product-page-header"><span className="breadcrumb">Beranda / Presensi / Check-in & Check-out</span><div><h1>Presensi Saya</h1><p>Ambil foto langsung dari kamera untuk mencatat waktu kehadiran.</p></div></header>

      <div className="attendance-self-grid">
        <section className="module-card attendance-clock-card">
          <span className="eyebrow">WAKTU PERUSAHAAN · {timezone}</span><strong className="live-clock">{time}</strong><p>{date}</p>
          <div className="shift-summary"><span>{status?.schedule.name ?? "Jadwal Perusahaan"}</span><strong>{shortTime(status?.schedule.startTime) ?? "08:00"} — {shortTime(status?.schedule.endTime) ?? "17:00"}</strong><small>Toleransi keterlambatan {status?.schedule.graceMinutes ?? 15} menit</small></div>
          {!loadingStatus && dayStatus !== "complete" ? <button className="attendance-main-action" onClick={() => openCamera(nextAction)}><span><Camera size={29} /></span><strong>Ambil Foto & {actionLabel(nextAction)}</strong><small>Foto hanya dapat diambil langsung dari kamera</small></button> : dayStatus === "complete" ? <div className="attendance-complete-state"><Check size={28} /><strong>Semua presensi selesai</strong><small>Tidak ada tindakan lain yang diperlukan hari ini.</small></div> : <div className="attendance-complete-state"><LoaderCircle className="spin" size={28} /><strong>Memuat status presensi</strong></div>}
          {error ? <div className="camera-error" role="alert">{error}<button onClick={() => void loadStatus()}><RefreshCw size={14} /> Muat ulang</button></div> : null}
        </section>

        <aside className="module-card attendance-status-card">
          <div className="detail-section-head"><div><ShieldCheck size={18} /><h2>Status Hari Ini</h2></div><span>{status?.attendance?.status?.toUpperCase() ?? "BELUM TERCATAT"}</span></div>
          <ol className="attendance-dayline">
            <li className={dayStatus === "missing-checkin" ? "pending" : "done"}><i /><span><small>CHECK-IN</small><strong>{status?.attendance?.checkIn ? `Tercatat ${shortTime(status.attendance.checkIn)}` : "Belum tercatat"}</strong><em>Jadwal {shortTime(status?.schedule.startTime) ?? "08:00"}</em></span></li>
            <li className={dayStatus === "missing-checkout" ? "pending" : dayStatus === "complete" ? "done" : ""}><i /><span><small>CHECK-OUT</small><strong>{status?.attendance?.checkOut ? `Tercatat ${shortTime(status.attendance.checkOut)}` : dayStatus === "missing-checkout" ? "Belum tercatat" : "Menunggu check-in"}</strong><em>Jadwal {shortTime(status?.schedule.endTime) ?? "17:00"}</em></span></li>
          </ol>
          <div className="attendance-security-note"><ShieldCheck size={18} /><span><strong>Foto tersimpan privat</strong><small>Tidak ada unggah galeri. Foto dan metadata disimpan ke object storage privat setelah server memvalidasi sesi dan role.</small></span></div>
        </aside>
      </div>

      {phase !== "ready" ? <div className="camera-backdrop" role="dialog" aria-modal="true" aria-label="Ambil foto presensi"><section className="camera-dialog">
        <header><div><span className="eyebrow">{actionLabel(action).toUpperCase()}</span><h2>{phase === "success" ? "Presensi berhasil dicatat" : "Foto langsung dari kamera"}</h2></div><button onClick={closeCamera} aria-label="Tutup"><X size={20} /></button></header>
        {phase === "camera" ? <div className="camera-viewport"><video ref={videoRef} autoPlay playsInline muted /><span className="face-guide" /><span className="live-badge">● LIVE</span>{!cameraReady ? <div className="camera-loading"><LoaderCircle className="spin" size={28} /><strong>{cameraStarting ? "Meminta akses kamera…" : "Menyiapkan pratinjau…"}</strong><small>Pastikan izin kamera pada browser sudah aktif.</small></div> : null}</div> : null}
        {phase === "preview" ? <div className="camera-viewport preview"><img src={photo} alt="Pratinjau foto presensi yang baru diambil" /></div> : null}
        {phase === "success" ? <div className="attendance-success"><span><Check size={34} /></span><h3>{actionLabel(action)} tercatat</h3><p>{time} · {status?.company.name}</p><small>Foto dan metadata telah disimpan dengan aman.</small></div> : null}
        {phase !== "success" ? <div className="camera-meta"><span><Clock3 size={15} /> {time}</span><span><LocateFixed size={15} /> {location}</span></div> : null}
        {error && phase !== "success" ? <div className="camera-error dialog-error" role="alert">{error}</div> : null}
        <footer>{phase === "camera" ? cameraFailed ? <button className="btn btn-primary btn-block" onClick={() => openCamera(action)}><RefreshCw size={17} /> Coba Akses Kamera Lagi</button> : <button className="btn btn-primary btn-block" disabled={!cameraReady} onClick={capturePhoto}>{cameraReady ? <Camera size={18} /> : <LoaderCircle className="spin" size={18} />} {cameraReady ? "Ambil Foto Sekarang" : "Menyiapkan Kamera"}</button> : null}{phase === "preview" ? <><button className="btn btn-outline" disabled={submitting} onClick={() => openCamera(action)}><RefreshCw size={16} /> Foto Ulang</button><button className="btn btn-primary" disabled={submitting} onClick={confirmAttendance}>{submitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} {submitting ? "Menyimpan…" : `Konfirmasi ${actionLabel(action)}`}</button></> : null}{phase === "success" ? <button className="btn btn-primary btn-block" onClick={closeCamera}>Selesai</button> : null}</footer>
      </section></div> : null}
    </div>
  );
}

function cameraErrorMessage(cause: unknown) {
  if (!window.isSecureContext) return "Kamera hanya dapat digunakan melalui HTTPS atau localhost.";
  if (!(cause instanceof DOMException)) return "Kamera belum dapat digunakan. Periksa izin kamera browser, lalu coba lagi.";
  if (cause.name === "TimeoutError") return "Permintaan kamera terlalu lama. Periksa dialog izin kamera pada browser, pilih Izinkan, lalu coba lagi.";
  if (cause.name === "NotAllowedError" || cause.name === "SecurityError") return "Akses kamera ditolak. Klik ikon kamera di bilah alamat, izinkan kamera, lalu coba lagi.";
  if (cause.name === "NotFoundError" || cause.name === "DevicesNotFoundError") return "Kamera tidak ditemukan pada perangkat ini.";
  if (cause.name === "NotReadableError" || cause.name === "TrackStartError") return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut, lalu coba lagi.";
  return "Kamera gagal dibuka. Muat ulang halaman dan periksa pengaturan kamera browser.";
}

function requestCameraStream(constraints: MediaStreamConstraints) {
  return new Promise<MediaStream>((resolve, reject) => {
    let finished = false;
    const timer = window.setTimeout(() => {
      finished = true;
      reject(new DOMException("Camera permission timed out", "TimeoutError"));
    }, 15000);
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      window.clearTimeout(timer);
      if (finished) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      finished = true;
      resolve(stream);
    }).catch((cause) => {
      window.clearTimeout(timer);
      if (finished) return;
      finished = true;
      reject(cause);
    });
  });
}
