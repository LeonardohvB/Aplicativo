/*
  # Add time tracking columns to appointment_slots and appointment_history

  1. New Columns for appointment_slots
    - `started_at` (timestamptz) - When appointment was started
    - `finished_at` (timestamptz) - When appointment was finished
    - `actual_duration` (integer) - Actual duration in minutes

  2. New Columns for appointment_history  
    - `started_at` (timestamptz) - When appointment was started
    - `finished_at` (timestamptz) - When appointment was finished
    - `actual_duration` (integer) - Actual duration in minutes

  3. Safety
    - Uses IF NOT EXISTS to prevent errors on existing columns
    - All columns are nullable to not break existing data
*/

-- Add columns to appointment_slots table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointment_slots' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE appointment_slots ADD COLUMN started_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointment_slots' AND column_name = 'finished_at'
  ) THEN
    ALTER TABLE appointment_slots ADD COLUMN finished_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointment_slots' AND column_name = 'actual_duration'
  ) THEN
    ALTER TABLE appointment_slots ADD COLUMN actual_duration integer;
  END IF;
END $$;

-- Add columns to appointment_history table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointment_history' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE appointment_history ADD COLUMN started_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointment_history' AND column_name = 'finished_at'
  ) THEN
    ALTER TABLE appointment_history ADD COLUMN finished_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointment_history' AND column_name = 'actual_duration'
  ) THEN
    ALTER TABLE appointment_history ADD COLUMN actual_duration integer;
  END IF;
END $$;

-- Add comments to document the new columns
COMMENT ON COLUMN appointment_slots.started_at IS 'Timestamp de quando o atendimento foi iniciado';
COMMENT ON COLUMN appointment_slots.finished_at IS 'Timestamp de quando o atendimento foi finalizado';
COMMENT ON COLUMN appointment_slots.actual_duration IS 'Duração real do atendimento em minutos';

COMMENT ON COLUMN appointment_history.started_at IS 'Timestamp de quando o atendimento foi iniciado';
COMMENT ON COLUMN appointment_history.finished_at IS 'Timestamp de quando o atendimento foi finalizado';
COMMENT ON COLUMN appointment_history.actual_duration IS 'Duração real do atendimento em minutos';