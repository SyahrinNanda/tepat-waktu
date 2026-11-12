"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import { Drawer } from "@/features/master-data/shifts/components/shift-manager";
import { confirmAction } from "@/components/confirm-dialog";
import { CONTRACT_TYPES, contractEndDate } from "@/features/employees/contracts";
import { deleteContract, extendContract, saveContract, type ContractResult } from "@/features/employees/server/contract-actions";

export type ContractRow = { id: string; contractType: string; startDate: string; durationMonths: number | null; note: string | null; active: boolean };
type Panel = { mode: "create" } | { mode: "edit"; row: ContractRow } | { mode: "extend"; row: ContractRow } | null;

const formatDate = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const durationText = (months: number | null) => (months ? `${months} Bulan` : "Tanpa batas");

/** Kontrak Kerja tab of the employee detail page. */
export function EmployeeContracts({ employeeId, rows, canManage }: { employeeId: string; rows: ContractRow[]; canManage: boolean }) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null), [error, setError] = useState(""), [pending, startTransition] = useTransition();

  function run(action: () => Promise<ContractResult>, after?: () => void) {
    setError("");
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false, error: "Server tidak dapat dihubungi." }) as ContractResult);
      if (!result.ok) return setError(result.error);
      setPanel(null); after?.(); router.refresh();
    });
  }
  async function remove(row: ContractRow) {
    if (!await confirmAction(`Hapus kontrak ${row.contractType.toUpperCase()} mulai ${formatDate(row.startDate)}?`, "Hapus Kontrak Kerja")) return;
    run(() => deleteContract(employeeId, row.id));
  }
  const close = () => { setPanel(null); setError(""); };

  return <div className="employee-tab-panel">
    <div className="employee-tab-head"><h3>Kontrak Kerja Karyawan</h3>{canManage && <button type="button" className="btn btn-primary employee-tab-action" onClick={() => { setError(""); setPanel({ mode: "create" }); }}><Plus size={16}/> Tambah Kontrak</button>}</div>
    {error && !panel && <div className="announcement-inline-error">{error}</div>}
    <div className="table-scroll"><table className="employee-tab-table employee-contract-table">
      <thead><tr><th>#</th><th>Tipe Kontrak</th><th>Tanggal Mulai Kontrak</th><th>Durasi Kontrak</th><th>Catatan Kontrak</th>{canManage && <th>Aksi</th>}</tr></thead>
      <tbody>{rows.map((row, index) => {
        const end = contractEndDate(row.startDate, row.durationMonths);
        return <tr key={row.id} className={row.active ? "active" : ""}>
          <td>{index + 1}</td>
          <td><strong>{row.contractType.toUpperCase()}</strong>{row.active ? <small className="employee-contract-badge">Aktif</small> : <small className="employee-contract-badge off">Tidak aktif</small>}</td>
          <td>{formatDate(row.startDate)}</td>
          <td>{durationText(row.durationMonths)}{end && <small>s.d. {formatDate(end)}</small>}</td>
          <td>{row.note || "–"}</td>
          {canManage && <td><details className="employee-row-menu"><summary aria-label="Aksi kontrak"><Ellipsis size={18}/></summary><div data-float-menu>
            <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setError(""); setPanel({ mode: "edit", row }); }}><Pencil size={15}/> Edit</button>
            {row.durationMonths && <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setError(""); setPanel({ mode: "extend", row }); }}><CalendarPlus size={15}/> Perpanjang</button>}
            <button type="button" className="danger" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void remove(row); }}><Trash2 size={15}/> Hapus</button>
          </div></details></td>}
        </tr>;
      })}</tbody>
    </table>{!rows.length && <div className="location-empty"><strong>Data Kosong</strong><span>Belum ada kontrak kerja untuk karyawan ini.</span></div>}</div>

    {panel?.mode === "extend" && <ExtendDrawer row={panel.row} pending={pending} error={error} onClose={close} onSubmit={(months) => run(() => extendContract(employeeId, panel.row.id, months))}/>}
    {(panel?.mode === "create" || panel?.mode === "edit") && <ContractDrawer row={panel.mode === "edit" ? panel.row : null} first={!rows.length} pending={pending} error={error} onClose={close}
      onSubmit={(input) => run(() => saveContract(employeeId, panel.mode === "edit" ? panel.row.id : null, input))}/>}
  </div>;
}

