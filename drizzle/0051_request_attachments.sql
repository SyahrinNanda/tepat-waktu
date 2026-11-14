-- Supporting file on Izin/Cuti (required for new requests) and Lembur (optional) requests (13 Nov 2026).
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "attachment_asset_id" uuid REFERENCES "file_assets"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD COLUMN IF NOT EXISTS "attachment_asset_id" uuid REFERENCES "file_assets"("id") ON DELETE SET NULL;
