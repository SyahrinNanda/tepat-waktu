import { relations, sql } from "drizzle-orm";
import {
  boolean,
  bigint,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Platform access is separate from tenant membership. Superadmin accounts can
// operate TepatWaktu globally without becoming a member of every company.
export const platformRole = pgEnum("platform_role", ["user", "superadmin"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  timezone: text("timezone").default("Asia/Makassar").notNull(),
  platformRole: platformRole("platform_role").default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const emailSendCooldowns = pgTable("email_send_cooldowns", {
  emailHash: text("email_hash").primaryKey(),
  nextAllowedAt: timestamp("next_allowed_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memberRole = pgEnum("member_role", [
  "owner", // Legacy value retained so existing databases can migrate safely.
  "admin",
  "general_manager",
  "hrd",
  "manager",
  "employee",
]);
export const employeeStatus = pgEnum("employee_status", ["active", "inactive"]);
export const employeeGender = pgEnum("employee_gender", ["male", "female", "unspecified"]);
export const attendanceStatus = pgEnum("attendance_status", ["present", "late", "absent", "leave"]);
export const leaveStatus = pgEnum("leave_status", ["pending", "approved", "rejected"]);
export const leaveType = pgEnum("leave_type", ["annual", "sick", "permission"]);
export const deletionStatus = pgEnum("deletion_status", ["pending", "processed", "rejected"]);
export const attendanceEventType = pgEnum("attendance_event_type", ["check_in", "check_out"]);
export const attendanceEventSource = pgEnum("attendance_event_source", ["self", "admin", "superadmin"]);
export const fileAssetCategory = pgEnum("file_asset_category", ["attendance_photo", "employee_document", "announcement_image", "visit_attachment"]);
export const payrollCalculation = pgEnum("payroll_calculation", ["hourly", "daily", "monthly"]);
export const payrollTermType = pgEnum("payroll_term_type", ["compensation", "deduction"]);
export const salaryComponentUnit = pgEnum("salary_component_unit", ["hour", "day", "month"]);
export const attendanceLocationType = pgEnum("attendance_location_type", ["headquarters", "branch", "warehouse", "other"]);
export const employeeDocumentKind = pgEnum("employee_document_kind", ["profile_photo", "selfie", "identity_card", "certificate"]);

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  industry: text("industry").notNull(),
  plan: text("plan").default("starter").notNull(),
  timezone: text("timezone").default("Asia/Makassar").notNull(),
  province: text("province"),
  city: text("city"),
  district: text("district"),
  address: text("address"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const companyMembers = pgTable(
  "company_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    phone: text("phone"),
    isActive: boolean("is_active").default(true).notNull(),
    isOtpLogin: boolean("is_otp_login").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("company_member_unique").on(table.companyId, table.userId),
    // One account belongs to at most one company.
    uniqueIndex("company_members_user_unique").on(table.userId),
  ],
);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    employeeCode: text("employee_code").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    department: text("department").notNull(),
    position: text("position").notNull(),
    gender: employeeGender("gender").default("unspecified").notNull(),
    birthDate: date("birth_date"),
    joinedAt: date("joined_at").notNull(),
    phone: text("phone"),
    address: text("address"),
    taxNumber: text("tax_number"),
    socialSecurityNumber: text("social_security_number"),
    allAttendanceLocations: boolean("all_attendance_locations").default(true).notNull(),
    lockLocation: boolean("lock_location").default(true).notNull(),
    lockPhoto: boolean("lock_photo").default(true).notNull(),
    lockVisit: boolean("lock_visit").default(true).notNull(),
    contractType: text("contract_type"),
    status: employeeStatus("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("employees_company_code_unique").on(table.companyId, table.employeeCode),
    uniqueIndex("employees_company_email_unique").on(table.companyId, table.email),
    uniqueIndex("employees_company_user_unique").on(table.companyId, table.userId),
    index("employees_company_idx").on(table.companyId),
  ],
);

export const workSchedules = pgTable(
  "work_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    workDays: text("work_days").default("Senin–Jumat").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    graceMinutes: integer("grace_minutes").default(15).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("work_schedules_company_idx").on(table.companyId),
    uniqueIndex("work_schedules_company_name_unique").on(table.companyId, table.name),
  ],
);

export const workScheduleDays = pgTable("work_schedule_days", {
  id: uuid("id").defaultRandom().primaryKey(),
  scheduleId: uuid("schedule_id").notNull().references(() => workSchedules.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("work_schedule_days_schedule_day_unique").on(table.scheduleId, table.dayOfWeek),
  index("work_schedule_days_schedule_idx").on(table.scheduleId),
]);

export const divisions = pgTable("divisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  scheduleId: uuid("schedule_id").references(() => workSchedules.id, { onDelete: "restrict" }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("divisions_company_name_unique").on(table.companyId, table.name),
  index("divisions_company_idx").on(table.companyId, table.active),
  index("divisions_schedule_idx").on(table.scheduleId),
]);

export const jobPositions = pgTable("job_positions", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("job_positions_company_name_unique").on(table.companyId, table.name),
  index("job_positions_company_idx").on(table.companyId, table.active),
]);

export const visitLocations = pgTable("visit_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ownerName: text("owner_name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  radiusMeters: integer("radius_meters").default(100).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("visit_locations_company_name_unique").on(table.companyId, table.name),
  index("visit_locations_company_idx").on(table.companyId, table.active),
]);