function ContractDrawer({ row, first, pending, error, onClose, onSubmit }: { row: ContractRow | null; first: boolean; pending: boolean; error: string; onClose: () => void; onSubmit: (input: Parameters<typeof saveContract>[2]) => void }) {
  const [type, setType] = useState(row?.contractType ?? "");
  return <Drawer title={row ? "Ubah Data Kontrak" : "Tambah Kontrak Baru"} onClose={onClose}>
    <form className="drawer-form employee-contract-form" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      onSubmit({ contractType: type as never, startDate: String(form.get("startDate") ?? ""), durationMonths: String(form.get("durationMonths") ?? ""), note: String(form.get("note") ?? ""), active: form.get("active") === "active" });
    }}>
      <label>Tipe Kontrak<select value={type} onChange={(event) => setType(event.target.value)} required><option value="">Pilih Tipe Kontrak</option>{CONTRACT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Tanggal Mulai Kontrak<input name="startDate" type="date" defaultValue={row?.startDate ?? ""} required/></label>
      <label>Durasi Kontrak <small>(Durasi dalam Bulan{type === "Tetap" ? ", kosongkan bila tanpa batas" : ""})</small><input name="durationMonths" type="number" min={1} max={240} defaultValue={row?.durationMonths ?? ""} placeholder="Durasi Kontrak..." required={type !== "Tetap"}/></label>
      <label>Catatan Kontrak<input name="note" maxLength={500} defaultValue={row?.note ?? ""} placeholder="Catatan Kontrak..."/></label>
      <label>Status Kontrak<select name="active" defaultValue={row ? (row.active ? "active" : "inactive") : first ? "active" : ""} required><option value="">Pilih Status Kontrak</option><option value="active">Aktif</option><option value="inactive">Tidak Aktif</option></select></label>
      <p className="drawer-help">Hanya satu kontrak yang aktif. Kontrak aktif lain otomatis menjadi tidak aktif, dan tipe kontrak di data karyawan ikut diperbarui.</p>
      {error && <div className="announcement-inline-error">{error}</div>}
      <footer><button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Batal</button><button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Menyimpan..." : row ? "Simpan Perubahan" : "Simpan"}</button></footer>
    </form>
  </Drawer>;
}

function ExtendDrawer({ row, pending, error, onClose, onSubmit }: { row: ContractRow; pending: boolean; error: string; onClose: () => void; onSubmit: (months: number) => void }) {
  const [months, setMonths] = useState("1");
  const added = Number(months) || 0;
  const currentEnd = contractEndDate(row.startDate, row.durationMonths), nextEnd = added > 0 ? contractEndDate(row.startDate, (row.durationMonths ?? 0) + added) : null;
  return <Drawer title="Perpanjang Kontrak" onClose={onClose}>
    <form className="drawer-form employee-contract-form" onSubmit={(event) => { event.preventDefault(); onSubmit(added); }}>
      <dl className="employee-contract-summary">
        <div><dt>Tipe Kontrak:</dt><dd>{row.contractType.toUpperCase()}</dd></div>
        <div><dt>Kontrak Mulai:</dt><dd>{formatDate(row.startDate)}</dd></div>
        <div><dt>Durasi Saat Ini:</dt><dd>{durationText(row.durationMonths)}{currentEnd && ` (s.d. ${formatDate(currentEnd)})`}</dd></div>
      </dl>
      <label>Tambah Durasi Kontrak <small>(Durasi dalam Bulan)</small><input type="number" min={1} max={120} value={months} onChange={(event) => setMonths(event.target.value)} required autoFocus/></label>
      {nextEnd && <p className="drawer-help">Durasi menjadi <strong>{(row.durationMonths ?? 0) + added} bulan</strong>, berakhir <strong>{formatDate(nextEnd)}</strong>.</p>}
      {error && <div className="announcement-inline-error">{error}</div>}
      <footer><button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Batal</button><button className="btn btn-primary btn-sm" disabled={pending || added < 1}>{pending ? "Menyimpan..." : "Simpan"}</button></footer>
    </form>
  </Drawer>;
}
