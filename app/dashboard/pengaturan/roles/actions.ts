"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { featureRecords } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";

export type UserLevelData = {
  id: string;
  name: string;
  accessPages: string;
  accessDivisions: string;
  accessActions: string;
  isAllPages: boolean;
  selectedPages: string[];
  isAllDivisions: boolean;
  selectedDivisions: string[];
  isAllActions: boolean;
  selectedActions: string[];
  isSystem: boolean;
  createdAt?: string;
};

const createUserLevelSchema = z.object({
  name: z.string().min(1, "Nama User Level wajib diisi").max(100),
  isAllPages: z.boolean().default(true),
  selectedPages: z.array(z.string()).default([]),
  isAllDivisions: z.boolean().default(true),
  selectedDivisions: z.array(z.string()).default([]),
  isAllActions: z.boolean().default(true),
  selectedActions: z.array(z.string()).default([]),
});

const updateUserLevelSchema = createUserLevelSchema.extend({
  id: z.string().uuid("ID tidak valid"),
});

export async function fetchUserLevelsAction(): Promise<UserLevelData[]> {
  const context = await requireCompanyRole(["admin"]);

  // System role: Administrator (Always present at position #1)
  const systemAdmin: UserLevelData = {
    id: "system-administrator",
    name: "Administrator",
    accessPages: "Semua Halaman",
    accessDivisions: "Semua Divisi",
    accessActions: "Semua Aksi",
    isAllPages: true,
    selectedPages: [],
    isAllDivisions: true,
    selectedDivisions: [],
    isAllActions: true,
    selectedActions: [],
    isSystem: true,
  };

  // Fetch company's roles from featureRecords
  const rows = await db
    .select({
      id: featureRecords.id,
      fields: featureRecords.fields,
      createdAt: featureRecords.createdAt,
    })
    .from(featureRecords)
    .where(
      and(
        eq(featureRecords.companyId, context.companyId),
        eq(featureRecords.module, "pengaturan/roles"),
      ),
    )
    .orderBy(asc(featureRecords.createdAt));

  // If no roles exist yet for this company, seed the default "Manager" role
  // matching Screenshot 2.
  if (rows.length === 0) {
    const defaultManagerFields = {
      name: "Manager",
      isAllPages: "true",
      selectedPages: JSON.stringify([]),
      isAllDivisions: "true",
      selectedDivisions: JSON.stringify([]),
      isAllActions: "false",
      selectedActions: JSON.stringify(["Read (Lihat Data)"]),
    };

    const [inserted] = await db
      .insert(featureRecords)
      .values({
        companyId: context.companyId,
        module: "pengaturan/roles",
        fields: defaultManagerFields,
        status: "Aktif",
        createdBy: context.session.user.id,
      })
      .returning({
        id: featureRecords.id,
        fields: featureRecords.fields,
        createdAt: featureRecords.createdAt,
      });

    if (inserted) {
      rows.push(inserted);
    }
  }

  const customRoles: UserLevelData[] = rows.map((r) => {
    const f = (r.fields ?? {}) as Record<string, string>;
    const isAllPages = f.isAllPages !== "false";
    const isAllDivisions = f.isAllDivisions !== "false";
    const isAllActions = f.isAllActions === "true";

    let selectedPages: string[] = [];
    try {
      if (f.selectedPages) selectedPages = JSON.parse(f.selectedPages);
    } catch {
      selectedPages = [];
    }

    let selectedDivisions: string[] = [];
    try {
      if (f.selectedDivisions) selectedDivisions = JSON.parse(f.selectedDivisions);
    } catch {
      selectedDivisions = [];
    }

    let selectedActions: string[] = [];
    try {
      if (f.selectedActions) selectedActions = JSON.parse(f.selectedActions);
    } catch {
      selectedActions = f.actions ? f.actions.split(",").map((s) => s.trim()) : [];
    }

    let accessActionsDisplay = "Semua Aksi";
    if (!isAllActions) {
      if (selectedActions.length > 0) {
        // If only Read (Lihat Data), show "Lihat Data" to match Image 2
        const cleaned = selectedActions.map((a) =>
          a === "Read (Lihat Data)" ? "Lihat Data" : a,
        );
        accessActionsDisplay = cleaned.join(", ");
      } else {
        accessActionsDisplay = "Tidak Ada";
      }
    }

    return {
      id: r.id,
      name: f.name || "User Level",
      accessPages: isAllPages ? "Semua Halaman" : (selectedPages.join(", ") || "Terbatas"),
      accessDivisions: isAllDivisions ? "Semua Divisi" : (selectedDivisions.join(", ") || "Terbatas"),
      accessActions: accessActionsDisplay,
      isAllPages,
      selectedPages,
      isAllDivisions,
      selectedDivisions,
      isAllActions,
      selectedActions,
      isSystem: false,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
    };
  });

  return [systemAdmin, ...customRoles];
}

