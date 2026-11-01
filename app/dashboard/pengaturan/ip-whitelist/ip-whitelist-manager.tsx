"use client";

import {
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createIpWhitelistAction,
  deleteIpWhitelistAction,
  type IpWhitelistItem,
} from "./actions";

type Props = {
  initialItems: IpWhitelistItem[];
};

type InputType = "" | "satuan_wildcard" | "rentang";

export function IpWhitelistManager({ initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<IpWhitelistItem[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<IpWhitelistItem | null>(null);

  // Notice Toast
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form states for Add Modal (Screenshots 6, 7, 8)
  const [inputType, setInputType] = useState<InputType>("");
  const [singleIps, setSingleIps] = useState<string[]>([""]);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  // Filter items by IP
  const filteredItems = items.filter((item) =>
    item.ip.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  // Reset search
  const handleRefresh = () => {
    setSearchQuery("");
    router.refresh();
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setInputType("");
    setSingleIps([""]);
    setRangeFrom("");
    setRangeTo("");
    setIsAddOpen(true);
  };

  // Dynamic add IP input (Screenshot 7)
  const addSingleIpRow = () => {
    setSingleIps((prev) => [...prev, ""]);
  };

  // Remove dynamic IP input
  const removeSingleIpRow = (index: number) => {
    setSingleIps((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update dynamic IP value
  const updateSingleIpValue = (index: number, val: string) => {
    setSingleIps((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  // Open Delete Modal
  const openDeleteModal = (item: IpWhitelistItem) => {
    setSelectedItem(item);
    setIsDeleteOpen(true);
  };

  // Handle Add Submit (Screenshots 6, 7, 8)
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputType) {
      setNotice({ type: "error", text: "Silakan pilih tipe input IP terlebih dahulu." });
      return;
    }

    setNotice(null);
    startTransition(async () => {
      let res;
      if (inputType === "satuan_wildcard") {
        const validIps = singleIps.map((s) => s.trim()).filter((s) => s.length > 0);
        if (validIps.length === 0) {
          setNotice({ type: "error", text: "Masukkan minimal satu IP." });
          return;
        }
        res = await createIpWhitelistAction({
          type: "satuan_wildcard",
          ips: validIps,
        });
      } else {
        if (!rangeFrom.trim() || !rangeTo.trim()) {
          setNotice({
            type: "error",
            text: "Field Dari dan Sampai wajib diisi.",
          });
          return;
        }
        res = await createIpWhitelistAction({
          type: "rentang",
          rangeFrom: rangeFrom.trim(),
          rangeTo: rangeTo.trim(),
        });
      }

      if (res.ok) {
        setIsAddOpen(false);
        setInputType("");
        setSingleIps([""]);
        setRangeFrom("");
        setRangeTo("");
        router.refresh();
        setNotice({
          type: "success",
          text: res.message || "IP Whitelist berhasil ditambahkan.",
        });
      } else {
        setNotice({
          type: "error",
          text: res.error || "Gagal menambahkan IP Whitelist.",
        });
      }
    });
  };

  // Handle Delete Submit (Screenshot 3 style)
  const handleDeleteSubmit = () => {
    if (!selectedItem) return;
    const itemToDelete = selectedItem;
    setNotice(null);
    startTransition(async () => {
      const res = await deleteIpWhitelistAction({ id: itemToDelete.id });
      if (res.ok) {
        setIsDeleteOpen(false);
        setSelectedItem(null);
        setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
        router.refresh();
        setNotice({
          type: "success",
          text: res.message || "IP Whitelist berhasil dihapus.",
        });
      } else {
        setNotice({
          type: "error",
          text: res.error || "Gagal menghapus IP Whitelist.",
        });
      }
    });
  };

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", paddingBottom: "60px" }}>
      {/* Header (Screenshot 5) */}
      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            fontSize: "12.5px",
            color: "#787673",
            marginBottom: "4px",
            fontWeight: 500,
          }}
        >
          Presensi Admin Panel
        </div>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 800,
            color: "#181615",
            letterSpacing: "0.02em",
            margin: "0 0 6px 0",
          }}
        >
          DAFTAR IP WHITELIST
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            color: "#5a5854",
          }}
        >
          <Link
            href="/dashboard"
            style={{ color: "#787673", textDecoration: "none" }}
          >
            Beranda
          </Link>
          <span style={{ color: "#a8a6a3" }}>/</span>
          <Link
            href="/dashboard/pengaturan/profile"
            style={{ color: "#787673", textDecoration: "none" }}
          >
            Settings
          </Link>
          <span style={{ color: "#a8a6a3" }}>/</span>
          <span style={{ color: "#474541", fontWeight: 500 }}>
            Daftar IP Whitelist
          </span>
        </div>
      </div>

      {/* Notice Toast */}
      {notice && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "8px",
            marginBottom: "18px",
            fontSize: "14px",
            fontWeight: 500,
            backgroundColor: notice.type === "success" ? "#ecfdf5" : "#fef2f2",
            color: notice.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${notice.type === "success" ? "#a7f3d0" : "#fecaca"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "inherit",
              padding: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search and Action Bar (Screenshot 5) */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e9e8e7",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
          padding: "20px 24px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          {/* Left: Search input + refresh button (Screenshot 5) */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#aba7a1",
                }}
              />
              <input
                type="text"
                placeholder="Cari IP + (ex : 192.168.1.x)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "300px",
                  height: "38px",
                  padding: "6px 12px 6px 36px",
                  fontSize: "13.5px",
                  border: "1px solid #d9d6d3",
                  borderRadius: "6px",
                  outline: "none",
                  backgroundColor: "#ffffff",
                  color: "#262421",
                }}
              />
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              title="Muat ulang data"
              style={{
                width: "38px",
                height: "38px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ffffff",
                border: "1px solid #d9d6d3",
                borderRadius: "6px",
                color: "#5c5954",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                transition: "background-color 0.15s ease",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = "#fafafa")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = "#ffffff")
              }
            >
              <RotateCcw size={16} />
            </button>
          </div>

          {/* Right Action: + Tambah IP Whitelist (Screenshot 5) */}
          <button
            type="button"
            onClick={handleOpenAdd}
            style={{
              height: "38px",
              padding: "0 20px",
              backgroundColor: "#e19005",
              border: "none",
              borderRadius: "6px",
              color: "#1a1a1a",
              fontSize: "13px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              letterSpacing: "0.02em",
              boxShadow: "0 1px 2px rgba(225, 144, 5, 0.25)",
              transition: "background-color 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#cd8304")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#e19005")}
          >
            + Tambah IP Whitelist
          </button>
        </div>
      </div>

      {/* Data Table Card (Screenshot 5) */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e9e8e7",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
          marginBottom: "16px",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid #e9e8e7",
                  backgroundColor: "#ffffff",
                }}
              >
                <th
                  style={{
                    padding: "16px 20px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#262421",
                    width: "50px",
                  }}
                >
                  #
                </th>
                <th
                  style={{
                    padding: "16px 20px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#262421",
                  }}
                >
                  IP Whitelist
                </th>
                <th
                  style={{
                    padding: "16px 20px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#262421",
                  }}
                >
                  Tanggal dibuat
                </th>
                <th
                  style={{
                    padding: "16px 20px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#262421",
                  }}
                >
                  Tanggal diubah
                </th>
                <th
                  style={{
                    padding: "16px 20px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#262421",
                    width: "100px",
                    textAlign: "center",
                  }}
                >
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "48px 20px",
                      textAlign: "center",
                      color: "#787673",
                      fontSize: "14px",
                    }}
                  >
                    Tidak ada data IP Whitelist ditemukan.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: "1px solid #f6f5f4",
                      backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fdfdfd",
                      transition: "background-color 0.15s ease",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.backgroundColor = "#fafafa")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        idx % 2 === 0 ? "#ffffff" : "#fdfdfd")
                    }
                  >
                    {/* # Index */}
                    <td
                      style={{
                        padding: "16px 20px",
                        fontSize: "13.5px",
                        fontWeight: 600,
                        color: "#474541",
                      }}
                    >
                      {idx + 1}
                    </td>

                    {/* IP Whitelist */}
                    <td
                      style={{
                        padding: "16px 20px",
                        fontSize: "13.5px",
                        color: "#181615",
                        fontWeight: 500,
                      }}
                    >
                      {item.ip}
                    </td>

                    {/* Tanggal dibuat */}
                    <td
                      style={{
                        padding: "16px 20px",
                        fontSize: "13.5px",
                        color: "#5c5954",
                      }}
                    >
                      {item.createdAt}
                    </td>

                    {/* Tanggal diubah */}
                    <td
                      style={{
                        padding: "16px 20px",
                        fontSize: "13.5px",
                        color: "#5c5954",
                      }}
                    >
                      {item.updatedAt}
                    </td>

                    {/* Aksi */}
                    <td
                      style={{
                        padding: "16px 20px",
                        textAlign: "center",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openDeleteModal(item)}
                        title="Hapus IP Whitelist"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#d9534f",
                          padding: "6px",
                          borderRadius: "4px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.backgroundColor = "#fee2e2")
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "transparent")
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination / Data Counter (Screenshot 5) */}
      <div
        style={{
          fontSize: "13.5px",
          color: "#5c5954",
          paddingLeft: "4px",
        }}
      >
        Menampilkan {filteredItems.length} dari Data.
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: Tambah IP Whitelist (Screenshots 6, 7, 8) */}
      {/* ========================================================================= */}
      {isAddOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setIsAddOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "640px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #f6f5f4",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#262421",
                }}
              >
                Tambah IP Whitelist
              </h2>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#7c7873",
                  padding: "4px",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleAddSubmit}>
              <div
                style={{
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                {/* Pilih tipe input IP (Screenshot 8) */}
                <div>
                  <label
                    htmlFor="select-ip-type"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "6px",
                    }}
                  >
                    Pilih tipe input IP
                  </label>
                  <select
                    id="select-ip-type"
                    value={inputType}
                    onChange={(e) => setInputType(e.target.value as InputType)}
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "8px 12px",
                      fontSize: "13.5px",
                      border: "1px solid #d9d6d3",
                      borderRadius: "6px",
                      outline: "none",
                      backgroundColor: "#ffffff",
                      color: "#262421",
                    }}
                  >
                    <option value="">Pilih tipe input IP</option>
                    <option value="satuan_wildcard">
                      input satuan atau wildcard (x)
                    </option>
                    <option value="rentang">input rentang</option>
                  </select>
                </div>

                {/* Mode 1: input satuan atau wildcard (x) (Screenshot 7) */}
                {inputType === "satuan_wildcard" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {singleIps.map((ipVal, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <div
                          style={{
                            width: "48px",
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "#474541",
                          }}
                        >
                          IP {idx + 1}
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="Masukkan IP (ex : 192.168.1.x)"
                          value={ipVal}
                          onChange={(e) => updateSingleIpValue(idx, e.target.value)}
                          style={{
                            flex: 1,
                            height: "40px",
                            padding: "8px 12px",
                            fontSize: "13.5px",
                            border: "1px solid #d9d6d3",
                            borderRadius: "6px",
                            outline: "none",
                          }}
                        />
                        {/* If first row: Add button (Screenshot 7) */}
                        {idx === 0 ? (
                          <button
                            type="button"
                            onClick={addSingleIpRow}
                            title="Tambah baris IP"
                            style={{
                              width: "38px",
                              height: "38px",
                              backgroundColor: "#faa005",
                              border: "none",
                              borderRadius: "6px",
                              color: "#1a1a1a",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              transition: "background-color 0.15s ease",
                            }}
                            onMouseOver={(e) =>
                              (e.currentTarget.style.backgroundColor = "#e79405")
                            }
                            onMouseOut={(e) =>
                              (e.currentTarget.style.backgroundColor = "#faa005")
                            }
                          >
                            <Plus size={18} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => removeSingleIpRow(idx)}
                            title="Hapus baris IP"
                            aria-label={`Hapus IP ${idx + 1}`}
                            style={{
                              width: "38px",
                              height: "38px",
                              flex: "0 0 38px",
                              backgroundColor: "#dc3545",
                              border: "none",
                              borderRadius: "6px",
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                            }}
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Mode 2: input rentang (Screenshot 6) */}
                {inputType === "rentang" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <label
                        htmlFor="range-from"
                        style={{
                          display: "block",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#474541",
                          marginBottom: "6px",
                        }}
                      >
                        Dari
                      </label>
                      <input
                        id="range-from"
                        type="text"
                        required
                        placeholder="Masukkan IP (ex : 192.168.1.x)"
                        value={rangeFrom}
                        onChange={(e) => setRangeFrom(e.target.value)}
                        style={{
                          width: "100%",
                          height: "40px",
                          padding: "8px 12px",
                          fontSize: "13.5px",
                          border: "1px solid #d9d6d3",
                          borderRadius: "6px",
                          outline: "none",
                        }}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="range-to"
                        style={{
                          display: "block",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#474541",
                          marginBottom: "6px",
                        }}
                      >
                        Sampai
                      </label>
                      <input
                        id="range-to"
                        type="text"
                        required
                        placeholder="Masukkan IP (ex : 192.168.1.x)"
                        value={rangeTo}
                        onChange={(e) => setRangeTo(e.target.value)}
                        style={{
                          width: "100%",
                          height: "40px",
                          padding: "8px 12px",
                          fontSize: "13.5px",
                          border: "1px solid #d9d6d3",
                          borderRadius: "6px",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid #f6f5f4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "6px",
                    border: "1px solid #d9d6d3",
                    backgroundColor: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#5c5954",
                    cursor: "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !inputType}
                  style={{
                    padding: "8px 22px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "#faa005",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#1a1a1a",
                    cursor: isPending || !inputType ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    opacity: !inputType ? 0.6 : 1,
                  }}
                >
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Pemberitahuan Hapus IP Whitelist (Screenshot 3 style) */}
      {/* ========================================================================= */}
      {isDeleteOpen && selectedItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setIsDeleteOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              padding: "36px 28px 28px 28px",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning Circle Icon */}
            <div
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "50%",
                border: "3px solid #f97316",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px auto",
              }}
            >
              <span
                style={{
                  fontSize: "36px",
                  color: "#f97316",
                  fontWeight: 300,
                  lineHeight: 1,
                }}
              >
                !
              </span>
            </div>

            {/* Title */}
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#262421",
                margin: "0 0 10px 0",
              }}
            >
              Pemberitahuan!
            </h2>

            {/* Subtitle */}
            <p
              style={{
                fontSize: "14px",
                color: "#7c7873",
                margin: "0 0 24px 0",
              }}
            >
              Anda yakin ingin menghapus?
            </p>

            {/* Action Buttons */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
              }}
            >
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isPending}
                style={{
                  padding: "8px 28px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#faa005",
                  color: "#1a1a1a",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: isPending ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  minWidth: "90px",
                  justifyContent: "center",
                  transition: "background-color 0.15s ease",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.backgroundColor = "#e79405")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.backgroundColor = "#faa005")
                }
              >
                {isPending && <Loader2 size={14} className="animate-spin" />}
                Ya
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                style={{
                  padding: "8px 28px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#777572",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  minWidth: "90px",
                  justifyContent: "center",
                  transition: "background-color 0.15s ease",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.backgroundColor = "#63615f")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.backgroundColor = "#777572")
                }
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
