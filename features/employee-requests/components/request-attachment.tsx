"use client";

// File attachment of Izin/Cuti and Lembur requests: picker in the form, link in the table.
import { Paperclip } from "lucide-react";
import { useCallback, useRef } from "react";

export type RequestAttachment = { id: string; name: string };

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";

/** Same limits as /api/feature-uploads, checked before uploading so the employee gets a quick answer. */
export function attachmentProblem(file: File) {
  if (file.size > MAX_BYTES) return "Ukuran lampiran maksimal 8 MB.";
  if (!/\.(pdf|jpe?g|png|webp)$/i.test(file.name) && !/^(application\/pdf|image\/(jpeg|png|webp))$/.test(file.type)) return "Lampiran harus berupa PDF, JPG, PNG, atau WebP.";
  return null;
}

/** Uploads the file into the company's private storage and returns its asset id. */
export async function uploadRequestAttachment(module: "pengajuan/izin-cuti" | "pengajuan/lembur", file: File) {
  const problem = attachmentProblem(file);
  if (problem) throw new Error(problem);
  const form = new FormData();
  form.set("module", module);
  form.set("file", file);
  const response = await fetch("/api/feature-uploads", { method: "POST", body: form }).catch(() => null);
  if (!response) throw new Error("Lampiran gagal diunggah. Periksa koneksi internet, lalu coba lagi.");
  const payload = await response.json().catch(() => ({})) as { id?: string; error?: string };
  if (!response.ok || !payload.id) throw new Error(payload.error ?? "Lampiran gagal diunggah.");
  return payload.id;
}

/**
 * Upload function that remembers the last file: when saving fails for another reason (e.g. leave
 * quota), the next try reuses the uploaded file instead of storing it twice.
 */
export function useAttachmentUploader(module: "pengajuan/izin-cuti" | "pengajuan/lembur") {
  const last = useRef<{ file: File; id: string } | null>(null);
  return useCallback(async (file: File) => {
    if (last.current?.file === file) return last.current.id;
    const id = await uploadRequestAttachment(module, file);
    last.current = { file, id };
    return id;
  }, [module]);
}

export function AttachmentField({ required, current, file, onChange }: { required: boolean; current: RequestAttachment | null; file: File | null; onChange: (file: File | null) => void }) {
  return <label className="full request-attachment-field">
    <span>Lampiran {required ? <em className="required-mark">*</em> : <small>(opsional)</small>}</span>
    <input type="file" accept={ACCEPT} onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
    <small className="request-attachment-hint">
      {file ? `Dipilih: ${file.name}` : current ? <>File saat ini: <AttachmentLink attachment={current} /> · pilih file baru untuk mengganti</> : required ? "Wajib. PDF atau foto (JPG/PNG/WebP), maks. 8 MB." : "PDF atau foto (JPG/PNG/WebP), maks. 8 MB."}
    </small>
  </label>;
}

export function AttachmentLink({ attachment }: { attachment: RequestAttachment | null }) {
  if (!attachment) return <span className="request-attachment-none">—</span>;
  return <a className="request-attachment-link" href={`/api/files/${attachment.id}`} target="_blank" rel="noreferrer" title={attachment.name}><Paperclip size={13} /> <span>{attachment.name}</span></a>;
}

/** Row fields (attachmentAssetId + attachmentName) as one attachment, or null. */
export function rowAttachment(row: { attachmentAssetId?: string | null; attachmentName?: string | null }): RequestAttachment | null {
  return row.attachmentAssetId ? { id: row.attachmentAssetId, name: row.attachmentName ?? "Lampiran" } : null;
}
