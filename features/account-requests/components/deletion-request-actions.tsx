"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, LoaderCircle, Trash2, X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { processDeletionRequest, rejectDeletionRequest, type DeletionActionState } from "@/app/superadmin/penghapusan-akun/actions";

type Props = { id: string; email: string; confirmed: boolean; blockedBy: string[] };

/** "Proses" (delete the account) and "Tolak" buttons for one pending deletion request. */
export function DeletionRequestActions({ id, email, confirmed, blockedBy }: Props) {
  const [dialog, setDialog] = useState<"process" | "reject" | null>(null);
  // The dialog closes itself once the server action succeeds; errors stay visible inside it.
  const closeOnSuccess = (action: typeof processDeletionRequest) => async (previous: DeletionActionState, form: FormData) => {
    const result = await action(previous, form);
    if (result.ok) setDialog(null);
    return result;
  };
  const [processState, processAction, processing] = useActionState<DeletionActionState, FormData>(closeOnSuccess(processDeletionRequest), {});
  const [rejectState, rejectAction, rejecting] = useActionState<DeletionActionState, FormData>(closeOnSuccess(rejectDeletionRequest), {});
  const close = () => { if (!processing && !rejecting) setDialog(null); };

  return <>
    {confirmed && <button className="btn btn-primary btn-sm" type="button" onClick={() => setDialog("process")}><Trash2 size={14} /> Proses</button>}
    <button className="btn btn-outline btn-sm" type="button" onClick={() => setDialog("reject")}>Tolak</button>

    {dialog && <ModalPortal><div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      {dialog === "process"
        ? <form className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="deletion-process-title" action={processAction}>
          <input type="hidden" name="id" value={id} />
          <header><div className="confirm-icon"><AlertTriangle size={22} /></div><button type="button" aria-label="Tutup" onClick={close}><X size={18} /></button></header>
          <div>
            <h2 id="deletion-process-title">Hapus akun {email}?</h2>
            <p>Akun, sesi login, dan keanggotaan perusahaannya dihapus permanen. Data perusahaan tidak ikut terhapus. Pemohon akan menerima email pemberitahuan.</p>
            {blockedBy.length > 0 && <small>Akun ini satu-satunya admin di {blockedBy.join(", ")}. Tunjuk admin lain dulu, atau permintaan akan ditolak sistem.</small>}
            {processState.error && <div className="error-box deletion-dialog-error" role="alert">{processState.error}</div>}
          </div>
          <footer>
            <button type="button" className="btn btn-outline" onClick={close} disabled={processing}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={processing}>{processing && <LoaderCircle size={15} className="spin" />} Ya, hapus akun</button>
          </footer>
        </form>
        : <form className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="deletion-reject-title" action={rejectAction}>
          <input type="hidden" name="id" value={id} />
          <header><h2 id="deletion-reject-title">Tolak permintaan {email}?</h2><button type="button" aria-label="Tutup" onClick={close}><X size={18} /></button></header>
          <div>
            <p>Akun tetap aktif.{confirmed ? " Pemohon menerima email berisi alasan di bawah." : " Permintaan ini belum dikonfirmasi pemiliknya, jadi tidak ada email yang dikirim."}</p>
            <div className="field"><label htmlFor={`note-${id}`}>Alasan penolakan (opsional)</label><textarea className="input" id={`note-${id}`} name="note" rows={3} maxLength={500} placeholder="Contoh: masih ada tagihan yang belum diselesaikan" /></div>
            {rejectState.error && <div className="error-box deletion-dialog-error" role="alert">{rejectState.error}</div>}
          </div>
          <footer>
            <button type="button" className="btn btn-outline" onClick={close} disabled={rejecting}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={rejecting}>{rejecting && <LoaderCircle size={15} className="spin" />} Tolak permintaan</button>
          </footer>
        </form>}
    </div></ModalPortal>}
  </>;
}
