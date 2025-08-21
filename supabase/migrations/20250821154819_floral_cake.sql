/*
  # Add clinic_percentage column to appointment_journeys and appointment_slots tables

  1. New Columns
    - `appointment_journeys.clinic_percentage` (numeric, default 20)
    - `appointment_slots.clinic_percentage` (numeric, default 20)
  
  2. Changes
    - Add clinic_percentage column to both tables with default value of 20
    - Update existing records to have the default value
  
  3. Notes
    - This column stores the percentage that goes to the clinic (0-100)
    - Default is 20% for the clinic, 80% for the professional
*/

-- Add clinic_percentage column to appointment_journeys table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointment_journeys' AND column_name = 'clinic_percentage'
  ) THEN
    ALTER TABLE appointment_journeys ADD COLUMN clinic_percentage numeric DEFAULT 20;
  END IF;
END $$;

-- Add clinic_percentage column to appointment_slots table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointment_slots' AND column_name = 'clinic_percentage'
  ) THEN
    ALTER TABLE appointment_slots ADD COLUMN clinic_percentage numeric DEFAULT 20;
  END IF;
END $$;