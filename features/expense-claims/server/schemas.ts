import { z } from "zod";

export const expenseClaimInput = z.object({
  employeeId: z.uuid(),
  requestDate: z.iso.date(),
  amount: z.number().int().min(1_000).max(2_000_000_000),
  description: z.string().trim().min(3).max(300),
  note: z.string().trim().max(1000).optional().default(""),
  proofAssetId: z.uuid().nullable().optional(),
});
