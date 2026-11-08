"use client";

import {
  Eye,
  EyeOff,
  Info,
  Loader2,
  MoreVertical,
  RotateCcw,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createCompanyUserAction,
  deleteCompanyUserAction,
  resendInvitationAction,
  toggleUserOtpAction,
  toggleUserStatusAction,
  updateCompanyUserAction,
  updateUserPasswordAction,
  type CompanyUserData,
  type RoleValue,
} from "./actions";

type Props = {
  initialUsers: CompanyUserData[];
  currentUserId: string;
  /** Only a superadmin may change the status of Administrator accounts. */
  viewerIsSuperAdmin?: boolean;
};

type Notice = { type: "success" | "error"; text: string };

/**
 * The page keys this component by the user list, so router.refresh() after adding or deleting a
 * user remounts it and would drop the feedback message. The last message is carried over the
 * remount for a few seconds (and only once).
 */
let carriedNotice: { notice: Notice; at: number } | null = null;
function takeCarriedNotice() {
  const carried = carriedNotice;
  carriedNotice = null;
  return carried && Date.now() - carried.at < 10_000 ? carried.notice : null;
}
/** Called from event handlers only (never during render). */
function carryNotice(notice: Notice | null) {
  carriedNotice = notice ? { notice, at: Date.now() } : null;
}

