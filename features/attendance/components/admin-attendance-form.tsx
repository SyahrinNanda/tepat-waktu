"use client";

import { CheckCircle2, ClipboardCheck, LoaderCircle } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type EmployeeOption = { id: string; name: string; companyId: string; companyName?: string };

export function AdminAttendanceForm({ employees, superadmin = false }: { employees: EmployeeOption[]; superadmin?: boolean }) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(superadmin ? "" : employees[0]?.companyId ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const companies = useMemo(() => Array.from(new Map(employees.map((item) => [item.companyId, item.companyName ?? item.companyId])).entries()), [employees]);
  const visibleEmployees = companyId ? employees.filter((item) => item.companyId === companyId) : [];
  const currentLocalTime = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const formElement = event.currentTarget;
    const source = new FormData(formElement);
    const occurredAt = new Date(String(source.get("occurredAt")));
    source.set("occurredAt", occurredAt.toISOString());
    if (superadmin) source.set("companyId", companyId);
    else source.delete("companyId");
    try {
      const response = await fetch("/api/attendance/admin", { method: "POST", body: source });
      const body = await response.json() as { message?: string; action?: string; time?: string };
      if (!response.ok) throw new Error(body.message || "Kehadiran belum dapat disimpan.");
      setMessage({ type: "success", text: `${body.action === "check_in" ? "Check-in" : "Check-out"} berhasil dicatat pada ${body.time?.slice(0, 5)}.` });
      formElement.reset();
      if (superadmin) setCompanyId("");
      router.refresh();
    } catch (cause) {
      setMessage({ type: "error", text: cause instanceof Error ? cause.message : "Kehadiran belum dapat disimpan." });
    } finally {
      setLoading(false);
    }
  }

  return <section className="card section-card modal-card">
    <div className="card-head"><div><h2 className="card-title">Catat kehadiran karyawan</h2><p className="card-subtitle">Tindakan ini dicatat sebagai input administrator dan tidak membuat kehadiran untuk akun Anda.</p></div><span className="stat-icon green"><ClipboardCheck size={18} /></span></div>
    {message ? <div className={message.type === "success" ? "success-box" : "error-box"} role="status">{message.type === "success" ? <CheckCircle2 size={16} /> : null}{message.text}</div> : null}
    <form onSubmit={submit} className="form-grid">
      {superadmin ? <Field label="Perusahaan"><select className="input" value={companyId} onChange={(event) => setCompanyId(event.target.value)} required><option value="">Pilih perusahaan</option>{companies.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></Field> : null}
      <Field label="Karyawan"><select className="input" name="employeeId" required disabled={!visibleEmployees.length}><option value="">Pilih karyawan</option>{visibleEmployees.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></Field>
      <Field label="Aksi"><select className="input" name="action" defaultValue="check_in"><option value="check_in">Check-in</option><option value="check_out">Check-out</option></select></Field>
      <Field label="Waktu kejadian"><input className="input" name="occurredAt" type="datetime-local" defaultValue={currentLocalTime()} required /></Field>
      <Field label="Alasan / catatan audit"><input className="input" name="note" minLength={3} maxLength={500} placeholder="Contoh: koreksi karena perangkat karyawan bermasalah" required /></Field>
      <div className="full action-row"><button className="btn btn-primary" disabled={loading || !visibleEmployees.length}>{loading ? <LoaderCircle className="spin" size={16} /> : <ClipboardCheck size={16} />}{loading ? "Menyimpan…" : "Simpan Kehadiran"}</button></div>
    </form>
  </section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span className="field-label">{label}</span>{children}</label>;
}