export const visitLocationEmployees = pgTable("visit_location_employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  visitLocationId: uuid("visit_location_id").notNull().references(() => visitLocations.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("visit_location_employee_unique").on(table.visitLocationId, table.employeeId),
  index("visit_location_employees_location_idx").on(table.visitLocationId),
  index("visit_location_employees_employee_idx").on(table.employeeId),
]);

export const visits = pgTable("visits", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" }),
  locationId: uuid("location_id").references(() => visitLocations.id, { onDelete: "set null" }),
  visitDate: date("visit_date").notNull(),
  visitTime: time("visit_time").notNull(),
  outletName: text("outlet_name").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  note: text("note"),
  status: text("status").default("Terjadwal").notNull(),
  createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("visits_company_date_idx").on(table.companyId, table.visitDate),
  index("visits_employee_date_idx").on(table.employeeId, table.visitDate),
]);

export const attendanceLocations = pgTable("attendance_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: attendanceLocationType("type").default("headquarters").notNull(),
  address: text("address").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  radiusMeters: integer("radius_meters").default(100).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("attendance_locations_company_name_unique").on(table.companyId, table.name),
  index("attendance_locations_company_idx").on(table.companyId, table.active),
]);

export const employeeSalaryProfiles = pgTable("employee_salary_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  baseSalary: bigint("base_salary", { mode: "number" }).default(0).notNull(),
  overtimeRate: bigint("overtime_rate", { mode: "number" }).default(0).notNull(),
  salaryBasis: payrollCalculation("salary_basis").default("monthly").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("employee_salary_profiles_employee_unique").on(table.employeeId),
  index("employee_salary_profiles_company_idx").on(table.companyId),
]);

export const employeeSalaryComponents = pgTable("employee_salary_components", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: payrollTermType("type").notNull(),
  unit: salaryComponentUnit("unit").notNull(),
  amount: bigint("amount", { mode: "number" }).default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("employee_salary_components_employee_name_type_unique").on(table.employeeId, table.name, table.type),
  index("employee_salary_components_company_employee_idx").on(table.companyId, table.employeeId),
]);

export const employeeLeaveEntitlements = pgTable("employee_leave_entitlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  maximumDays: integer("maximum_days").default(12).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("employee_leave_entitlements_employee_year_unique").on(table.employeeId, table.year),
  index("employee_leave_entitlements_company_year_idx").on(table.companyId, table.year),
]);

export const fileAssets = pgTable(
  "file_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    ownerEmployeeId: uuid("owner_employee_id").references(() => employees.id, { onDelete: "set null" }),
    uploadedBy: text("uploaded_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    category: fileAssetCategory("category").notNull(),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("file_assets_object_key_unique").on(table.objectKey),
    index("file_assets_company_idx").on(table.companyId, table.category),
    index("file_assets_owner_employee_idx").on(table.ownerEmployeeId),
  ],
);

