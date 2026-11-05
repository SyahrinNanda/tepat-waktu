"use server";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { TIMEZONE_VALUES } from "@/lib/timezone";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  announcements,
  attendanceLocations,
  companies,
  account,
  divisions,
  employees,
  featureRecords,
  fileAssets,
  jobPositions,
  subscriptionOrders,
  user,
  visitLocations,
  visits,
  workSchedules,
} from "@/db/schema";
import { requireCompany, requireCompanyRole } from "@/lib/current-company";
import { deletePrivateObject } from "@/lib/object-storage";

export type ProfileMutationResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

const timezones = TIMEZONE_VALUES;

export async function updateUserProfile(input: {
  name: string;
  email: string;
  timezone: string;
}): Promise<ProfileMutationResult> {
  try {
    const context = await requireCompany();
    const parsed = z.object({
      name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
      email: z.email("Email tidak valid."),
      timezone: z.enum(timezones),
    }).parse(input);

    const email = parsed.email.toLowerCase();
    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    if (existing && existing.id !== context.session.user.id) {
      return { ok: false, error: "Email sudah digunakan akun lain." };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({ name: parsed.name, email, timezone: parsed.timezone, updatedAt: new Date() })
        .where(eq(user.id, context.session.user.id));
      await tx
        .update(account)
        .set({ accountId: email, updatedAt: new Date() })
        .where(and(eq(account.userId, context.session.user.id), eq(account.providerId, "credential")));
    });

    revalidatePath("/dashboard/pengaturan/profile");
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Profile user berhasil diperbarui." };
  } catch (error) {
    return mutationError(error, "Profile user gagal diperbarui.");
  }
}

export async function updateCompanyProfile(input: {
  name: string;
  email: string;
  industry: string;
  province: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  whatsapp: string;
}): Promise<ProfileMutationResult> {
  try {
    const context = await requireCompanyRole(["admin"]);
    const optionalText = z.string().trim().max(160);
    const parsed = z.object({
      name: z.string().trim().min(2, "Nama perusahaan minimal 2 karakter.").max(160),
      email: z.union([z.email("Email perusahaan tidak valid."), z.literal("")]),
      industry: z.string().trim().min(2, "Bidang perusahaan wajib diisi.").max(120),
      province: optionalText,
      city: optionalText,
      district: optionalText,
      address: z.string().trim().max(500),
      phone: z.string().trim().max(40),
      whatsapp: z.string().trim().max(40),
    }).parse(input);

    const [updated] = await db
      .update(companies)
      .set({
        name: parsed.name,
        email: parsed.email || null,
        industry: parsed.industry,
        province: parsed.province || null,
        city: parsed.city || null,
        district: parsed.district || null,
        address: parsed.address || null,
        phone: parsed.phone || null,
        whatsapp: parsed.whatsapp || null,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, context.companyId))
      .returning({ id: companies.id });

    if (!updated) return { ok: false, error: "Perusahaan tidak ditemukan." };
    revalidatePath("/dashboard/pengaturan/profile");
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Profile perusahaan berhasil diperbarui." };
  } catch (error) {
    return mutationError(error, "Profile perusahaan gagal diperbarui.");
  }
}

export async function resetCompanyData(input: {
  confirmation: string;
}): Promise<ProfileMutationResult> {
  try {
    const context = await requireCompanyRole(["admin"]);
    const parsed = z.object({ confirmation: z.string().trim().min(1) }).parse(input);
    if (parsed.confirmation !== context.companyName) {
      return { ok: false, error: "Konfirmasi reset tidak valid." };
    }

    const deletedAssets = await db.transaction(async (tx) => {
      const assets = await tx
        .select({ id: fileAssets.id, bucket: fileAssets.bucket, key: fileAssets.objectKey })
        .from(fileAssets)
        .where(eq(fileAssets.companyId, context.companyId));
      const protectedProofs = await tx
        .select({ id: subscriptionOrders.proofAssetId })
        .from(subscriptionOrders)
        .where(and(eq(subscriptionOrders.companyId, context.companyId)));
      const protectedIds = protectedProofs.flatMap((item) => item.id ? [item.id] : []);
      // Subscription invoices and their proof files are company identity and
      // billing records, so they survive an operational-data reset.
      const removableAssets = assets.filter((asset) => !protectedIds.includes(asset.id));

      await tx.delete(announcements).where(eq(announcements.companyId, context.companyId));
      await tx.delete(visits).where(eq(visits.companyId, context.companyId));
      // Employee deletion cascades to attendance, payslips, leave/overtime,
      // salary records, and employee documents.
      await tx.delete(employees).where(eq(employees.companyId, context.companyId));
      await tx.delete(featureRecords).where(eq(featureRecords.companyId, context.companyId));
      await tx.delete(visitLocations).where(eq(visitLocations.companyId, context.companyId));
      await tx.delete(attendanceLocations).where(eq(attendanceLocations.companyId, context.companyId));
      await tx.delete(divisions).where(eq(divisions.companyId, context.companyId));
      await tx.delete(jobPositions).where(eq(jobPositions.companyId, context.companyId));
      await tx.delete(workSchedules).where(eq(workSchedules.companyId, context.companyId));
      if (removableAssets.length) {
        await tx.delete(fileAssets).where(
          and(
            eq(fileAssets.companyId, context.companyId),
            protectedIds.length ? notInArray(fileAssets.id, protectedIds) : undefined,
            inArray(fileAssets.id, removableAssets.map((asset) => asset.id)),
          ),
        );
      }
      return removableAssets;
    });

    await Promise.allSettled(
      deletedAssets.map((asset) => deletePrivateObject(asset.bucket, asset.key)),
    );
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Data operasional perusahaan berhasil direset." };
  } catch (error) {
    return mutationError(error, "Data perusahaan gagal direset.");
  }
}

function mutationError(error: unknown, fallback: string): ProfileMutationResult {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? fallback };
  }
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}
