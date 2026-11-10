"use client";

import {
  Loader2,
  MoreVertical,
  RotateCcw,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createUserLevelAction,
  deleteUserLevelAction,
  updateUserLevelAction,
  type UserLevelData,
} from "./actions";

type Props = {
  initialRoles: UserLevelData[];
};

const AVAILABLE_ACTIONS = [
  "Read (Lihat Data)",
  "Create (Tambah Data)",
  "Update (Ubah Data)",
  "Delete (Hapus Data)",
  "Export (Ekspor Data)",
];

export function RolesManager({ initialRoles }: Props) {
  const router = useRouter();
  const [roles, setRoles] = useState<UserLevelData[]>(initialRoles);
  const [filterName, setFilterName] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Active role for edit/delete
  const [selectedRole, setSelectedRole] = useState<UserLevelData | null>(null);

  // 3-dots menu popover state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Toast notice
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form states for Add Modal (Image 1)
  const [addForm, setAddForm] = useState({
    name: "",
    isAllPages: true,
    isAllDivisions: true,
    isAllActions: true,
    selectedActions: ["Read (Lihat Data)"],
  });

  // Form states for Edit Modal (Image 4)
  const [editForm, setEditForm] = useState({
    name: "",
    isAllPages: true,
    isAllDivisions: true,
    isAllActions: false,
    selectedActions: ["Read (Lihat Data)"],
  });

  // Close 3-dots menu on backdrop or action
  const toggleMenu = (id: string) => {
    setOpenMenuId((prev) => (prev === id ? null : id));
  };

  // Close menu on click outside without full-screen blocking overlay
  useEffect(() => {
    if (!openMenuId) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-role-menu]")) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [openMenuId]);

  // Filter roles by name
  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(filterName.trim().toLowerCase()),
  );

  // Reset filter
  const handleResetFilter = () => {
    setFilterName("");
  };

  // Open Edit Modal
  const openEditModal = (role: UserLevelData) => {
    setSelectedRole(role);
    setEditForm({
      name: role.name,
      isAllPages: role.isAllPages,
      isAllDivisions: role.isAllDivisions,
      isAllActions: role.isAllActions,
      selectedActions:
        role.selectedActions.length > 0
          ? role.selectedActions
          : ["Read (Lihat Data)"],
    });
    setOpenMenuId(null);
    setIsEditOpen(true);
  };

  // Open Delete Modal
  const openDeleteModal = (role: UserLevelData) => {
    setSelectedRole(role);
    setOpenMenuId(null);
    setIsDeleteOpen(true);
  };

  // Handle Add Submit
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) {
      setNotice({ type: "error", text: "Nama User Level wajib diisi." });
      return;
    }
    setNotice(null);
    startTransition(async () => {
      const res = await createUserLevelAction({
        name: addForm.name.trim(),
        isAllPages: addForm.isAllPages,
        selectedPages: [],
        isAllDivisions: addForm.isAllDivisions,
        selectedDivisions: [],
        isAllActions: addForm.isAllActions,
        selectedActions: addForm.isAllActions ? [] : addForm.selectedActions,
      });

      if (res.ok) {
        setIsAddOpen(false);
        setAddForm({
          name: "",
          isAllPages: true,
          isAllDivisions: true,
          isAllActions: true,
          selectedActions: ["Read (Lihat Data)"],
        });
        router.refresh();
        setNotice({
          type: "success",
          text: res.message || "User Level berhasil ditambahkan.",
        });
      } else {
        setNotice({
          type: "error",
          text: res.error || "Gagal menambahkan user level.",
        });
      }
    });
  };

  // Handle Edit Submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    if (!editForm.name.trim()) {
      setNotice({ type: "error", text: "Nama Level wajib diisi." });
      return;
    }
    setNotice(null);
    startTransition(async () => {
      const res = await updateUserLevelAction({
        id: selectedRole.id,
        name: editForm.name.trim(),
        isAllPages: editForm.isAllPages,
        selectedPages: selectedRole.selectedPages,
        isAllDivisions: editForm.isAllDivisions,
        selectedDivisions: selectedRole.selectedDivisions,
        isAllActions: editForm.isAllActions,
        selectedActions: editForm.isAllActions ? [] : editForm.selectedActions,
      });

      if (res.ok) {
        setIsEditOpen(false);
        router.refresh();
        setNotice({
          type: "success",
          text: res.message || "User Level berhasil diperbarui.",
        });
      } else {
        setNotice({
          type: "error",
          text: res.error || "Gagal memperbarui user level.",
        });
      }
    });
  };

  // Handle Delete Submit (Image 3)
  const handleDeleteSubmit = () => {
    if (!selectedRole) return;
    const roleToDelete = selectedRole;
    setNotice(null);
    startTransition(async () => {
      const res = await deleteUserLevelAction({ id: roleToDelete.id });
      if (res.ok) {
        setIsDeleteOpen(false);
        setSelectedRole(null);
        setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id));
        router.refresh();
        setNotice({
          type: "success",
          text: res.message || "User Level berhasil dihapus.",
        });
      } else {
        setNotice({
          type: "error",
          text: res.error || "Gagal menghapus user level.",
        });
      }
    });
  };

  // Toggle action in Add
  const toggleAddAction = (action: string) => {
    setAddForm((prev) => {
      const exists = prev.selectedActions.includes(action);
      return {
        ...prev,
        selectedActions: exists
          ? prev.selectedActions.filter((a) => a !== action)
          : [...prev.selectedActions, action],
      };
    });
  };

  // Toggle action in Edit
  const toggleEditAction = (action: string) => {
    setEditForm((prev) => {
      const exists = prev.selectedActions.includes(action);
      return {
        ...prev,
        selectedActions: exists
          ? prev.selectedActions.filter((a) => a !== action)
          : [...prev.selectedActions, action],
      };
    });
  };

  return (
    <div style={{ width: "100%", margin: "0 auto", paddingBottom: "60px" }}>
      {/* Header (Screenshot 1, 2) */}
      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            fontSize: "12.5px",
            color: "#787673",
            marginBottom: "4px",
            fontWeight: 500,
          }}
        >
          Kehadiran Admin Panel
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
          DAFTAR USER LEVEL
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
            href="/dashboard/pengaturan/users"
            style={{ color: "#787673", textDecoration: "none" }}
          >
            Manajemen User
          </Link>
          <span style={{ color: "#a8a6a3" }}>/</span>
          <span style={{ color: "#474541", fontWeight: 500 }}>
            Daftar User Level
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

      {/* Unified Card matching Screenshot 2: Filter Bar + Table */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #e9e8e7",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
          padding: "24px 28px 120px 28px",
          overflow: "visible",
        }}
      >
        {/* Filter and Action Bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {/* Left Filters */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "16px" }}>
            {/* Filter Nama Level */}
            <div>
              <label
                htmlFor="filter-role-name"
                style={{
                  display: "block",
                  fontSize: "12.5px",
                  color: "#787673",
                  marginBottom: "6px",
                  fontWeight: 500,
                }}
              >
                Filter Nama Level:
              </label>
              <input
                id="filter-role-name"
                type="text"
                placeholder="Nama Level..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                style={{
                  width: "280px",
                  height: "38px",
                  padding: "6px 12px",
                  fontSize: "13.5px",
                  border: "1px solid #d9d6d3",
                  borderRadius: "4px",
                  outline: "none",
                  backgroundColor: "#ffffff",
                  color: "#262421",
                }}
              />
            </div>

            {/* Atur Ulang Filter (Screenshot 2) */}
            <div>
              <div
                style={{
                  fontSize: "12.5px",
                  color: "#787673",
                  marginBottom: "6px",
                  fontWeight: 500,
                }}
              >
                Atur Ulang Filter:
              </div>
              <button
                type="button"
                onClick={handleResetFilter}
                style={{
                  height: "38px",
                  padding: "0 18px",
                  backgroundColor: "#dc3545",
                  border: "none",
                  borderRadius: "4px",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                  boxShadow: "0 1px 2px rgba(220, 53, 69, 0.2)",
                  transition: "background-color 0.15s ease",
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#c82333")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#dc3545")}
              >
                <RotateCcw size={14} />
                ATUR ULANG
              </button>
            </div>
          </div>

          {/* Right Action: + TAMBAH (Screenshot 1, 2) */}
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            style={{
              height: "38px",
              padding: "0 22px",
              backgroundColor: "#ef9905",
              border: "none",
              borderRadius: "4px",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              letterSpacing: "0.02em",
              boxShadow: "0 1px 2px rgba(239, 153, 5, 0.25)",
              transition: "background-color 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#df8f05")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#ef9905")}
          >
            + TAMBAH
          </button>
        </div>

        {/* Data Table (Screenshot 1, 2) */}
        <div style={{ overflow: "visible" }}>
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
                  backgroundColor: "#ffffff",
                }}
              >
                <th
                  style={{
                    padding: "12px 16px",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    color: "#262421",
                    width: "48px",
                  }}
                >
                  #
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    color: "#262421",
                  }}
                >
                  Nama Level
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    color: "#262421",
                  }}
                >
                  Akses Halaman
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    color: "#262421",
                  }}
                >
                  Akses Divisi
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    color: "#262421",
                  }}
                >
                  Akses Aksi
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    color: "#262421",
                    width: "70px",
                    textAlign: "center",
                  }}
                >
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "36px",
                      textAlign: "center",
                      color: "#787673",
                      fontSize: "14px",
                    }}
                  >
                    Tidak ada data user level ditemukan.
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role, idx) => (
                  <tr
                    key={role.id}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#f2f2f2" : "#ffffff",
                    }}
                  >
                    {/* # Index */}
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "13.5px",
                        fontWeight: 700,
                        color: "#262421",
                      }}
                    >
                      {idx + 1}
                    </td>

                    {/* Nama Level */}
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "13.5px",
                        color: "#262421",
                        fontWeight: 400,
                      }}
                    >
                      {role.name}
                    </td>

                    {/* Akses Halaman */}
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "13.5px",
                        color: "#5a5854",
                        fontWeight: 400,
                      }}
                    >
                      {role.accessPages}
                    </td>

                    {/* Akses Divisi */}
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "13.5px",
                        color: "#5a5854",
                        fontWeight: 400,
                      }}
                    >
                      {role.accessDivisions}
                    </td>

                    {/* Akses Aksi */}
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "13.5px",
                        color: "#5a5854",
                        fontWeight: 400,
                      }}
                    >
                      {role.accessActions}
                    </td>

                    {/* Aksi Column */}
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        position: "relative",
                      }}
                    >
                      {role.isSystem ? null : (
                        <div
                          data-role-menu
                          style={{
                            position: "relative",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleMenu(role.id)}
                            aria-label="Aksi"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px 6px",
                              color: "#262421",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "4px",
                              outline: "none",
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>

                          {/* Popover Dropdown matching Screenshot 2 */}
                          {openMenuId === role.id && (
                            <div
                            data-float-menu
                              style={{
                                position: "absolute",
                                top: "calc(100% + 18px)",
                                right: "-12px",
                                width: "74px",
                                backgroundColor: "#ffffff",
                                borderRadius: "4px",
                                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
                                zIndex: 100,
                                padding: "8px 0",
                                textAlign: "left",
                              }}
                            >
                              {/* Triangle arrow pointer at top */}
                              <div
                                style={{
                                  position: "absolute",
                                  top: "-5px",
                                  right: "21px",
                                  width: "10px",
                                  height: "10px",
                                  backgroundColor: "#ffffff",
                                  transform: "rotate(45deg)",
                                  boxShadow: "-1px -1px 2px rgba(0, 0, 0, 0.04)",
                                  zIndex: 1,
                                }}
                              />

                              <div style={{ position: "relative", zIndex: 2 }}>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(role)}
                                  style={{
                                    width: "100%",
                                    padding: "6px 16px",
                                    background: "none",
                                    border: "none",
                                    textAlign: "left",
                                    fontSize: "13px",
                                    color: "#474541",
                                    cursor: "pointer",
                                    display: "block",
                                    lineHeight: 1.3,
                                    fontWeight: 400,
                                  }}
                                  onMouseOver={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "#fafafa")
                                  }
                                  onMouseOut={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "transparent")
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openDeleteModal(role)}
                                  style={{
                                    width: "100%",
                                    padding: "6px 16px",
                                    background: "none",
                                    border: "none",
                                    textAlign: "left",
                                    fontSize: "13px",
                                    color: "#dc3545",
                                    cursor: "pointer",
                                    display: "block",
                                    lineHeight: 1.3,
                                    fontWeight: 400,
                                  }}
                                  onMouseOver={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "#fafafa")
                                  }
                                  onMouseOut={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "transparent")
                                  }
                                >
                                  Hapus
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: Tambah User Level (Screenshot 1) */}
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
              maxWidth: "560px",
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
                Tambah User Level
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
                {/* Nama User Level */}
                <div>
                  <label
                    htmlFor="add-role-name"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "6px",
                    }}
                  >
                    Nama User Level
                  </label>
                  <input
                    id="add-role-name"
                    type="text"
                    required
                    placeholder="Nama User Level..."
                    value={addForm.name}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, name: e.target.value }))
                    }
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

                {/* Akses Halaman Level User */}
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "8px",
                    }}
                  >
                    Akses Halaman Level User
                  </div>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13.5px",
                      color: "#262421",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={addForm.isAllPages}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          isAllPages: e.target.checked,
                        }))
                      }
                      style={{
                        width: "16px",
                        height: "16px",
                        accentColor: "#faa005",
                      }}
                    />
                    <span>Seluruh Akses Halaman</span>
                  </label>
                </div>

                {/* Akses Divisi Karyawan */}
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "8px",
                    }}
                  >
                    Akses Divisi Karyawan
                  </div>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13.5px",
                      color: "#262421",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={addForm.isAllDivisions}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          isAllDivisions: e.target.checked,
                        }))
                      }
                      style={{
                        width: "16px",
                        height: "16px",
                        accentColor: "#faa005",
                      }}
                    />
                    <span>Seluruh Akses Divisi</span>
                  </label>
                </div>

                {/* Akses Aksi Level User */}
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "8px",
                    }}
                  >
                    Akses Aksi Level User
                  </div>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13.5px",
                      color: "#262421",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={addForm.isAllActions}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          isAllActions: e.target.checked,
                        }))
                      }
                      style={{
                        width: "16px",
                        height: "16px",
                        accentColor: "#faa005",
                      }}
                    />
                    <span>Seluruh Akses Aksi</span>
                  </label>

                  {/* Multi-action chips if not all actions */}
                  {!addForm.isAllActions && (
                    <div style={{ marginTop: "10px" }}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          padding: "8px 12px",
                          border: "1px solid #d9d6d3",
                          borderRadius: "6px",
                          minHeight: "42px",
                          alignItems: "center",
                        }}
                      >
                        {addForm.selectedActions.map((action) => (
                          <span
                            key={action}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              backgroundColor: "#f6f5f4",
                              color: "#484540",
                              border: "1px solid #d9d6d3",
                              borderRadius: "4px",
                              padding: "3px 8px",
                              fontSize: "13px",
                            }}
                          >
                            {action}
                            <button
                              type="button"
                              onClick={() => toggleAddAction(action)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                color: "#7c7873",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                      </div>

                      {/* Dropdown to add action */}
                      <div style={{ marginTop: "8px" }}>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              toggleAddAction(e.target.value);
                            }
                          }}
                          style={{
                            width: "100%",
                            height: "36px",
                            padding: "6px 12px",
                            fontSize: "13px",
                            border: "1px solid #d9d6d3",
                            borderRadius: "6px",
                            backgroundColor: "#ffffff",
                            color: "#5c5954",
                          }}
                        >
                          <option value="">+ Pilih Aksi Tambahan</option>
                          {AVAILABLE_ACTIONS.filter(
                            (a) => !addForm.selectedActions.includes(a),
                          ).map((act) => (
                            <option key={act} value={act}>
                              {act}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
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
                  disabled={isPending}
                  style={{
                    padding: "8px 22px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "#faa005",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#fff",
                    cursor: isPending ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
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
      {/* MODAL 2: Edit User Level (Screenshot 4) */}
      {/* ========================================================================= */}
      {isEditOpen && selectedRole && (
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
          onClick={() => setIsEditOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "560px",
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
                Edit User Level
              </h2>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
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
            <form onSubmit={handleEditSubmit}>
              <div
                style={{
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                {/* Nama Level */}
                <div>
                  <label
                    htmlFor="edit-role-name"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "6px",
                    }}
                  >
                    Nama Level
                  </label>
                  <input
                    id="edit-role-name"
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, name: e.target.value }))
                    }
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

                {/* Akses Halaman Level User */}
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "8px",
                    }}
                  >
                    Akses Halaman Level User
                  </div>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13.5px",
                      color: "#262421",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editForm.isAllPages}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          isAllPages: e.target.checked,
                        }))
                      }
                      style={{
                        width: "16px",
                        height: "16px",
                        accentColor: "#faa005",
                      }}
                    />
                    <span>Seluruh Akses Halaman</span>
                  </label>
                </div>

                {/* Akses Divisi Karyawan */}
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "8px",
                    }}
                  >
                    Akses Divisi Karyawan
                  </div>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13.5px",
                      color: "#262421",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editForm.isAllDivisions}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          isAllDivisions: e.target.checked,
                        }))
                      }
                      style={{
                        width: "16px",
                        height: "16px",
                        accentColor: "#faa005",
                      }}
                    />
                    <span>Seluruh Akses Divisi</span>
                  </label>
                </div>

                {/* Akses Aksi Level User (Screenshot 4) */}
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "8px",
                    }}
                  >
                    Akses Aksi Level User
                  </div>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13.5px",
                      color: "#262421",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editForm.isAllActions}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          isAllActions: e.target.checked,
                        }))
                      }
                      style={{
                        width: "16px",
                        height: "16px",
                        accentColor: "#faa005",
                      }}
                    />
                    <span>Seluruh Akses Aksi</span>
                  </label>

                  {/* Multi-action chips input (Screenshot 4) */}
                  {!editForm.isAllActions && (
                    <div style={{ marginTop: "10px" }}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          padding: "8px 12px",
                          border: "1px solid #d9d6d3",
                          borderRadius: "6px",
                          minHeight: "44px",
                          alignItems: "center",
                          backgroundColor: "#ffffff",
                        }}
                      >
                        {editForm.selectedActions.map((action) => (
                          <span
                            key={action}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              backgroundColor: "#ffffff",
                              color: "#262421",
                              border: "1px solid #d9d6d3",
                              borderRadius: "4px",
                              padding: "4px 10px",
                              fontSize: "13px",
                            }}
                          >
                            {action}
                            <button
                              type="button"
                              onClick={() => toggleEditAction(action)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                color: "#7c7873",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                      </div>

                      {/* Dropdown to add action */}
                      <div style={{ marginTop: "8px" }}>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              toggleEditAction(e.target.value);
                            }
                          }}
                          style={{
                            width: "100%",
                            height: "36px",
                            padding: "6px 12px",
                            fontSize: "13px",
                            border: "1px solid #d9d6d3",
                            borderRadius: "6px",
                            backgroundColor: "#ffffff",
                            color: "#5c5954",
                          }}
                        >
                          <option value="">+ Tambah Aksi Lainnya</option>
                          {AVAILABLE_ACTIONS.filter(
                            (a) => !editForm.selectedActions.includes(a),
                          ).map((act) => (
                            <option key={act} value={act}>
                              {act}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
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
                  onClick={() => setIsEditOpen(false)}
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
                  disabled={isPending}
                  style={{
                    padding: "8px 22px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "#faa005",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#fff",
                    cursor: isPending ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
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
      {/* MODAL 3: Pemberitahuan Hapus User Level (Screenshot 3) */}
      {/* ========================================================================= */}
      {isDeleteOpen && selectedRole && (
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
            {/* Warning Circle Icon (Screenshot 3) */}
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

            {/* Title (Screenshot 3) */}
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

            {/* Subtitle (Screenshot 3) */}
            <p
              style={{
                fontSize: "14px",
                color: "#7c7873",
                margin: "0 0 24px 0",
              }}
            >
              Anda yakin ingin menghapus?
            </p>

            {/* Action Buttons (Screenshot 3) */}
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
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: isPending ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "background-color 0.15s ease",
                  minWidth: "90px",
                  justifyContent: "center",
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
