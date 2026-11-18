# Tukar Divisi ↔ Jabatan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The schedule-bearing entity becomes "Jabatan" and the plain one becomes "Divisi", in labels, code, and database names, without moving any data.

**Architecture:** One rename-only SQL migration, a hand-written schema change, folder/route swaps, and one scripted token swap. The swap uses an explicit dictionary and runs in a single pass, so nothing is swapped twice. It ends with a manual pass on raw SQL and the leftover `position` words.

**Tech Stack:** Next.js 16, Drizzle + Postgres, TypeScript.

**Spec:** docs/superpowers/specs/2026-11-18-tukar-label-divisi-jabatan-design.md

## Global Constraints
- **Database:** only `ALTER ... RENAME`, in one transaction. No row is moved or deleted.
- **Names after the swap:**
  - Jabatan:
    - TS `positions` → table `job_positions`
    - TS `positionSchedules` → table `job_position_schedules`, with column `job_position_id` (TS key `positionId`)
    - employee column: TS `employees.position` → `position`
  - Divisi:
    - TS `divisions` → table `divisions`
    - employee column: TS `employees.department` → `department`
- **Mobile API:** JSON keys stay `department` (Divisi) and `position` (Jabatan).
- **Pengaturan → Role:** keep "Semua Divisi" as is. It is not wired to data. Exclude `isAllDivisions`, `selectedDivisions`, `accessDivisions`, and the `pengaturan/roles` folder.
- **Untouched:** old migration files and CSS `position` properties.

## Review Focus
- **Swapped data flow.** `employees.department` or `employees.position` left unswapped would compile but mean the wrong thing. Check: grep the final tree for every employee column use and review each one.
- **Raw SQL in scripts** (`scripts/*.mjs`) still naming the old tables. Check: the isolation and attendance suites pass.
- **Excel import header mapping.** Check: import a file made from the new template and confirm the jabatan and divisi values land correctly.
- **Shift picker at check-in** must still list the jabatan's schedules. Check: the e2e flow below.
- **Ordering column** `job_position_schedules.position` must not be renamed. Check: schema review plus the attendance suite.

---

### Task 1: Migration + schema
**Files:**
- Create: `drizzle/0054_swap_division_position.sql`
- Modify: `drizzle/meta/_journal.json` (idx 54) and `db/schema.ts`

- [ ] **Step 1: Write the migration.**
  - It renames, using temporary names: the tables, `division_schedules.division_id`, the `employees` columns, and every index/constraint whose name contains the old names.
  - It ends with a `DO` block that raises an error when the row counts change.
- [ ] **Step 2: Rewrite the schema definitions** with the names from Global Constraints. Add a comment explaining the history.
- [ ] **Step 3: Before migrating, record the counts:** `job_positions`, `divisions`, `division_schedules`, and employees grouped by department and position.
- [ ] **Step 4: Run `npx drizzle-kit migrate`.** Expected: success, the same counts, and the same department/position pairs, only with the columns swapped.

### Task 2: Folder, route, and code swap
**Files:**
- Swap `features/master-data/divisions` ↔ `positions` (the file names inside follow the same dictionary).
- Swap `app/dashboard/master/divisi` ↔ `jabatan` and `app/api/master/divisions` ↔ `positions`.
- Run the token swap over `app`, `features`, `components`, `lib`, `scripts`, and `app/api/mobile`.

- [ ] **Step 1: Rename the folders** with `git mv`, through a temporary name.
- [ ] **Step 2: Run the dictionary swap script.** It prints any token it finds that is not in the dictionary.
- [ ] **Step 3: Fix the rest by hand:**
  - the bare `position` exclusions (geolocation, CSS-in-JS, the ordering column, geocoding);
  - raw SQL in the scripts;
  - the menu order in `dashboard-shell.tsx` (Jabatan before Divisi is fine).
- [ ] **Step 4: Run `npx next typegen`, `npx tsc --noEmit`, and `npm run lint`.** Expected: clean.

### Task 3: Verify
- [ ] **Step 1: Run the build and the repo suites:** `test:isolation`, `test:attendance`, and `tsx scripts/test-payslip-rules.ts`. All must pass.
- [ ] **Step 2: Run the crawler** for admin, karyawan, superadmin, and tamu (desktop and mobile): 0 problems.
- [ ] **Step 3: Run an e2e script.** It must check that:
  - Master Data → Jabatan has a schedule field, and Divisi does not;
  - the employee form labels are swapped;
  - the daily and monthly reports show the right columns;
  - a jabatan with 2 shifts gives the check-in shift picker 2 options;
  - an import with the new template stores the values in the right fields;
  - the Excel export headers are correct.
- [ ] **Step 4: Run a grep sweep** for user-visible "Divisi"/"Jabatan" strings and review every match.
