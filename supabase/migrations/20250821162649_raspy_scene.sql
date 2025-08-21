/*
  # Criar tabela de histórico de atendimentos

  1. Nova Tabela
    - `appointment_history`
      - `id` (uuid, primary key)
      - `professional_id` (uuid, foreign key)
      - `professional_name` (text)
      - `patient_id` (uuid, foreign key, nullable)
      - `patient_name` (text)
      - `patient_phone` (text, nullable)
      - `service` (text)
      - `price` (numeric)
      - `date` (date)
      - `start_time` (text)
      - `end_time` (text)
      - `status` (text)
      - `billing_mode` (text)
      - `clinic_percentage` (numeric)
      - `notes` (text, nullable)
      - `completed_at` (timestamp)
      - `created_at` (timestamp)

  2. Segurança
    - Enable RLS on `appointment_history` table
    - Add policy for public access (clinic management)

  3. Índices
    - Index on professional_id for faster queries
    - Index on date for date-based filtering
    - Index on patient_name for patient search
*/

CREATE TABLE IF NOT EXISTS appointment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE SET NULL,
  professional_name text NOT NULL,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  patient_phone text,
  service text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  date date NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  status text NOT NULL CHECK (status IN ('concluido', 'cancelado', 'no_show')),
  billing_mode text NOT NULL CHECK (billing_mode IN ('clinica', 'profissional')),
  clinic_percentage numeric DEFAULT 20,
  notes text,
  completed_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE appointment_history ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY "Allow all operations on appointment_history"
  ON appointment_history
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_appointment_history_professional 
  ON appointment_history(professional_id);

CREATE INDEX IF NOT EXISTS idx_appointment_history_date 
  ON appointment_history(date);

CREATE INDEX IF NOT EXISTS idx_appointment_history_patient_name 
  ON appointment_history(patient_name);

CREATE INDEX IF NOT EXISTS idx_appointment_history_completed_at 
  ON appointment_history(completed_at);