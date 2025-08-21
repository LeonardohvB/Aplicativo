/*
  # Add commission_rate column to professionals table

  1. Changes
    - Add `commission_rate` column to `professionals` table
    - Set default value to 20 (representing 20%)
    - Update existing records to have 20% commission rate

  2. Security
    - No changes to RLS policies needed
*/

-- Add commission_rate column to professionals table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professionals' AND column_name = 'commission_rate'
  ) THEN
    ALTER TABLE professionals ADD COLUMN commission_rate numeric DEFAULT 20;
    
    -- Update existing records to have 20% commission rate
    UPDATE professionals SET commission_rate = 20 WHERE commission_rate IS NULL;
  END IF;
END $$;