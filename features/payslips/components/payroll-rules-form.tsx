"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, CalendarRange, Save } from "lucide-react";
import { savePayrollRulesAction } from "@/features/payslips/server/actions";
import type { PayrollRules } from "@/features/payslips/server/payslip-calculation";
import { addDays, formatPeriodRange, MAX_PERIOD_START_DAY, nextPeriodName, payrollPeriod, periodContaining, periodLabel, periodTransition } from "@/features/payslips/payroll-period";

const rupiah = (value: number) => `Rp ${new Intl.NumberFormat("id-ID").format(value)}`;

type LatestFinal = { year: number; month: number; end: string } | null;
const shortDate = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

/** Company rules that turn attendance into pay: payroll period, break length, late and alpa deductions. */
export function PayrollRulesForm({ initial, latestFinal, today }: { initial: PayrollRules; latestFinal: LatestFinal; today: string }) {
  const router = useRouter();
  const [rules, setRules] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof PayrollRules>(key: K, value: PayrollRules[K]) => { setRules((current) => ({ ...current, [key]: value })); setMessage(null); };
  const num = (value: string) => Math.max(0, Math.floor(Number(value.replace(/\D/g, "")) || 0));

  function save(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const result = await savePayrollRulesAction(rules);
      setMessage(result.ok ? { ok: true, text: "Pengaturan perhitungan gaji disimpan. Slip draft langsung memakai aturan dan periode baru; slip terkunci tidak berubah." } : { ok: false, text: result.error ?? "Gagal menyimpan." });
      if (result.ok) router.refresh();
    });
  }

  const lateExample = rules.lateDeductionMode === "per_day" ? `Terlambat 2 hari → potongan ${rupiah(rules.lateDeductionAmount * 2)}`
    : rules.lateDeductionMode === "per_hour" ? `Terlambat 20 menit = dihitung 1 jam, terlambat 1 jam 10 menit = 2 jam → potongan ${rupiah(rules.lateDeductionAmount)} dan ${rupiah(rules.lateDeductionAmount * 2)}. Jam yang sudah dimulai dihitung penuh.`
    : rules.lateDeductionMode === "per_minute" ? `Terlambat total 30 menit → potongan ${rupiah(rules.lateDeductionAmount * 30)}` : "Keterlambatan hanya dicatat, gaji tidak dipotong.";

  // Preview of the running and next period, and what the change does next to the newest locked slip.
  const current = periodContaining(today, rules.periodStartDay);
  const following = nextPeriodName(current.year, current.month);
  const preview = [current, following].map((name) => { const range = payrollPeriod(name.year, name.month, rules.periodStartDay); return { label: periodLabel(name.year, name.month), range: formatPeriodRange(range.start, range.end) }; });
  const transition = periodTransition(latestFinal, rules.periodStartDay);

  return <>
    <div className="master-page-head"><span>Karyawan</span><h1>Pengaturan Perhitungan Gaji</h1><p>Beranda / Karyawan / Slip Gaji / Pengaturan</p></div>
    <form className="module-card payroll-rules" onSubmit={save}>
      <section>
        <h2>Periode Penggajian</h2>
        <p>Tanggal mulai periode slip gaji. Bawaan tanggal 1 (tanggal 1 sampai akhir bulan). Nama periode mengikuti bulan tanggal mulai: dengan tanggal 26, slip &quot;Oktober&quot; menghitung 26 Oktober – 25 November.</p>
        <div className="payroll-rules-grid">
          <label className="employee-field">Periode dimulai tanggal
            <select value={rules.periodStartDay} onChange={(event) => set("periodStartDay", Number(event.target.value))}>
              {Array.from({ length: MAX_PERIOD_START_DAY }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day === 1 ? "Tanggal 1 (default: 1 – akhir bulan)" : `Tanggal ${day} (s.d. tanggal ${day - 1} bulan berikutnya)`}</option>)}
            </select>
          </label>
          <div className="payroll-period-preview">
            <CalendarRange size={16}/>
            <div>{preview.map((item, index) => <span key={item.label}><small>{index === 0 ? "Periode berjalan" : "Periode berikutnya"}</small><strong>{item.label}</strong><em>{item.range}</em></span>)}</div>
          </div>
        </div>
        {transition && <div className="payroll-period-warning" role="alert"><AlertTriangle size={16}/><span>
          {transition.kind === "overlap"
            ? <>Tanggal <strong>{shortDate(transition.from)} – {shortDate(transition.to)}</strong> sudah masuk slip terkunci <strong>{transition.finalLabel}</strong>, dan akan terhitung lagi di slip <strong>{transition.nextLabel}</strong> ({transition.nextRange}). Periksa lembur dan potongan di tanggal tersebut agar tidak dibayar atau dipotong dua kali.</>
            : <>Tanggal <strong>{shortDate(transition.from)} – {shortDate(transition.to)}</strong> tidak masuk slip mana pun: slip terkunci terakhir (<strong>{transition.finalLabel}</strong>) berakhir {shortDate(latestFinal!.end)}, sedangkan slip <strong>{transition.nextLabel}</strong> dimulai {shortDate(addDays(transition.to, 1))}. Hitung tanggal tersebut secara manual bila perlu.</>}
        </span></div>}
        <small>Mulai tanggal 1–28 agar setiap bulan (termasuk Februari) punya tanggal mulai. Perubahan langsung berlaku untuk slip draft; slip yang sudah terkunci tidak dihitung ulang.</small>
      </section>

      <section>
        <h2>Jam Istirahat</h2>
        <p>Jam kerja di slip gaji = jam check-out − jam check-in − istirahat. Bila karyawan tidak mencatat istirahat, durasi di bawah ini yang dipotong.</p>
        <div className="payroll-rules-grid">
          <label className="employee-field">Durasi istirahat per hari (menit)
            <input inputMode="numeric" value={rules.breakMinutes} onChange={(event) => set("breakMinutes", num(event.target.value))}/>
          </label>
          <label className="employee-field">Potong istirahat bila bekerja lebih dari (menit)
            <input inputMode="numeric" value={rules.breakMinWorkMinutes} onChange={(event) => set("breakMinWorkMinutes", num(event.target.value))}/>
          </label>
        </div>
        <small>Contoh: masuk 08:00, pulang 17:00, istirahat {rules.breakMinutes} menit → jam kerja {formatMinutes(Math.max(0, 540 - (540 > rules.breakMinWorkMinutes ? rules.breakMinutes : 0)))}. Isi 0 bila istirahat dibayar / tidak dipotong.</small>
      </section>

      <section>
        <h2>Potongan Terlambat</h2>
        <p>Terlambat dinilai dari jadwal kerja divisi karyawan (jam masuk + toleransi). Potongan per jam/per menit dihitung dari jam masuk jadwal.</p>
        <div className="payroll-rules-grid">
          <label className="employee-field">Cara potong
            <select value={rules.lateDeductionMode} onChange={(event) => set("lateDeductionMode", event.target.value as PayrollRules["lateDeductionMode"])}>
              <option value="none">Tidak dipotong</option>
              <option value="per_day">Nominal per hari terlambat</option>
              <option value="per_hour">Nominal per jam terlambat</option>
              <option value="per_minute">Nominal per menit terlambat</option>
            </select>
          </label>
          <label className="employee-field">Nominal (Rp)
            <input inputMode="numeric" disabled={rules.lateDeductionMode === "none"} value={rules.lateDeductionAmount} onChange={(event) => set("lateDeductionAmount", num(event.target.value))}/>
          </label>
        </div>
        <small>{lateExample}</small>
      </section>

      <section>
        <h2>Potongan Alpa</h2>
        <p>Alpa = hari kerja menurut jadwal divisi yang sudah lewat tanpa check-in dan tanpa izin/cuti yang disetujui, atau ditandai Alpa oleh admin.</p>
        <div className="payroll-rules-grid">
          <label className="employee-field">Cara potong
            <select value={rules.absentDeductionMode} onChange={(event) => set("absentDeductionMode", event.target.value as PayrollRules["absentDeductionMode"])}>
              <option value="daily_rate">Gaji pokok ÷ hari kerja (gaji bulanan)</option>
              <option value="fixed">Nominal tetap per hari alpa</option>
              <option value="none">Tidak dipotong</option>
            </select>
          </label>
          <label className="employee-field">Nominal per hari (Rp)
            <input inputMode="numeric" disabled={rules.absentDeductionMode !== "fixed"} value={rules.absentDeductionAmount} onChange={(event) => set("absentDeductionAmount", num(event.target.value))}/>
          </label>
        </div>
        <small>Karyawan bergaji harian/per jam memang tidak diupah pada hari alpa; nominal tetap tetap dipotong bila dipilih. Izin/cuti tidak dibayar dipotong gaji pokok ÷ hari kerja.</small>
      </section>

      {message && <div className={message.ok ? "payroll-rules-ok" : "announcement-inline-error"}>{message.text}</div>}
      <div className="payroll-rules-actions">
        <Link className="btn btn-outline" href="/dashboard/karyawan/slip-gaji"><ArrowLeft size={15}/> Kembali</Link>
        <button className="btn btn-primary" disabled={pending}><Save size={15}/> {pending ? "Menyimpan..." : "Simpan Pengaturan"}</button>
      </div>
    </form>
  </>;
}

function formatMinutes(total: number) {
  const h = Math.floor(total / 60), m = total % 60;
  return [h ? `${h} jam` : "", m ? `${m} menit` : ""].filter(Boolean).join(" ") || "0 jam";
}
