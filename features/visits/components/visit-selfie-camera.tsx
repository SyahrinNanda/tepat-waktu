"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, LoaderCircle, RefreshCw, RotateCcw, X } from "lucide-react";

/** Marks a selfie taken with the live camera (sent as `selfieSource` with the visit form). */
export const CAMERA_SELFIE_SOURCE = "camera";

type Props = { onClose: () => void; onCapture: (file: File, previewUrl: string) => void };

/**
 * Live front-camera capture for the visit selfie. No file picker: the photo is drawn from
 * the video stream onto a canvas, so it is always taken at that moment.
 */
export function VisitSelfieCamera({ onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setReady(false);
      setError("");
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError("Kamera hanya dapat digunakan melalui HTTPS atau localhost.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setReady(true);
      } catch (cause) {
        if (cancelled) return;
        const name = cause instanceof DOMException ? cause.name : "";
        setError(name === "NotAllowedError" || name === "SecurityError"
          ? "Akses kamera ditolak. Izinkan kamera pada browser, lalu coba lagi."
          : name === "NotFoundError" ? "Kamera tidak ditemukan pada perangkat ini."
          : name === "NotReadableError" ? "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut, lalu coba lagi."
          : "Kamera gagal dibuka. Periksa izin kamera browser, lalu coba lagi.");
      }
    }
    if (!shot) void start();
    return () => { cancelled = true; stopStream(); };
  }, [attempt, shot, stopStream]);

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    // Mirror like the preview, so the photo looks the way the user saw it.
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { setError("Foto gagal diambil. Coba lagi."); return; }
      stopStream();
      setShot({ blob, url: URL.createObjectURL(blob) });
    }, "image/jpeg", 0.9);
  };

  const confirm = () => {
    if (!shot) return;
    const file = new File([shot.blob], `selfie-kamera-${Date.now()}.jpg`, { type: "image/jpeg" });
    // A fresh URL for the form preview; this dialog revokes its own on unmount.
    onCapture(file, URL.createObjectURL(shot.blob));
  };

  return <div className="camera-backdrop visit-camera-backdrop" role="dialog" aria-modal="true" aria-label="Ambil foto selfie kunjungan">
    <section className="camera-dialog">
      <header><div><span className="eyebrow">KUNJUNGAN</span><h2>Foto selfie langsung dari kamera</h2></div><button type="button" onClick={onClose} aria-label="Tutup"><X size={20}/></button></header>
      {shot
        // eslint-disable-next-line @next/next/no-img-element
        ? <div className="camera-viewport preview"><img src={shot.url} alt="Pratinjau foto selfie" style={{ transform: "none" }}/></div>
        : <div className="camera-viewport"><video ref={videoRef} autoPlay playsInline muted/><span className="live-badge">● LIVE</span>
          {!ready && !error && <div className="camera-loading"><LoaderCircle className="spin" size={28}/><strong>Meminta akses kamera…</strong><small>Pastikan izin kamera pada browser sudah aktif.</small></div>}
        </div>}
      {error && <div className="camera-error dialog-error" role="alert">{error}</div>}
      <footer>
        {shot ? <>
          <button type="button" className="btn btn-outline" onClick={() => setShot(null)}><RotateCcw size={17}/> Ulangi</button>
          <button type="button" className="btn btn-primary" onClick={confirm}><Check size={18}/> Gunakan Foto</button>
        </> : error
          ? <button type="button" className="btn btn-primary btn-block" onClick={() => setAttempt((value) => value + 1)}><RefreshCw size={17}/> Coba Akses Kamera Lagi</button>
          : <button type="button" className="btn btn-primary btn-block" disabled={!ready} onClick={capture}>{ready ? <Camera size={18}/> : <LoaderCircle className="spin" size={18}/>} {ready ? "Ambil Foto Sekarang" : "Menyiapkan kamera…"}</button>}
      </footer>
    </section>
  </div>;
}
