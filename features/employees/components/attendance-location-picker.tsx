"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { MultiSelectDropdown } from "@/components/multi-select-dropdown";

export type LocationOption = { id: string; name: string; address: string; radiusMeters: number };

/**
 * "Lokasi Absen Karyawan": all company locations, or (unchecked) a searchable multi-select dropdown
 * of work locations. Picked ids are submitted as repeated `attendanceLocationIds` fields.
 */
export function AttendanceLocationPicker({ locations, defaultAll = true, defaultSelected = [] }: { locations: LocationOption[]; defaultAll?: boolean; defaultSelected?: string[] }) {
  const [all, setAll] = useState(defaultAll);
  const [selected, setSelected] = useState<string[]>(defaultSelected.filter((id) => locations.some((location) => location.id === id)));

  return <fieldset className="employee-location-choice">
    <legend>Lokasi Absen Karyawan</legend>
    <label><input name="allAttendanceLocations" type="checkbox" checked={all} onChange={(event) => setAll(event.target.checked)}/> Semua Lokasi Perusahaan</label>
    {!all && <div className="employee-location-select">
      <MultiSelectDropdown name="attendanceLocationIds" required
        requiredMessage={locations.length ? "Pilih minimal satu lokasi kerja." : "Belum ada lokasi kerja. Centang Semua Lokasi Perusahaan atau tambahkan lokasi dulu."}
        options={locations.map((location) => ({ value: location.id, label: location.name, description: `${location.address} · radius ${location.radiusMeters} m`, icon: <MapPin size={15} className="multi-select-icon"/> }))}
        selected={selected} onChange={setSelected} placeholder="Pilih lokasi kerja" searchPlaceholder="Cari nama atau alamat lokasi..."
        emptyText={<>Belum ada lokasi kerja aktif. <Link href="/dashboard/master/lokasi-presensi">Tambahkan di Master Data → Lokasi Kerja</Link>.</>}/>
    </div>}
  </fieldset>;
}