export const visitAttachments = pgTable("visit_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  visitId: uuid("visit_id").notNull().references(() => visits.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id").notNull().references(() => fileAssets.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("visit_attachments_visit_asset_unique").on(table.visitId, table.assetId),
  index("visit_attachments_visit_idx").on(table.visitId),
]);

export const employeeDocuments = pgTable("employee_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id").notNull().references(() => fileAssets.id, { onDelete: "cascade" }),
  kind: employeeDocumentKind("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("employee_documents_employee_kind_unique").on(table.employeeId, table.kind),
  index("employee_documents_employee_idx").on(table.employeeId),
]);

export const payrolls = pgTable("payrolls", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  salaryType: text("salary_type").default("Bulan").notNull(),
  quantity: doublePrecision("quantity").default(0).notNull(),
  rate: bigint("rate", { mode: "number" }).default(0).notNull(),
  compensationAmount: bigint("compensation_amount", { mode: "number" }).default(0).notNull(),
  deductionAmount: bigint("deduction_amount", { mode: "number" }).default(0).notNull(),
  totalAmount: bigint("total_amount", { mode: "number" }).default(0).notNull(),
  status: text("status").default("New").notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("payrolls_company_idx").on(table.companyId),
  index("payrolls_company_year_month_idx").on(table.companyId, table.year, table.month),
  index("payrolls_employee_idx").on(table.employeeId),
  index("payrolls_company_status_idx").on(table.companyId, table.status),
  index("payrolls_employee_period_idx").on(table.employeeId, table.year, table.month),
]);

export const payrollItems = pgTable("payroll_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  payrollId: uuid("payroll_id").notNull().references(() => payrolls.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // 'compensation' | 'deduction'
  name: text("name").notNull(),
  rate: bigint("rate", { mode: "number" }).default(0).notNull(),
  quantity: doublePrecision("quantity").default(1).notNull(),
  salaryType: text("salary_type").default("bulan").notNull(),
  totalAmount: bigint("total_amount", { mode: "number" }).default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("payroll_items_payroll_idx").on(table.payrollId),
  index("payroll_items_company_idx").on(table.companyId),
]);

export const attendances = pgTable(
  "attendances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id").references(() => workSchedules.id, { onDelete: "set null" }),
    checkInLocationId: uuid("check_in_location_id").references(() => attendanceLocations.id, { onDelete: "set null" }),
    checkOutLocationId: uuid("check_out_location_id").references(() => attendanceLocations.id, { onDelete: "set null" }),
    attendanceDate: date("attendance_date").notNull(),
    checkIn: time("check_in"),
    checkOut: time("check_out"),
    breakStart: time("break_start"), // Daily attendance break start
    breakEnd: time("break_end"), // Daily attendance break end
    status: attendanceStatus("status").default("present").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("attendance_employee_date_unique").on(table.employeeId, table.attendanceDate),
    index("attendances_company_date_idx").on(table.companyId, table.attendanceDate),
    index("attendances_shift_idx").on(table.shiftId),
  ],
);

export const attendanceEvents = pgTable(
  "attendance_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attendanceId: uuid("attendance_id").notNull().references(() => attendances.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
    type: attendanceEventType("type").notNull(),
    source: attendanceEventSource("source").notNull(),
    photoAssetId: uuid("photo_asset_id").references(() => fileAssets.id, { onDelete: "restrict" }),
    locationId: uuid("location_id").references(() => attendanceLocations.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    clientCapturedAt: timestamp("client_captured_at", { withTimezone: true }),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    accuracyMeters: doublePrecision("accuracy_meters"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    note: text("note"),
    recordedBy: text("recorded_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("attendance_event_type_unique").on(table.attendanceId, table.type),
    index("attendance_events_company_date_idx").on(table.companyId, table.occurredAt),
    index("attendance_events_employee_idx").on(table.employeeId, table.occurredAt),
  ],
);

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
    type: leaveType("type").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    reason: text("reason").notNull(),
    status: leaveStatus("status").default("pending").notNull(),
    paid: boolean("paid").default(true).notNull(),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("leave_requests_company_idx").on(table.companyId, table.status)],
);

