"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { saveLeaveRules } from "@/features/leave-reports/server/actions";
import type { AnnualLeaveRules } from "@/features/leave-requests/annual-leave";

/** Company Cuti Tahunan rules (Master Data → Aturan Cuti). */
export function LeaveRulesForm({ rules }: { rules: AnnualLeaveRules }) {
  const router = useRouter();
  const [days, setDays] = useState(String(rules.days)), [eligibility, setEligibility] = useState(rules.eligibility);
  const [carryOver, setCarryOver] = useState(rules.carryOver), [carryOverMax, setCarryOverMax] = useState(rules.carryOverMax ? String(rules.carryOverMax) : "");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null), [pending, start] = useTransition();
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    start(async () => {
      const result = await saveLeaveRules({ days: Number(days), eligibility, carryOver, carryOverMax: carryOver && carryOverMax.trim() ? Number(carryOverMax) : null })
        .catch(() => ({ ok: false as const, error: "Server tidak dapat dihubungi." }));
      if (result.ok) { setNotice({ ok: true, text: "Aturan cuti tersimpan." }); router.refresh(); }
      else setNotice({ ok: false, text: result.error });
    });
  }
  return <form className="leave-rules-form leave-rules-page" onSubmit={submit}>
    <div className="leave-modal-body">
      <p className="leave-rules-intro">Setiap karyawan punya periode cuti sendiri yang dimulai dari <strong>tanggal bergabung</strong>. Jatah direset otomatis setiap ulang tahun kerjanya. Contoh: bergabung 15 Maret, maka periodenya 15 Maret – 14 Maret tahun berikutnya. Cuti dihitung dalam <strong>hari kerja</strong> sesuai jadwal jabatan.</p>
      <label>Jatah cuti per periode (hari kerja)<input type="number" min={0} max={60} value={days} onChange={(event) => setDays(event.target.value)} required/></label>
      <fieldset><legend>Karyawan baru mulai berhak cuti</legend>
        <label className="leave-rules-option"><input type="radio" name="eligibility" checked={eligibility === "immediate"} onChange={() => setEligibility("immediate")}/><span><strong>Langsung sejak tanggal bergabung</strong><small>Jatah penuh tersedia sejak hari pertama bekerja.</small></span></label>
        <label className="leave-rules-option"><input type="radio" name="eligibility" checked={eligibility === "after_one_year"} onChange={() => setEligibility("after_one_year")}/><span><strong>Setelah 12 bulan kerja</strong><small>Sesuai UU Ketenagakerjaan: tahun pertama belum ada jatah cuti tahunan.</small></span></label>
      </fieldset>
      <fieldset><legend>Sisa cuti saat periode direset</legend>
        <label className="leave-rules-option"><input type="radio" name="carry" checked={!carryOver} onChange={() => setCarryOver(false)}/><span><strong>Hangus</strong><small>Periode baru mulai dari jatah penuh lagi.</small></span></label>
        <label className="leave-rules-option"><input type="radio" name="carry" checked={carryOver} onChange={() => setCarryOver(true)}/><span><strong>Dibawa ke periode berikutnya</strong><small>Sisa ditambahkan ke jatah periode baru.</small></span></label>
        {carryOver && <label className="leave-rules-max">Maksimal sisa yang dibawa (hari kerja)<input type="number" min={1} max={60} value={carryOverMax} placeholder="Kosong = tanpa batas" onChange={(event) => setCarryOverMax(event.target.value)}/></label>}
      </fieldset>
      <p className="drawer-help">Perubahan berlaku langsung untuk semua karyawan, termasuk perhitungan sisa cuti periode berjalan. Jatah khusus per karyawan (Laporan Cuti → Ubah Jatah Periode Ini) tetap dipakai.</p>
      {notice && <div className={notice.ok ? "leave-rules-saved" : "announcement-inline-error"} role={notice.ok ? "status" : "alert"}>{notice.text}</div>}
    </div>
    <footer><span/><button className="btn btn-primary btn-sm" disabled={pending || days === ""}><Save size={14}/> {pending ? "Menyimpan..." : "Simpan Aturan"}</button></footer>
  </form>;
}
