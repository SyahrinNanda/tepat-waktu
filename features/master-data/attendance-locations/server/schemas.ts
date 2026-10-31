import { z } from "zod";

export const attendanceLocationInput = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(["headquarters", "branch", "warehouse", "other"]),
  address: z.string().trim().min(5).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(10).max(10000),
  active: z.boolean().default(true),
});