export const overtimeRequests = pgTable(
  "overtime_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
    overtimeDate: date("overtime_date").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    description: text("description").notNull(),
    status: leaveStatus("status").default("pending").notNull(),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("overtime_requests_company_status_idx").on(table.companyId, table.status), index("overtime_requests_employee_date_idx").on(table.employeeId, table.overtimeDate)],
);

export const cashAdvanceRequests = pgTable(
  "cash_advance_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
    requestDate: date("request_date").notNull(),
    amount: integer("amount").notNull(),
    tenorMonths: integer("tenor_months").notNull(),
    installmentAmount: integer("installment_amount").notNull(),
    description: text("description").notNull(),
    status: leaveStatus("status").default("pending").notNull(),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("cash_advance_requests_company_status_idx").on(table.companyId, table.status), index("cash_advance_requests_employee_date_idx").on(table.employeeId, table.requestDate)],
);

export const cashAdvancePayments = pgTable(
  "cash_advance_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    cashAdvanceRequestId: uuid("cash_advance_request_id").notNull().references(() => cashAdvanceRequests.id, { onDelete: "cascade" }),
    paymentDate: date("payment_date").notNull(),
    amount: integer("amount").notNull(),
    method: text("method").default("payroll_deduction").notNull(),
    note: text("note"),
    createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("cash_advance_payments_company_date_idx").on(table.companyId, table.paymentDate),
    index("cash_advance_payments_request_idx").on(table.cashAdvanceRequestId),
  ],
);

export const expenseClaims = pgTable(
  "expense_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
    requestDate: date("request_date").notNull(),
    amount: integer("amount").notNull(),
    description: text("description").notNull(),
    note: text("note"),
    proofAssetId: uuid("proof_asset_id").references(() => fileAssets.id, { onDelete: "set null" }),
    status: leaveStatus("status").default("pending").notNull(),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("expense_claims_company_status_idx").on(table.companyId, table.status),
    index("expense_claims_employee_date_idx").on(table.employeeId, table.requestDate),
  ],
);

/**
 * Account deletion requests. A request is only queued for superadmin review once the owner
 * clicked the emailed link (confirmedAt set); the token is stored as a SHA-256 hash.
 */
export const deletionRequests = pgTable(
  "deletion_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    reason: text("reason"),
    status: deletionStatus("status").default("pending").notNull(),
    tokenHash: text("token_hash"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    /** Email of the superadmin who processed or rejected the request. */
    processedBy: text("processed_by"),
    /** Reason given to the requester when rejected. */
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("deletion_requests_token_idx").on(table.tokenHash),
    index("deletion_requests_status_idx").on(table.status, table.createdAt),
  ],
);

// Tenant-scoped records for operational modules whose fields are configured by
// the corresponding feature screen. Core attendance, employee, and leave data
// continue to use their dedicated relational tables above.
export const featureRecords = pgTable("feature_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  fields: jsonb("fields").$type<Record<string, string>>().notNull(),
  status: text("status").default("Aktif").notNull(),
  createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("feature_records_company_module_idx").on(table.companyId, table.module),
  index("feature_records_company_status_idx").on(table.companyId, table.status),
]);

export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  imageAssetId: uuid("image_asset_id").references(() => fileAssets.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  status: text("status").default("published").notNull(),
  createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("announcements_company_created_idx").on(table.companyId, table.createdAt),
]);

export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  monthlyPrice: integer("monthly_price").notNull(),
  maxEmployees: integer("max_employees").notNull(),
  description: text("description").notNull(),
  trialMonths: integer("trial_months").default(0).notNull(),
  trialDays: integer("trial_days").default(0).notNull(),
  // Set only for a negotiated custom plan; such plans are private to that company.
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  recommended: boolean("recommended").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("subscription_plans_company_idx").on(table.companyId)]);

