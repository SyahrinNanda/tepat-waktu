import { z } from "zod";

export const visitLocationInput = z.object({
  name: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  email: z.union([z.email(), z.literal("")]).default(""),
  phone: z.string().trim().min(6).max(30),
  address: z.string().trim().min(5).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(10).max(10000),
  active: z.boolean().default(true),
  allEmployees: z.boolean().default(false),
  employeeIds: z.array(z.uuid()).max(1000).default([]),
});
