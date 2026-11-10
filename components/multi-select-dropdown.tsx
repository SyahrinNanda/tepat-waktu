"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type MultiSelectOption = { value: string; label: string; description?: string; icon?: ReactNode };

/**
 * Dropdown with a search box and a checkbox list; several values can be picked.
 * - `name`: also submits each selected value as a hidden form field.
 * - `required` + `requiredMessage`: blocks native form submit while nothing is selected.
 * - `badge(value, index)`: extra tag after a selected option (e.g. "Utama" for the first one).
 */
export function MultiSelectDropdown({ options, selected, onChange, placeholder = "Pilih...", searchPlaceholder = "Cari...", emptyText = "Tidak ada pilihan.", name, required = false, requiredMessage = "Pilih minimal satu.", badge, id }: {
  options: MultiSelectOption[]; selected: string[]; onChange: (values: string[]) => void;
  placeholder?: string; searchPlaceholder?: string; emptyText?: ReactNode; name?: string;
  required?: boolean; requiredMessage?: string; badge?: (value: string, index: number) => ReactNode; id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const validityRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const byValue = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter((option) => `${option.label} ${option.description ?? ""}`.toLowerCase().includes(needle)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    searchRef.current?.focus();
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => { validityRef.current?.setCustomValidity(required && !selected.length ? requiredMessage : ""); }, [required, selected.length, requiredMessage]);

  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  const visibleValues = filtered.map((option) => option.value);
  const allVisibleSelected = visibleValues.length > 0 && visibleValues.every((value) => selected.includes(value));

  return <div className={`multi-select ${open ? "is-open" : ""}`} ref={rootRef} onKeyDown={(event) => { if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); } }}>
    <button type="button" id={id} className="multi-select-trigger" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>
      <span className="multi-select-values">
        {selected.length ? selected.map((value, index) => <span className="multi-select-chip" key={value}>
          {byValue.get(value)?.label ?? value}{badge?.(value, index)}
          <span role="button" tabIndex={-1} aria-label={`Hapus ${byValue.get(value)?.label ?? value}`} onClick={(event) => { event.stopPropagation(); toggle(value); }}><X size={12}/></span>
        </span>) : <span className="multi-select-placeholder">{placeholder}</span>}
      </span>
      <ChevronDown size={16} className="multi-select-arrow"/>
    </button>
    {/* Invisible but focusable, so the browser can show the "required" message next to the dropdown. */}
    <input ref={validityRef} className="multi-select-validity" tabIndex={-1} aria-hidden="true" value={selected.length ? "ok" : ""} onChange={() => undefined} onFocus={() => setOpen(true)}/>
    {name && selected.map((value) => <input key={value} type="hidden" name={name} value={value}/>)}
    {open && <div className="multi-select-panel">
      <div className="multi-select-search"><Search size={15}/><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder}/></div>
      {options.length > 0 && <div className="multi-select-actions">
        <span>{selected.length} dipilih</span>
        <button type="button" onClick={() => onChange(allVisibleSelected ? selected.filter((value) => !visibleValues.includes(value)) : [...selected, ...visibleValues.filter((value) => !selected.includes(value))])}>{allVisibleSelected ? "Kosongkan" : "Pilih semua"}</button>
      </div>}
      <ul id={listId} role="listbox" aria-multiselectable="true" className="multi-select-list">
        {filtered.map((option) => {
          const index = selected.indexOf(option.value);
          return <li key={option.value} role="option" aria-selected={index >= 0}>
            <label className={index >= 0 ? "is-checked" : ""}>
              <input type="checkbox" checked={index >= 0} onChange={() => toggle(option.value)}/>
              <span className="multi-select-box" aria-hidden="true">{index >= 0 && <Check size={12} strokeWidth={3}/>}</span>
              {option.icon}
              <span className="multi-select-text"><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
              {index >= 0 && badge?.(option.value, index)}
            </label>
          </li>;
        })}
        {!filtered.length && <li className="multi-select-empty">{options.length ? "Tidak ditemukan." : emptyText}</li>}
      </ul>
    </div>}
  </div>;
}