export const subscriptionOrders = pgTable("subscription_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  transactionType: text("transaction_type").default("new").notNull(),
  durationMonths: integer("duration_months").default(1).notNull(),
  durationDays: integer("duration_days").default(0).notNull(),
  couponCode: text("coupon_code"),
  subtotal: integer("subtotal").default(0).notNull(),
  discountAmount: integer("discount_amount").default(0).notNull(),
  adminFee: integer("admin_fee").default(0).notNull(),
  amount: integer("amount").notNull(),
  status: text("status").default("pending").notNull(),
  paymentMethod: text("payment_method"),
  paymentRequestedAt: timestamp("payment_requested_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  proofAssetId: uuid("proof_asset_id").references(() => fileAssets.id),
  requestedBy: text("requested_by").notNull().references(() => user.id),
  verifiedBy: text("verified_by").references(() => user.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("subscription_orders_company_idx").on(table.companyId, table.createdAt), index("subscription_orders_status_idx").on(table.status), index("subscription_orders_verified_idx").on(table.verifiedAt)]);

export const customPlanRequests = pgTable("custom_plan_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  requestedBy: text("requested_by").notNull().references(() => user.id),
  employeeCount: integer("employee_count").notNull(),
  proposedPricePerEmployee: integer("proposed_price_per_employee").notNull(),
  durationMonths: integer("duration_months").default(12).notNull(),
  note: text("note"),
  status: text("status").default("pending").notNull(),
  agreedEmployeeCount: integer("agreed_employee_count"),
  agreedPricePerEmployee: integer("agreed_price_per_employee"),
  reviewNote: text("review_note"),
  planId: uuid("plan_id").references(() => subscriptionPlans.id),
  orderId: uuid("order_id").references(() => subscriptionOrders.id),
  reviewedBy: text("reviewed_by").references(() => user.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("custom_plan_requests_company_idx").on(table.companyId, table.createdAt), index("custom_plan_requests_status_idx").on(table.status)]);

/** One row per (order, threshold) so each H-5 / H-2 email goes out once; failed sends are retried. */
export const subscriptionReminders = pgTable("subscription_reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => subscriptionOrders.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  level: integer("level").notNull(),
  recipients: text("recipients").default("").notNull(),
  status: text("status").default("sending").notNull(),
  attempts: integer("attempts").default(1).notNull(),
  error: text("error"),
  /** Email provider that delivered it (brevo, mailjet, ...), see lib/mailer.ts. */
  provider: text("provider"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("subscription_reminders_order_level_idx").on(table.orderId, table.level), index("subscription_reminders_company_idx").on(table.companyId, table.createdAt)]);

/** Sign-up form data waiting for email verification; turned into a company afterwards (lib/registration). */
export const registrationRequests = pgTable("registration_requests", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  industry: text("industry").notNull(),
  planCode: text("plan_code").notNull(),
  durationMonths: integer("duration_months").default(1).notNull(),
  couponCode: text("coupon_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Emails sent per provider per UTC day, so the mailer can fall back when a free quota runs out. */
export const mailProviderUsage = pgTable("mail_provider_usage", {
  provider: text("provider").notNull(),
  day: date("day", { mode: "string" }).notNull(),
  sent: integer("sent").default(0).notNull(),
  failed: integer("failed").default(0).notNull(),
  /** Skip this provider until then: next quota reset after a quota error, or a short pause after other errors. */
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.provider, table.day] })]);

/** Every privileged superadmin action, for accountability. */
export const platformAuditLogs = pgTable("platform_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  actorName: text("actor_name").notNull(),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  companyName: text("company_name"),
  summary: text("summary").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("platform_audit_logs_created_idx").on(table.createdAt), index("platform_audit_logs_company_idx").on(table.companyId, table.createdAt), index("platform_audit_logs_action_idx").on(table.action, table.createdAt)]);