export function UsersManager({ initialUsers, currentUserId, viewerIsSuperAdmin = false }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<CompanyUserData[]>(initialUsers);
  const [searchName, setSearchName] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Active user for edit / password / delete
  const [selectedUser, setSelectedUser] = useState<CompanyUserData | null>(null);

  // Active context menu (dropdown)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Notice / Feedback toast
  const [notice, setNoticeState] = useState<Notice | null>(takeCarriedNotice);
  const setNotice = (next: Notice | null) => {
    carryNotice(next);
    setNoticeState(next);
  };

  // Form states for Add
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "" as RoleValue | "",
    // On by default: the user sets their own password from an emailed link.
    sendInvite: true,
  });
  const [showAddPassword, setShowAddPassword] = useState(false);

  const handleResendInvite = (user: CompanyUserData) => {
    setOpenMenuId(null);
    setNotice(null);
    startTransition(async () => {
      const res = await resendInvitationAction({ memberId: user.id });
      if (res.ok) router.refresh();
      setNotice(res.ok
        ? { type: "success", text: res.message || "Undangan dikirim ulang." }
        : { type: "error", text: res.error || "Gagal mengirim ulang undangan." });
    });
  };

  // Form states for Edit
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "employee" as RoleValue,
  });

  // Form states for Change Password
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Close context menu when clicking outside
  useEffect(() => {
    function handleClickOutside() {
      setOpenMenuId(null);
    }
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Filtered users by name
  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchName.trim().toLowerCase()),
  );

  // Handlers for Modals
  const openEditModal = (user: CompanyUserData) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
    });
    setOpenMenuId(null);
    setIsEditOpen(true);
  };

  const openPasswordModal = (user: CompanyUserData) => {
    setSelectedUser(user);
    setPasswordForm({ newPassword: "", confirmPassword: "" });
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setOpenMenuId(null);
    setIsPasswordOpen(true);
  };

  const openDeleteModal = (user: CompanyUserData) => {
    if (user.userId === currentUserId) {
      setNotice({
        type: "error",
        text: "Anda tidak dapat menghapus akun sendiri.",
      });
      setOpenMenuId(null);
      return;
    }
    setSelectedUser(user);
    setOpenMenuId(null);
    setIsDeleteOpen(true);
  };

  // Toggle Status Handler
  const handleToggleStatus = (user: CompanyUserData) => {
    if (user.userId === currentUserId && user.isActive) {
      setNotice({
        type: "error",
        text: "Anda tidak dapat menonaktifkan status akun sendiri.",
      });
      return;
    }
    const nextState = !user.isActive;
    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, isActive: nextState } : u)),
    );
    startTransition(async () => {
      const res = await toggleUserStatusAction({
        memberId: user.id,
        isActive: nextState,
      });
      if (!res.ok) {
        // Revert on error
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id ? { ...u, isActive: user.isActive } : u,
          ),
        );
        setNotice({
          type: "error",
          text: res.error || "Gagal mengubah status user.",
        });
      } else {
        router.refresh();
        setNotice({
          type: "success",
          text: res.message || "Status berhasil diubah.",
        });
      }
    });
  };

  // Toggle OTP Handler
  const handleToggleOtp = (user: CompanyUserData) => {
    const nextState = !user.isOtpLogin;
    // Optimistic update
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, isOtpLogin: nextState } : u,
      ),
    );
    startTransition(async () => {
      const res = await toggleUserOtpAction({
        memberId: user.id,
        isOtpLogin: nextState,
      });
      if (!res.ok) {
        // Revert on error
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id ? { ...u, isOtpLogin: user.isOtpLogin } : u,
          ),
        );
        setNotice({
          type: "error",
          text: res.error || "Gagal mengubah pengaturan OTP.",
        });
      } else {
        router.refresh();
        setNotice({
          type: "success",
          text: res.message || "Pengaturan OTP berhasil diubah.",
        });
      }
    });
  };

  // Add User Submit
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.role) {
      setNotice({ type: "error", text: "Pilih Level User terlebih dahulu." });
      return;
    }
    setNotice(null);
    startTransition(async () => {
      const res = await createCompanyUserAction({
        name: addForm.name,
        email: addForm.email,
        phone: addForm.phone,
        password: addForm.sendInvite ? undefined : addForm.password,
        role: addForm.role as RoleValue,
        sendInvite: addForm.sendInvite,
      });
      if (res.ok) {
        setIsAddOpen(false);
        setAddForm({
          name: "",
          email: "",
          phone: "",
          password: "",
          role: "",
          sendInvite: true,
        });
        router.refresh();
        setNotice({
          type: "success",
          text: res.message || "User berhasil ditambahkan.",
        });
      } else {
        setNotice({
          type: "error",
          text: res.error || "Gagal menambahkan user.",
        });
      }
    });
  };

  // Edit User Submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setNotice(null);
    startTransition(async () => {
      const res = await updateCompanyUserAction({
        memberId: selectedUser.id,
        name: editForm.name,
        phone: editForm.phone,
        role: editForm.role,
      });
      if (res.ok) {
        setIsEditOpen(false);
        router.refresh();
        setNotice({
          type: "success",
          text: res.message || "Data user berhasil diperbarui.",
        });
      } else {
        setNotice({
          type: "error",
          text: res.error || "Gagal memperbarui data user.",
        });
      }
    });
  };

  // Change Password Submit
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (passwordForm.newPassword.length < 8) {
      setNotice({ type: "error", text: "Password minimal 8 karakter." });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setNotice({ type: "error", text: "Konfirmasi password tidak cocok." });
      return;
    }
    setNotice(null);
    startTransition(async () => {
      const res = await updateUserPasswordAction({
        memberId: selectedUser.id,
        newPassword: passwordForm.newPassword,
      });
      if (res.ok) {
        setIsPasswordOpen(false);
        setNotice({
          type: "success",
          text: res.message || "Password berhasil diubah.",
        });
      } else {
        setNotice({
          type: "error",
          text: res.error || "Gagal mengubah password.",
        });
      }
    });
  };

  // Delete User Submit
  const handleDeleteSubmit = () => {
    if (!selectedUser) return;
    setNotice(null);
    startTransition(async () => {
      const res = await deleteCompanyUserAction({ memberId: selectedUser.id });
      if (res.ok) {
        setIsDeleteOpen(false);
        setSelectedUser(null);
        router.refresh();
        setNotice({
          type: "success",
          text: res.message || "User berhasil dihapus.",
        });
      } else {
        setNotice({
          type: "error",
          text: res.error || "Gagal menghapus user.",
        });
      }
    });
  };

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", paddingBottom: "60px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div>
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
            DAFTAR USER
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
            <span style={{ color: "#787673" }}>Manajemen User</span>
            <span style={{ color: "#a8a6a3" }}>/</span>
            <span style={{ color: "#474541", fontWeight: 500 }}>
              Daftar User
            </span>
          </div>
        </div>

        {/* Info button */}
        <button
          type="button"
          onClick={() => setIsInfoOpen(true)}
          title="Informasi Manajemen User"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "6px",
            border: "1px solid #d7d6d5",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#b05c07",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <Info size={18} />
        </button>
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

      {/* Filter and Action Bar Card */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e9e8e7",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          padding: "20px 24px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          {/* Filter Nama */}
          <div>
            <label
              htmlFor="filter-nama"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "#5a5854",
                marginBottom: "6px",
              }}
            >
              Filter Nama:
            </label>
            <input
              id="filter-nama"
              type="text"
              placeholder="Nama User..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              style={{
                width: "240px",
                height: "38px",
                padding: "6px 12px",
                fontSize: "13.5px",
                border: "1px solid #d9d6d3",
                borderRadius: "6px",
                outline: "none",
                backgroundColor: "#ffffff",
              }}
            />
          </div>

          {/* Atur Ulang Filter Button */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "#5a5854",
                marginBottom: "6px",
              }}
            >
              Atur Ulang Filter:
            </label>
            <button
              type="button"
              onClick={() => setSearchName("")}
              style={{
                height: "38px",
                padding: "0 16px",
                backgroundColor: "#d9534f",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.03em",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                transition: "background-color 0.15s ease",
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#c9302c")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#d9534f")}
            >
              <RotateCcw size={14} />
              ATUR ULANG
            </button>
          </div>
        </div>

        {/* + TAMBAH Button */}
        <div>
          <button
            type="button"
            onClick={() => {
              setAddForm({
                name: "",
                email: "",
                phone: "",
                password: "",
                role: "",
                sendInvite: true,
              });
              setIsAddOpen(true);
            }}
            style={{
              height: "38px",
              padding: "0 20px",
              backgroundColor: "#faa005",
              color: "#1a1a1a",
              border: "none",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.03em",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              transition: "background-color 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#e79405")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#faa005")}
          >
            + TAMBAH
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e9e8e7",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          overflow: "visible",
        }}
      >
        <div style={{ overflowX: "auto", minHeight: "260px" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #e9e8e7" }}>
                <th
                  style={{
                    padding: "16px 18px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#262421",
                    width: "48px",
                  }}
                >
                  #
                </th>
                <th
                  style={{
                    padding: "16px 18px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#262421",
                    minWidth: "220px",
                  }}
                >
                  User
                </th>
                <th
                  style={{
                    padding: "16px 18px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#262421",
                    minWidth: "140px",
                  }}
                >
                  User WA
                </th>
                <th
                  style={{
                    padding: "16px 18px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#262421",
                    minWidth: "150px",
                  }}
                >
                  User Level
                </th>
                <th
                  style={{
                    padding: "16px 18px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#262421",
                    minWidth: "160px",
                  }}
                >
                  Terakhir Login
                </th>
                <th
                  style={{
                    padding: "16px 18px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#262421",
                    width: "100px",
                    textAlign: "center",
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: "16px 18px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#262421",
                    width: "110px",
                    textAlign: "center",
                  }}
                >
                  OTP Login
                </th>
                <th
                  style={{
                    padding: "16px 18px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#262421",
                    width: "80px",
                    textAlign: "center",
                  }}
                >
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: "36px",
                      textAlign: "center",
                      color: "#787673",
                      fontSize: "14px",
                    }}
                  >
                    Tidak ada data pengguna ditemukan.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, idx) => (
                  <tr
                    key={user.id}
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
                        padding: "14px 18px",
                        fontSize: "13.5px",
                        fontWeight: 600,
                        color: "#474541",
                      }}
                    >
                      {idx + 1}
                    </td>

                    {/* User (Name & Email) */}
                    <td style={{ padding: "14px 18px" }}>
                      <div
                        style={{
                          fontSize: "13.5px",
                          fontWeight: 600,
                          color: "#181615",
                        }}
                      >
                        {user.name}
                      </div>
                      <div
                        style={{
                          fontSize: "12.5px",
                          color: "#787673",
                          marginTop: "2px",
                        }}
                      >
                        {user.email}
                      </div>
                      {user.invitation && (
                        <span
                          title={user.invitation === "pending" ? "Belum membuat password dari email undangan" : "Tautan undangan sudah kedaluwarsa; kirim ulang lewat menu ⋮"}
                          style={{
                            display: "inline-block",
                            marginTop: "6px",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 700,
                            color: user.invitation === "pending" ? "#8a5300" : "#b42318",
                            backgroundColor: user.invitation === "pending" ? "#fff4dc" : "#fee4e2",
                          }}
                        >
                          {user.invitation === "pending" ? "Menunggu undangan" : "Undangan kedaluwarsa"}
                        </span>
                      )}
                    </td>

                    {/* User WA */}
                    <td
                      style={{
                        padding: "14px 18px",
                        fontSize: "13.5px",
                        color: "#474541",
                      }}
                    >
                      {user.phone || "-"}
                    </td>

                    {/* User Level */}
                    <td
                      style={{
                        padding: "14px 18px",
                        fontSize: "13.5px",
                        color: "#474541",
                      }}
                    >
                      {user.roleLabel}
                    </td>

                    {/* Terakhir Login */}
                    <td style={{ padding: "14px 18px" }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#474541",
                        }}
                      >
                        {user.lastLoginTime}
                      </div>
                      <div
                        style={{
                          fontSize: "12.5px",
                          color: "#787673",
                          marginTop: "2px",
                        }}
                      >
                        {user.lastLoginDate}
                      </div>
                    </td>

                    {/* Status Toggle */}
                    <td
                      style={{
                        padding: "14px 18px",
                        textAlign: "center",
                      }}
                    >
                      {(() => {
                        const statusLocked = (user.role === "admin" && !viewerIsSuperAdmin) || user.userId === currentUserId;
                        return (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={user.isActive}
                        aria-disabled={statusLocked}
                        onClick={() => handleToggleStatus(user)}
                        disabled={isPending || statusLocked}
                        title={
                          user.userId === currentUserId
                            ? "Status akun sendiri tidak bisa diubah"
                            : statusLocked
                              ? "Status akun Administrator hanya bisa diubah oleh Superadmin TepatWaktu"
                              : user.isActive ? "Aktif: klik untuk menonaktifkan (user langsung keluar dan tidak bisa login)" : "Nonaktif: klik untuk mengaktifkan kembali"
                        }
                        style={{
                          position: "relative",
                          width: "44px",
                          height: "24px",
                          borderRadius: "12px",
                          backgroundColor: user.isActive
                            ? "#faa005"
                            : "#ef4444",
                          opacity: statusLocked ? 0.5 : 1,
                          transition: "background-color 0.2s ease",
                          border: "none",
                          cursor: isPending || statusLocked ? "not-allowed" : "pointer",
                          padding: "2px",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        {user.isActive && (
                          <svg
                            style={{
                              position: "absolute",
                              left: "6px",
                              width: "11px",
                              height: "11px",
                              color: "#ffffff",
                            }}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        <span
                          style={{
                            width: "19px",
                            height: "19px",
                            borderRadius: "50%",
                            backgroundColor: "#ffffff",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            transform: user.isActive
                              ? "translateX(21px)"
                              : "translateX(1px)",
                            transition:
                              "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            display: "inline-block",
                          }}
                        />
                      </button>
                        );
                      })()}
                    </td>

                    {/* OTP Login Toggle */}
                    <td
                      style={{
                        padding: "14px 18px",
                        textAlign: "center",
                      }}
                    >
                      <button
                        type="button"
                        role="switch"
                        aria-checked={user.isOtpLogin}
                        onClick={() => handleToggleOtp(user)}
                        disabled={isPending}
                        title={
                          user.isOtpLogin
                            ? "OTP Login Aktif"
                            : "OTP Login Nonaktif"
                        }
                        style={{
                          position: "relative",
                          width: "44px",
                          height: "24px",
                          borderRadius: "12px",
                          backgroundColor: user.isOtpLogin
                            ? "#faa005"
                            : "#ef4444",
                          transition: "background-color 0.2s ease",
                          border: "none",
                          cursor: isPending ? "not-allowed" : "pointer",
                          padding: "2px",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        {user.isOtpLogin && (
                          <svg
                            style={{
                              position: "absolute",
                              left: "6px",
                              width: "11px",
                              height: "11px",
                              color: "#ffffff",
                            }}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        <span
                          style={{
                            width: "19px",
                            height: "19px",
                            borderRadius: "50%",
                            backgroundColor: "#ffffff",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            transform: user.isOtpLogin
                              ? "translateX(21px)"
                              : "translateX(1px)",
                            transition:
                              "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            display: "inline-block",
                          }}
                        />
                      </button>
                    </td>

                    {/* Aksi Column (Three Dots) */}
                    <td
                      style={{
                        padding: "14px 18px",
                        textAlign: "center",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          display: "inline-block",
                          position: "relative",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === user.id ? null : user.id,
                            )
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "6px",
                            borderRadius: "4px",
                            color: "#474541",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onMouseOver={(e) =>
                            (e.currentTarget.style.backgroundColor = "#ebe9e7")
                          }
                          onMouseOut={(e) =>
                            (e.currentTarget.style.backgroundColor = "transparent")
                          }
                        >
                          <MoreVertical size={18} />
                        </button>

                        {/* Dropdown Popover */}
                        {openMenuId === user.id && (
                          <div
                            data-float-menu
                            style={{
                              position: "absolute",
                              right: 0,
                              top: "100%",
                              marginTop: "4px",
                              backgroundColor: "#ffffff",
                              borderRadius: "6px",
                              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                              border: "1px solid #ebe9e7",
                              minWidth: "140px",
                              zIndex: 100,
                              padding: "6px 0",
                              textAlign: "left",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => openEditModal(user)}
                              style={{
                                width: "100%",
                                padding: "8px 16px",
                                background: "none",
                                border: "none",
                                textAlign: "left",
                                fontSize: "13px",
                                color: "#474541",
                                cursor: "pointer",
                                display: "block",
                              }}
                              onMouseOver={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#f6f5f4")
                              }
                              onMouseOut={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "transparent")
                              }
                            >
                              Edit
                            </button>
                            {user.invitation && (
                              <button
                                type="button"
                                onClick={() => handleResendInvite(user)}
                                disabled={isPending}
                                style={{
                                  width: "100%",
                                  padding: "8px 16px",
                                  background: "none",
                                  border: "none",
                                  textAlign: "left",
                                  fontSize: "13px",
                                  color: "#8a5300",
                                  cursor: "pointer",
                                  display: "block",
                                  whiteSpace: "nowrap",
                                }}
                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#fff4dc")}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                Kirim ulang undangan
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openPasswordModal(user)}
                              style={{
                                width: "100%",
                                padding: "8px 16px",
                                background: "none",
                                border: "none",
                                textAlign: "left",
                                fontSize: "13px",
                                color: "#474541",
                                cursor: "pointer",
                                display: "block",
                              }}
                              onMouseOver={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#f6f5f4")
                              }
                              onMouseOut={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "transparent")
                              }
                            >
                              Ubah Password
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteModal(user)}
                              style={{
                                width: "100%",
                                padding: "8px 16px",
                                background: "none",
                                border: "none",
                                textAlign: "left",
                                fontSize: "13px",
                                color: "#d9534f",
                                cursor: "pointer",
                                display: "block",
                              }}
                              onMouseOver={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#fee2e2")
                              }
                              onMouseOut={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "transparent")
                              }
                            >
                              Hapus
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: Tambah User (Image 3) */}
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
              maxWidth: "520px",
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
                Tambah User
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
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Nama User */}
                <div>
                  <label
                    htmlFor="add-name"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "6px",
                    }}
                  >
                    Nama User
                  </label>
                  <input
                    id="add-name"
                    type="text"
                    required
                    placeholder="Nama User..."
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

                {/* Email User */}
                <div>
                  <label
                    htmlFor="add-email"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "6px",
                    }}
                  >
                    Email User
                  </label>
                  <input
                    id="add-email"
                    type="email"
                    required
                    placeholder="Email User..."
                    value={addForm.email}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, email: e.target.value }))
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

                {/* No. WA User (Opsional) */}
                <div>
                  <label
                    htmlFor="add-phone"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "6px",
                    }}
                  >
                    No. WA User (Opsional)
                  </label>
                  <input
                    id="add-phone"
                    type="text"
                    placeholder="No Wa User..."
                    value={addForm.phone}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, phone: e.target.value }))
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

                {/* Invite by email (default) or set a password now */}
                <label
                  htmlFor="add-send-invite"
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                    padding: "12px",
                    border: "1px solid #f3d9a4",
                    borderRadius: "8px",
                    backgroundColor: "#fffaf0",
                    cursor: "pointer",
                  }}
                >
                  <input
                    id="add-send-invite"
                    type="checkbox"
                    checked={addForm.sendInvite}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, sendInvite: e.target.checked }))}
                    style={{ marginTop: "3px", width: "16px", height: "16px", accentColor: "#f59e0b" }}
                  />
                  <span>
                    <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#2b2926" }}>
                      Kirim undangan lewat email
                    </span>
                    <span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#787673", lineHeight: 1.5 }}>
                      {addForm.sendInvite
                        ? "User menerima email berisi tautan untuk membuat password sendiri (berlaku 7 hari). Anda tidak perlu membuat atau membagikan password."
                        : "Anda membuat password sekarang dan menyampaikannya sendiri kepada user."}
                    </span>
                  </span>
                </label>

                {/* Password User */}
                {!addForm.sendInvite && (
                <div>
                  <label
                    htmlFor="add-password"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "6px",
                    }}
                  >
                    Password User
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="add-password"
                      type={showAddPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Password User..."
                      value={addForm.password}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      style={{
                        width: "100%",
                        height: "40px",
                        padding: "8px 40px 8px 12px",
                        fontSize: "13.5px",
                        border: "1px solid #d9d6d3",
                        borderRadius: "6px",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAddPassword(!showAddPassword)}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#aba7a1",
                        padding: 0,
                      }}
                    >
                      {showAddPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                )}

                {/* Level User */}
                <div>
                  <label
                    htmlFor="add-role"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "6px",
                    }}
                  >
                    Level User
                  </label>
                  <select
                    id="add-role"
                    required
                    value={addForm.role}
                    onChange={(e) =>
                      setAddForm((prev) => ({
                        ...prev,
                        role: e.target.value as RoleValue,
                      }))
                    }
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "8px 12px",
                      fontSize: "13.5px",
                      border: "1px solid #d9d6d3",
                      borderRadius: "6px",
                      outline: "none",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value="" disabled>
                      Pilih Level User
                    </option>
                    <option value="admin">Administrator</option>
                    <option value="general_manager">General Manager</option>
                    <option value="hrd">HRD</option>
                    <option value="manager">Manager</option>
                    <option value="employee">Karyawan / Staf</option>
                  </select>
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
                    color: "#1a1a1a",
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
      {/* MODAL 2: Edit User (Image 4) */}
      {/* ========================================================================= */}
      {isEditOpen && selectedUser && (
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
              maxWidth: "520px",
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
                Edit User
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
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Nama User */}
                <div>
                  <label
                    htmlFor="edit-name"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "6px",
                    }}
                  >
                    Nama User
                  </label>
                  <input
                    id="edit-name"
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

                {/* Nama Email */}
                <div>
                  <label
                    htmlFor="edit-email"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "6px",
                    }}
                  >
                    Nama Email
                  </label>
                  <input
                    id="edit-email"
                    type="email"
                    disabled
                    value={editForm.email}
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "8px 12px",
                      fontSize: "13.5px",
                      border: "1px solid #ebe9e7",
                      borderRadius: "6px",
                      backgroundColor: "#fafafa",
                      color: "#7c7873",
                      cursor: "not-allowed",
                    }}
                  />
                </div>

                {/* No. WA User (Opsional) */}
                <div>
                  <label
                    htmlFor="edit-phone"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "6px",
                    }}
                  >
                    No. WA User (Opsional)
                  </label>
                  <input
                    id="edit-phone"
                    type="text"
                    placeholder="No. WA User..."
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, phone: e.target.value }))
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

                {/* Level User */}
                <div>
                  <label
                    htmlFor="edit-role"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "6px",
                    }}
                  >
                    Level User
                  </label>
                  <select
                    id="edit-role"
                    required
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        role: e.target.value as RoleValue,
                      }))
                    }
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "8px 12px",
                      fontSize: "13.5px",
                      border: "1px solid #d9d6d3",
                      borderRadius: "6px",
                      outline: "none",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value="admin">Administrator</option>
                    <option value="general_manager">General Manager</option>
                    <option value="hrd">HRD</option>
                    <option value="manager">Manager</option>
                    <option value="employee">Karyawan / Staf</option>
                  </select>
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
                    color: "#1a1a1a",
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
      {/* MODAL 3: Ubah Password User */}
      {/* ========================================================================= */}
      {isPasswordOpen && selectedUser && (
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
          onClick={() => setIsPasswordOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "480px",
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
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#262421",
                  }}
                >
                  Ubah Password User
                </h2>
                <div
                  style={{
                    fontSize: "12.5px",
                    color: "#7c7873",
                    marginTop: "2px",
                  }}
                >
                  {selectedUser.name} ({selectedUser.email})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordOpen(false)}
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
            <form onSubmit={handlePasswordSubmit}>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Password Baru */}
                <div>
                  <label
                    htmlFor="new-password"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "6px",
                    }}
                  >
                    Password Baru
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Password Baru..."
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          newPassword: e.target.value,
                        }))
                      }
                      style={{
                        width: "100%",
                        height: "40px",
                        padding: "8px 40px 8px 12px",
                        fontSize: "13.5px",
                        border: "1px solid #d9d6d3",
                        borderRadius: "6px",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#aba7a1",
                        padding: 0,
                      }}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Konfirmasi Password Baru */}
                <div>
                  <label
                    htmlFor="confirm-password"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#474541",
                      marginBottom: "6px",
                    }}
                  >
                    Konfirmasi Password Baru
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Konfirmasi Password Baru..."
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                      style={{
                        width: "100%",
                        height: "40px",
                        padding: "8px 40px 8px 12px",
                        fontSize: "13.5px",
                        border: "1px solid #d9d6d3",
                        borderRadius: "6px",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#aba7a1",
                        padding: 0,
                      }}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
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
                  onClick={() => setIsPasswordOpen(false)}
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
                    color: "#1a1a1a",
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
      {/* MODAL 4: Pemberitahuan Hapus User (Image 5) */}
      {/* ========================================================================= */}
      {isDeleteOpen && selectedUser && (
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
                  padding: "8px 24px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#777572",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
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

      {/* ========================================================================= */}
      {/* MODAL 5: Info Presensi Admin */}
      {/* ========================================================================= */}
      {isInfoOpen && (
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
          onClick={() => setIsInfoOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              padding: "24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#181715",
                }}
              >
                Informasi Manajemen User
              </h3>
              <button
                type="button"
                onClick={() => setIsInfoOpen(false)}
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
            <div style={{ fontSize: "13.5px", color: "#5c5954", lineHeight: 1.6 }}>
              <p style={{ margin: "0 0 10px 0" }}>
                Halaman <strong>Daftar User</strong> memungkinkan Administrator
                mengelola akun anggota perusahaan.
              </p>
              <ul style={{ paddingLeft: "20px", margin: "0 0 12px 0" }}>
                <li>
                  <strong>Status</strong>: Mengaktifkan atau menonaktifkan akses
                  login pengguna.
                </li>
                <li>
                  <strong>OTP Login</strong>: Mewajibkan verifikasi OTP saat masuk
                  ke sistem.
                </li>
                <li>
                  <strong>Aksi</strong>: Mengubah role/kontak, mengganti password,
                  atau mencabut akses perusahaan.
                </li>
              </ul>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "16px",
              }}
            >
              <button
                type="button"
                onClick={() => setIsInfoOpen(false)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#faa005",
                  color: "#1a1a1a",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