export async function createUserLevelAction(
  data: z.infer<typeof createUserLevelSchema>,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const context = await requireCompanyRole(["admin"]);
    const parsed = createUserLevelSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Data tidak valid" };
    }

    const {
      name,
      isAllPages,
      selectedPages,
      isAllDivisions,
      selectedDivisions,
      isAllActions,
      selectedActions,
    } = parsed.data;

    // Check duplicate name within company
    const existing = await db
      .select({ id: featureRecords.id, fields: featureRecords.fields })
      .from(featureRecords)
      .where(
        and(
          eq(featureRecords.companyId, context.companyId),
          eq(featureRecords.module, "pengaturan/roles"),
        ),
      );

    const isDuplicate =
      name.toLowerCase() === "administrator" ||
      existing.some((r) => {
        const f = (r.fields ?? {}) as Record<string, string>;
        return (f.name || "").trim().toLowerCase() === name.trim().toLowerCase();
      });

    if (isDuplicate) {
      return { ok: false, error: "Nama user level sudah digunakan." };
    }

    const fields: Record<string, string> = {
      name: name.trim(),
      isAllPages: isAllPages ? "true" : "false",
      selectedPages: JSON.stringify(selectedPages),
      isAllDivisions: isAllDivisions ? "true" : "false",
      selectedDivisions: JSON.stringify(selectedDivisions),
      isAllActions: isAllActions ? "true" : "false",
      selectedActions: JSON.stringify(selectedActions),
    };

    await db.insert(featureRecords).values({
      companyId: context.companyId,
      module: "pengaturan/roles",
      fields,
      status: "Aktif",
      createdBy: context.session.user.id,
    });

    revalidatePath("/dashboard/pengaturan/roles");
    return { ok: true, message: "User Level berhasil ditambahkan." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan sistem.";
    return { ok: false, error: msg };
  }
}

export async function updateUserLevelAction(
  data: z.infer<typeof updateUserLevelSchema>,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const context = await requireCompanyRole(["admin"]);
    const parsed = updateUserLevelSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Data tidak valid" };
    }

    const {
      id,
      name,
      isAllPages,
      selectedPages,
      isAllDivisions,
      selectedDivisions,
      isAllActions,
      selectedActions,
    } = parsed.data;

    const [existing] = await db
      .select({ id: featureRecords.id })
      .from(featureRecords)
      .where(
        and(
          eq(featureRecords.id, id),
          eq(featureRecords.companyId, context.companyId),
          eq(featureRecords.module, "pengaturan/roles"),
        ),
      )
      .limit(1);

    if (!existing) {
      return { ok: false, error: "User Level tidak ditemukan." };
    }

    const fields: Record<string, string> = {
      name: name.trim(),
      isAllPages: isAllPages ? "true" : "false",
      selectedPages: JSON.stringify(selectedPages),
      isAllDivisions: isAllDivisions ? "true" : "false",
      selectedDivisions: JSON.stringify(selectedDivisions),
      isAllActions: isAllActions ? "true" : "false",
      selectedActions: JSON.stringify(selectedActions),
    };

    await db
      .update(featureRecords)
      .set({
        fields,
        updatedAt: new Date(),
        updatedBy: context.session.user.id,
      })
      .where(eq(featureRecords.id, id));

    revalidatePath("/dashboard/pengaturan/roles");
    return { ok: true, message: "User Level berhasil diperbarui." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan sistem.";
    return { ok: false, error: msg };
  }
}

export async function deleteUserLevelAction(input: {
  id: string;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const context = await requireCompanyRole(["admin"]);
    if (input.id === "system-administrator") {
      return { ok: false, error: "Level Administrator tidak dapat dihapus." };
    }

    const [existing] = await db
      .select({ id: featureRecords.id })
      .from(featureRecords)
      .where(
        and(
          eq(featureRecords.id, input.id),
          eq(featureRecords.companyId, context.companyId),
          eq(featureRecords.module, "pengaturan/roles"),
        ),
      )
      .limit(1);

    if (!existing) {
      return { ok: false, error: "User level tidak ditemukan." };
    }

    await db
      .delete(featureRecords)
      .where(
        and(
          eq(featureRecords.id, input.id),
          eq(featureRecords.companyId, context.companyId),
        ),
      );

    revalidatePath("/dashboard/pengaturan/roles");
    return { ok: true, message: "User Level berhasil dihapus." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan sistem.";
    return { ok: false, error: msg };
  }
}
