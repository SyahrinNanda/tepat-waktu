"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";

type PayrollSettingsState = {
  status: "idle" | "success" | "error";
  message: string;
};

type PayrollSettingsValues = {
  note: string;
  leaveCalculation: boolean;
  countSickAsLeave: boolean;
  leaveSickPercentage: number;
  overtimeCalculation: boolean;
  showCompensationDeduction: boolean;
};

type Props = {
  values: PayrollSettingsValues;
  action: (previousState: PayrollSettingsState, formData: FormData) => Promise<PayrollSettingsState>;
};

const initialState: PayrollSettingsState = { status: "idle", message: "" };

function Toggle({ name, checked, onChange, label }: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className={`payroll-settings-switch ${checked ? "active" : "inactive"}`}>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
      <span aria-hidden="true" />
    </label>
  );
}

export function PayrollSettingsForm({ values, action }: Props) {
  const [result, formAction, pending] = useActionState(action, initialState);
  const [leaveCalculation, setLeaveCalculation] = useState(values.leaveCalculation);
  const [countSickAsLeave, setCountSickAsLeave] = useState(values.countSickAsLeave);
  const [overtimeCalculation, setOvertimeCalculation] = useState(values.overtimeCalculation);
  const [showCompensationDeduction, setShowCompensationDeduction] = useState(values.showCompensationDeduction);

  function handleLeaveCalculation(checked: boolean) {
    setLeaveCalculation(checked);
    if (!checked) setCountSickAsLeave(false);
  }

  return (
    <form action={formAction} className="payroll-settings-form">
      <h2>Pengaturan Payroll Perusahaan</h2>

      {result.status !== "idle" ? (
        <div className={`payroll-settings-notice ${result.status}`} role={result.status === "error" ? "alert" : "status"} aria-live="polite">
          {result.status === "success" ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}
          <span><strong>{result.status === "success" ? "Berhasil disimpan" : "Gagal menyimpan"}</strong><small>{result.message}</small></span>
        </div>
      ) : null}

      <div className="payroll-settings-row">
        <label htmlFor="payroll-note">Catatan Payroll</label>
        <input
          id="payroll-note"
          className="payroll-settings-input"
          name="note"
          defaultValue={values.note}
          placeholder="Catatan Payroll..."
          maxLength={1000}
        />
      </div>

      <div className="payroll-settings-row">
        <span>Perhitungan Cuti</span>
        <Toggle
          name="leaveCalculation"
          checked={leaveCalculation}
          onChange={handleLeaveCalculation}
          label="Perhitungan Cuti"
        />
      </div>

      {leaveCalculation ? (
        <div className="payroll-settings-dependent" aria-live="polite">
          <div className="payroll-settings-row nested">
            <span>Hitung Sakit Sebagai Cuti</span>
            <Toggle
              name="countSickAsLeave"
              checked={countSickAsLeave}
              onChange={setCountSickAsLeave}
              label="Hitung Sakit Sebagai Cuti"
            />
          </div>

          <div className="payroll-settings-row nested">
            <label htmlFor="leave-sick-percentage">Persentase perhitungan cuti/sakit</label>
            <div className="payroll-settings-number-wrap">
              <input
                id="leave-sick-percentage"
                className="payroll-settings-input"
                name="leaveSickPercentage"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={values.leaveSickPercentage}
              />
              <span>%</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="payroll-settings-row">
        <span>Perhitungan Lembur</span>
        <Toggle
          name="overtimeCalculation"
          checked={overtimeCalculation}
          onChange={setOvertimeCalculation}
          label="Perhitungan Lembur"
        />
      </div>

      <div className="payroll-settings-row">
        <span>Tampilkan Jumlah Kompensasi/Potongan</span>
        <Toggle
          name="showCompensationDeduction"
          checked={showCompensationDeduction}
          onChange={setShowCompensationDeduction}
          label="Tampilkan Jumlah Kompensasi atau Potongan"
        />
      </div>

      <div className="payroll-settings-actions">
        <button type="submit" disabled={pending}>{pending ? <><LoaderCircle className="spin" size={16} /> MENYIMPAN...</> : "SIMPAN"}</button>
      </div>
    </form>
  );
}
