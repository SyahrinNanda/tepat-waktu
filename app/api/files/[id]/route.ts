import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companyMembers, employees, fileAssets } from "@/db/schema";
import { AttendanceError, authenticatedActor } from "@/features/attendance/server/attendance-service";
import { getPrivateObject } from "@/lib/object-storage";
import { getSubscriptionStatus, SUBSCRIPTION_EXPIRED_MESSAGE } from "@/features/subscriptions/server/subscription-status";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authenticatedActor(request);
    const { id } = await params;
    const [asset] = await db.select().from(fileAssets).where(eq(fileAssets.id, id)).limit(1);
    if (!asset) throw new AttendanceError("File tidak ditemukan.", 404);

    if (actor.platformRole !== "superadmin") {
      const [membership] = await db.select({ role: companyMembers.role }).from(companyMembers).where(and(eq(companyMembers.companyId, asset.companyId), eq(companyMembers.userId, actor.userId))).limit(1);
      if (!membership) throw new AttendanceError("Anda tidak memiliki akses ke file ini.", 403);
      // Admins keep file access (e.g. payment proofs) so they can renew; other members are locked out.
      if (!["admin", "owner"].includes(membership.role) && (await getSubscriptionStatus(asset.companyId)).state === "expired") throw new AttendanceError(SUBSCRIPTION_EXPIRED_MESSAGE, 402);
      if (asset.category === "announcement_image") {
        const object = await getPrivateObject(asset.bucket, asset.objectKey);
        return new Response(Buffer.from(object.bytes), {
          headers: { "content-type": object.contentType, "content-length": String(object.contentLength ?? object.bytes.byteLength), "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" },
        });
      }
      if (!["admin", "owner"].includes(membership.role) && asset.uploadedBy !== actor.userId) {
        const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.companyId, asset.companyId), eq(employees.userId, actor.userId))).limit(1);
        const canReviewDocument = asset.category === "employee_document" && ["general_manager", "hrd"].includes(membership.role);
        const canReviewVisit = asset.category === "visit_attachment" && ["general_manager", "hrd", "manager"].includes(membership.role);
        if (!canReviewDocument && !canReviewVisit && (!employee || employee.id !== asset.ownerEmployeeId)) throw new AttendanceError("Anda tidak memiliki akses ke file ini.", 403);
      }
    }

    const object = await getPrivateObject(asset.bucket, asset.objectKey);
    return new Response(Buffer.from(object.bytes), {
      headers: {
        "content-type": object.contentType,
        "content-length": String(object.contentLength ?? object.bytes.byteLength),
        "cache-control": "private, no-store",
        "content-disposition": `inline; filename="${asset.originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AttendanceError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("Private file download error", error);
    return NextResponse.json({ message: "File belum dapat dimuat." }, { status: 500 });
  }
}
