-- Swap "Divisi" and "Jabatan": the schedule-bearing entity (old `divisions`) becomes `job_positions`
-- (Jabatan) and the plain one (old `job_positions`) becomes `divisions` (Divisi). Employees' text columns
-- swap the same way. Rename-only: no row is moved or deleted. Runs in the migrator's transaction.
DO $$
DECLARE
  r record;
  owner_table regclass;
BEGIN
  IF to_regclass('public.division_schedules') IS NULL THEN
    RAISE NOTICE '0054: already swapped, nothing to do';
    RETURN;
  END IF;

  -- 1) Constraints and indexes to temporary names (avoids collisions between the two tables).
  FOR r IN SELECT * FROM (VALUES
    ('job_positions_company_id_companies_id_fk', '__swap_div_company_fk'),
    ('divisions_company_id_companies_id_fk', '__swap_pos_company_fk'),
    ('divisions_schedule_id_work_schedules_id_fk', '__swap_pos_schedule_fk'),
    ('division_schedules_division_id_fkey', '__swap_ps_position_fk'),
    ('division_schedules_schedule_id_fkey', '__swap_ps_schedule_fk')
  ) AS v(old_name, new_name) LOOP
    SELECT conrelid::regclass INTO owner_table FROM pg_constraint WHERE conname = r.old_name AND contype = 'f';
    IF owner_table IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', owner_table, r.old_name, r.new_name);
    END IF;
    owner_table := NULL;
  END LOOP;

  FOR r IN SELECT * FROM (VALUES
    ('job_positions_pkey', '__swap_div_pkey'),
    ('job_positions_company_idx', '__swap_div_company_idx'),
    ('job_positions_company_name_unique', '__swap_div_name_unique'),
    ('divisions_pkey', '__swap_pos_pkey'),
    ('divisions_company_idx', '__swap_pos_company_idx'),
    ('divisions_company_name_unique', '__swap_pos_name_unique'),
    ('divisions_schedule_idx', '__swap_pos_schedule_idx'),
    ('division_schedules_division_id_schedule_id_pk', '__swap_ps_pk'),
    ('division_schedules_schedule_idx', '__swap_ps_schedule_idx')
  ) AS v(old_name, new_name) LOOP
    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', r.old_name, r.new_name);
  END LOOP;

  -- 2) Tables and columns.
  ALTER TABLE job_positions RENAME TO __swap_divisions;
  ALTER TABLE divisions RENAME TO job_positions;
  ALTER TABLE __swap_divisions RENAME TO divisions;
  ALTER TABLE division_schedules RENAME TO job_position_schedules;
  ALTER TABLE job_position_schedules RENAME COLUMN division_id TO job_position_id;

  ALTER TABLE employees RENAME COLUMN department TO __swap_department;
  ALTER TABLE employees RENAME COLUMN position TO department;
  ALTER TABLE employees RENAME COLUMN __swap_department TO position;

  -- 3) Final names (Drizzle default naming).
  FOR r IN SELECT * FROM (VALUES
    ('__swap_div_company_fk', 'divisions_company_id_companies_id_fk'),
    ('__swap_pos_company_fk', 'job_positions_company_id_companies_id_fk'),
    ('__swap_pos_schedule_fk', 'job_positions_schedule_id_work_schedules_id_fk'),
    ('__swap_ps_position_fk', 'job_position_schedules_job_position_id_job_positions_id_fk'),
    ('__swap_ps_schedule_fk', 'job_position_schedules_schedule_id_work_schedules_id_fk')
  ) AS v(old_name, new_name) LOOP
    SELECT conrelid::regclass INTO owner_table FROM pg_constraint WHERE conname = r.old_name AND contype = 'f';
    IF owner_table IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', owner_table, r.old_name, r.new_name);
    END IF;
    owner_table := NULL;
  END LOOP;

  FOR r IN SELECT * FROM (VALUES
    ('__swap_div_pkey', 'divisions_pkey'),
    ('__swap_div_company_idx', 'divisions_company_idx'),
    ('__swap_div_name_unique', 'divisions_company_name_unique'),
    ('__swap_pos_pkey', 'job_positions_pkey'),
    ('__swap_pos_company_idx', 'job_positions_company_idx'),
    ('__swap_pos_name_unique', 'job_positions_company_name_unique'),
    ('__swap_pos_schedule_idx', 'job_positions_schedule_idx'),
    ('__swap_ps_pk', 'job_position_schedules_job_position_id_schedule_id_pk'),
    ('__swap_ps_schedule_idx', 'job_position_schedules_schedule_idx')
  ) AS v(old_name, new_name) LOOP
    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', r.old_name, r.new_name);
  END LOOP;

  -- 4) Sanity check: the schedule-bearing table is now job_positions.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_positions' AND column_name = 'schedule_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_position_schedules' AND column_name = 'job_position_id') THEN
    RAISE EXCEPTION '0054: swap verification failed';
  END IF;
END $$;
