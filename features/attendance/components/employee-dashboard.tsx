"use client";
/* eslint-disable @next/next/no-img-element -- pratinjau kamera memakai data URL sementara */

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Camera, Check, CheckCircle2, Clock3, LoaderCircle, LocateFixed, LogIn, LogOut, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShiftPicker } from "@/features/attendance/components/shift-picker";
import type { ShiftOption } from "@/features/attendance/shift-time";

type AttendanceAction = "check_in" | "check_out";
type CameraPhase = "ready" | "shift" | "camera" | "preview" | "success";
type AttendanceState = {
  checkIn: string | null;
  checkOut: string | null;
  status: "present" | "late" | "absent" | "leave";
} | null;

type StatusResponse = {
  company: { name: string; timezone: string };
  attendance: AttendanceState;
  nextAction: AttendanceAction | null;
  /** From the employee list locks: Kunci Lokasi / Kunci Foto. */
  rules?: { requireLocation: boolean; requirePhoto: boolean };
  /** Several shifts today: the employee picks one before the photo. */
  shifts?: ShiftOption[];
  suggestedShiftId?: string | null;
};

export function EmployeeDashboard({ name, date, timezone, initialAttendance, display = "full" }: {
  name: string;
  date: string;
  timezone: string;
  initialAttendance: AttendanceState;
  display?: "full" | "notice";
}) {
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceState>(initialAttendance);
  // "Kunci Foto" off -> the employee may check in without a photo. Loaded when the camera opens.
  const [requirePhoto, setRequirePhoto] = useState(true);
  const [phase, setPhase] = useState<CameraPhase>("ready");
  const [action, setAction] = useState<AttendanceAction>("check_in");
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const [location, setLocation] = useState("Mendeteksi lokasi saat kamera dibuka");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number; accuracyMeters: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [companyName, setCompanyName] = useState("");
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [shiftId, setShiftId] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearInterval(timer);
      stopCamera();
    };
  }, [stopCamera]);

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

  const refreshAttendance = useCallback(async () => {
    const response = await fetch("/api/attendance/me", { cache: "no-store" });
    const body = await response.json() as StatusResponse & { message?: string };
    if (!response.ok) throw new Error(body.message || "Status kehadiran belum dapat dimuat.");
    setAttendance(body.attendance);
    setCompanyName(body.company.name);
    setRequirePhoto(body.rules?.requirePhoto !== false);
    window.dispatchEvent(new Event("tepatwaktu:attendance-updated"));
    router.refresh();
  }, [router]);

  const openCamera = useCallback(async (nextAction: AttendanceAction) => {
    void fetch("/api/attendance/me", { cache: "no-store" }).then((response) => response.json() as Promise<StatusResponse>)
      .then((body) => setRequirePhoto(body.rules?.requirePhoto !== false)).catch(() => undefined);
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
        ? "Browser ini tidak mendukung akses kamera. Gunakan browser versi terbaru."
        : "Kamera hanya dapat digunakan melalui HTTPS atau localhost.");
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
      navigator.geolocation?.getCurrentPosition(
        (position) => {
          const next = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy };
          setCoordinates(next);
          setLocation(`Lokasi terdeteksi · akurasi ±${Math.round(next.accuracyMeters)} m`);
        },
        () => setLocation("Lokasi belum diizinkan · kebijakan perusahaan dapat mewajibkannya"),
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 },
      );
    } catch (cause) {
      setCameraStarting(false);
      setCameraFailed(true);
      setError(cameraErrorMessage(cause));
    }
  }, [stopCamera]);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth) return setError("Kamera masih menyiapkan gambar. Tunggu sebentar lalu coba lagi.");
    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.82));
    stopCamera();
    setPhase("preview");
  }

  /** withoutPhoto: only offered when "Kunci Foto" is off for this employee. */
  async function confirmAttendance(withoutPhoto = false) {
    if (!photo && !withoutPhoto) return;
    setSubmitting(true);
    setError("");
    try {
      const form = new FormData();
      form.set("action", action);
      form.set("clientCapturedAt", new Date().toISOString());
      if (action === "check_in" && shiftId) form.set("scheduleId", shiftId);
      if (photo && !withoutPhoto) form.set("photo", new File([await (await fetch(photo)).blob()], `${action}-${Date.now()}.jpg`, { type: "image/jpeg" }));
      if (coordinates) {
        form.set("latitude", String(coordinates.latitude));
        form.set("longitude", String(coordinates.longitude));
        form.set("accuracyMeters", String(coordinates.accuracyMeters));
      }
      const response = await fetch("/api/attendance/me", { method: "POST", body: form });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message || "Kehadiran belum dapat disimpan.");
      await refreshAttendance();
      setPhase("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kehadiran belum dapat disimpan.");
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
    setPhoto("");
    setPhase("ready");
    setShiftId("");
  }

  const nextAction = !attendance?.checkIn ? "check_in" : !attendance.checkOut ? "check_out" : null;
  const actionText = nextAction === "check_out" ? "Check-out sekarang" : "Check-in sekarang";
  const headline = !attendance?.checkIn ? "Belum check-in" : !attendance.checkOut ? "Belum check-out" : "Kehadiran lengkap";
  const copy = !attendance?.checkIn
    ? "Siapkan kamera dan pastikan Anda berada di area kantor."
    : !attendance.checkOut
      ? `Check-in tercatat pukul ${attendance.checkIn.slice(0, 5)}. Jangan lupa mencatat jam pulang.`
      : `Check-in ${attendance.checkIn.slice(0, 5)} · Check-out ${attendance.checkOut.slice(0, 5)}`;
  const actionLabel = (value: AttendanceAction) => value === "check_in" ? "Check-in" : "Check-out";
  const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: timezone }).format(now);
  const historyHref = "/dashboard/presensi/riwayat" as Route;
  const nowTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: timezone }).format(now);
  const chosenShift = shifts.find((shift) => shift.id === shiftId);

  /** Check-in of a division with several shifts starts with choosing the shift; otherwise straight to the camera. */
  async function startAttendance(nextAction: AttendanceAction) {
    setShiftId("");
    if (nextAction === "check_in") {
      try {
        const response = await fetch("/api/attendance/me", { cache: "no-store" });
        const body = await response.json() as StatusResponse;
        if (response.ok && (body.shifts?.length ?? 0) > 1) {
          setShifts(body.shifts ?? []);
          setRequirePhoto(body.rules?.requirePhoto !== false);
          setError("");
          setAction("check_in");
          setPhase("shift");
          return;
        }
      } catch { /* the camera step still works; the server checks the shift */ }
    }
    void openCamera(nextAction);
  }

  return <div className={`employee-home ${display === "notice" ? "employee-home-notice-only" : ""}`}>
    {display === "full" ? <section className="employee-home-hero">
      <div><span>{date}</span><h1>Halo, {name} <b>👋</b></h1><p>{attendance?.checkIn ? "Kehadiran Anda hari ini sudah mulai tercatat." : "Kehadiran Anda hari ini belum tercatat."}</p></div>
      {nextAction ? <button type="button" className="employee-home-hero-action" onClick={() => void startAttendance(nextAction)}>Buka absensi →</button> : <Link className="employee-home-hero-action" href={historyHref}>Lihat riwayat →</Link>}
    </section> : null}

    <section className="employee-home-attendance">
      <div><span>ABSENSI HARI INI</span><h2>{headline}</h2><p>{copy}</p></div>
      {nextAction ? <button type="button" className="employee-home-camera-action" onClick={() => void startAttendance(nextAction)} aria-label={actionText}><span><Camera size={18} /></span><strong>{actionText}</strong><small>Tanpa formulir · foto langsung dikirim</small></button> : <Link className="employee-home-camera-action complete" href={historyHref}><span><CheckCircle2 size={18} /></span><strong>Lihat riwayat</strong><small>Kehadiran hari ini sudah lengkap</small></Link>}
      {error && phase === "ready" ? <div className="camera-error" role="alert">{error}</div> : null}
    </section>

    {display === "full" ? <section className="employee-home-stats">
      <article><span><CheckCircle2 size={20} /></span><strong>{attendance?.checkIn ? "Hadir" : "Belum"}</strong><h3>Kehadiran hari ini</h3><small>{attendance?.checkIn ? `Masuk pukul ${attendance.checkIn.slice(0, 5)}` : "Silakan lakukan check-in"}</small></article>
      <article><span><Clock3 size={20} /></span><strong>{attendance?.status === "late" ? "Terlambat" : "0"}</strong><h3>Status terlambat</h3><small>{attendance?.status === "late" ? "Tercatat terlambat" : "Tepat waktu"}</small></article>
      <article><span><LogIn size={20} /></span><strong>{attendance?.checkIn?.slice(0, 5) ?? "—"}</strong><h3>Jam masuk</h3><small>Waktu check-in hari ini</small></article>
      <article><span><LogOut size={20} /></span><strong>{attendance?.checkOut?.slice(0, 5) ?? "—"}</strong><h3>Jam pulang</h3><small>Waktu check-out hari ini</small></article>
    </section> : null}

    {phase !== "ready" ? <div className="camera-backdrop" role="dialog" aria-modal="true" aria-label="Ambil foto kehadiran"><section className="camera-dialog">
      <header><div><span className="eyebrow">{actionLabel(action).toUpperCase()}{chosenShift && phase !== "shift" ? ` · ${chosenShift.name.toUpperCase()}` : ""}</span><h2>{phase === "success" ? "Kehadiran berhasil dicatat" : phase === "shift" ? "Pilih shift kerja hari ini" : "Foto langsung dari kamera"}</h2></div><button onClick={closeCamera} aria-label="Tutup"><X size={20} /></button></header>
      {phase === "shift" ? <ShiftPicker shifts={shifts} value={shiftId} nowTime={nowTime} onChange={setShiftId} /> : null}
      {phase === "camera" ? <div className="camera-viewport"><video ref={videoRef} autoPlay playsInline muted /><span className="live-badge">● LIVE</span>{!cameraReady ? <div className="camera-loading"><LoaderCircle className="spin" size={28} /><strong>{cameraStarting ? "Meminta akses kamera…" : "Menyiapkan pratinjau…"}</strong><small>Pastikan izin kamera pada browser sudah aktif.</small></div> : null}</div> : null}
      {phase === "preview" ? <div className="camera-viewport preview"><img src={photo} alt="Pratinjau foto kehadiran" /></div> : null}
      {phase === "success" ? <div className="attendance-success"><span><Check size={34} /></span><h3>{actionLabel(action)} tercatat</h3><p>{time}{companyName ? ` · ${companyName}` : ""}</p><small>Data kehadiran telah disimpan dengan aman.</small></div> : null}
      {phase !== "success" && phase !== "shift" ? <div className="camera-meta"><span><Clock3 size={15} /> {time}</span><span><LocateFixed size={15} /> {location}</span></div> : null}
      {error && phase !== "success" ? <div className="camera-error dialog-error" role="alert">{error}</div> : null}
      <footer>{phase === "shift" ? <button className="btn btn-primary btn-block" disabled={!shiftId} onClick={() => void openCamera("check_in")}><Camera size={18} /> {shiftId ? "Lanjut Ambil Foto" : "Pilih shift terlebih dahulu"}</button> : null}{phase === "camera" ? cameraFailed ? <button className="btn btn-primary btn-block" onClick={() => void openCamera(action)}><RefreshCw size={17} /> Coba Akses Kamera Lagi</button> : <button className="btn btn-primary btn-block" disabled={!cameraReady} onClick={capturePhoto}>{cameraReady ? <Camera size={18} /> : <LoaderCircle className="spin" size={18} />} {cameraReady ? "Ambil Foto Sekarang" : "Menyiapkan Kamera"}</button> : null}{phase === "preview" ? <><button className="btn btn-outline" disabled={submitting} onClick={() => void openCamera(action)}><RefreshCw size={16} /> Foto Ulang</button><button className="btn btn-primary" disabled={submitting} onClick={() => void confirmAttendance()}>{submitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} {submitting ? "Menyimpan…" : `Konfirmasi ${actionLabel(action)}`}</button></> : null}{phase === "success" ? <button className="btn btn-primary btn-block" onClick={closeCamera}>Selesai</button> : null}{phase === "camera" && !requirePhoto ? <button className="btn btn-outline btn-block" disabled={submitting} onClick={() => { stopCamera(); void confirmAttendance(true); }}>{submitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} {submitting ? "Menyimpan…" : `${actionLabel(action)} tanpa foto`}</button> : null}</footer>
    </section></div> : null}
  </div>;
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