export const coupons = pgTable("coupons", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").default("").notNull(),
  discountType: text("discount_type").$type<"percent" | "fixed">().notNull(),
  discountValue: integer("discount_value").notNull(),
  minDurationMonths: integer("min_duration_months").default(1).notNull(),
  /** null = every plan */
  planCodes: text("plan_codes").array(),
  maxRedemptions: integer("max_redemptions"),
  perCompanyLimit: integer("per_company_limit").default(1).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  active: boolean("active").default(true).notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const couponRedemptions = pgTable("coupon_redemptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  couponId: uuid("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").notNull().unique().references(() => subscriptionOrders.id, { onDelete: "cascade" }),
  discountAmount: integer("discount_amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("coupon_redemptions_coupon_idx").on(table.couponId, table.companyId)]);

export const platformAnnouncements = pgTable("platform_announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  tone: text("tone").$type<"info" | "feature" | "maintenance" | "warning">().default("info").notNull(),
  /** "admins" = only company admins see it */
  audience: text("audience").$type<"all" | "admins">().default("all").notNull(),
  /** null = every company */
  companyIds: uuid("company_ids").array(),
  linkUrl: text("link_url"),
  linkLabel: text("link_label"),
  startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  active: boolean("active").default(true).notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("platform_announcements_active_idx").on(table.active, table.startsAt)]);

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userRelations = relations(user, ({ many }) => ({ sessions: many(session), accounts: many(account), memberships: many(companyMembers) }));
export const companyRelations = relations(companies, ({ many }) => ({ members: many(companyMembers), employees: many(employees), schedules: many(workSchedules) }));
export const employeeRelations = relations(employees, ({ one, many }) => ({
  company: one(companies, { fields: [employees.companyId], references: [companies.id] }),
  user: one(user, { fields: [employees.userId], references: [user.id] }),
  attendances: many(attendances),
  leaveRequests: many(leaveRequests),
  documents: many(employeeDocuments),
  expenseClaims: many(expenseClaims),
}));
export const attendanceRelations = relations(attendances, ({ one }) => ({
  employee: one(employees, { fields: [attendances.employeeId], references: [employees.id] }),
  shift: one(workSchedules, { fields: [attendances.shiftId], references: [workSchedules.id] }),
  checkInLocation: one(attendanceLocations, { fields: [attendances.checkInLocationId], references: [attendanceLocations.id] }),
  checkOutLocation: one(attendanceLocations, { fields: [attendances.checkOutLocationId], references: [attendanceLocations.id] }),
}));
export const attendanceEventRelations = relations(attendanceEvents, ({ one }) => ({
  attendance: one(attendances, { fields: [attendanceEvents.attendanceId], references: [attendances.id] }),
  employee: one(employees, { fields: [attendanceEvents.employeeId], references: [employees.id] }),
  photo: one(fileAssets, { fields: [attendanceEvents.photoAssetId], references: [fileAssets.id] }),
  actor: one(user, { fields: [attendanceEvents.recordedBy], references: [user.id] }),
}));
export const leaveRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(employees, { fields: [leaveRequests.employeeId], references: [employees.id] }),
}));

export const now = sql`now()`;

export const complaintCategory = pgEnum("complaint_category", [
  "sexual_harassment", "bullying", "toxic_environment", "discrimination", "violence",
  "abuse_of_power", "safety", "salary_rights", "facilities", "other",
]);
export const complaintStatus = pgEnum("complaint_status", ["new", "reviewing", "in_progress", "resolved", "rejected"]);

export const employeeComplaints = pgTable("employee_complaints", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  ticketCode: text("ticket_code").notNull(),
  category: complaintCategory("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  incidentDate: date("incident_date"),
  incidentLocation: text("incident_location"),
  involvedParties: text("involved_parties"),
  anonymous: boolean("anonymous").default(false).notNull(),
  // HMAC of the reporter: lets them track their own reports without storing who they are when anonymous.
  reporterKey: text("reporter_key").notNull(),
  reporterUserId: text("reporter_user_id").references(() => user.id, { onDelete: "set null" }),
  reporterName: text("reporter_name"),
  status: complaintStatus("status").default("new").notNull(),
  responseNote: text("response_note"),
  internalNote: text("internal_note"),
  handledBy: text("handled_by").references(() => user.id, { onDelete: "set null" }),
  handledAt: timestamp("handled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("employee_complaints_company_ticket_unique").on(table.companyId, table.ticketCode),
  index("employee_complaints_company_status_idx").on(table.companyId, table.status),
  index("employee_complaints_company_created_idx").on(table.companyId, table.createdAt),
  index("employee_complaints_reporter_idx").on(table.companyId, table.reporterKey),
]);
