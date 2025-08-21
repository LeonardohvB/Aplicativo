/*
  # Complete Database Schema Setup

  1. New Tables
    - `professionals` - Healthcare professionals data
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `specialty` (text, required)
      - `avatar` (text, optional with default)
      - `value` (numeric, default 0)
      - `patients` (integer, default 0)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `appointments` - Scheduled appointments
      - `id` (uuid, primary key)
      - `professional_id` (uuid, foreign key)
      - `professional_name` (text, required)
      - `specialty` (text, required)
      - `room` (text, required)
      - `start_time` (text, required)
      - `end_time` (text, required)
      - `date` (date, required)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `transactions` - Financial transactions
      - `id` (uuid, primary key)
      - `type` (text, income/expense)
      - `description` (text, required)
      - `amount` (numeric, required)
      - `date` (text, required)
      - `category` (text, required)
      - `professional_id` (uuid, foreign key, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add permissive policies for all operations
    - Allow public access for development

  3. Sample Data
    - Insert initial professionals
    - Insert sample appointments
    - Insert sample transactions
*/

-- Create professionals table
CREATE TABLE IF NOT EXISTS professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialty text NOT NULL,
  avatar text DEFAULT 'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
  value numeric DEFAULT 0,
  patients integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  professional_name text NOT NULL,
  specialty text NOT NULL,
  room text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  description text NOT NULL,
  amount numeric NOT NULL,
  date text NOT NULL,
  category text NOT NULL,
  professional_id uuid REFERENCES professionals(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON professionals;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON appointments;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON transactions;

-- Create permissive policies for all operations
CREATE POLICY "Allow all operations"
  ON professionals
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations"
  ON appointments
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations"
  ON transactions
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Insert sample data
INSERT INTO professionals (name, specialty, avatar, value, patients, is_active) VALUES
  ('Dr. Maria Silva', 'Cardiologia', 'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 250.00, 45, true),
  ('Dr. João Santos', 'Neurologia', 'https://images.pexels.com/photos/6749778/pexels-photo-6749778.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 300.00, 32, true),
  ('Dra. Ana Costa', 'Pediatria', 'https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 200.00, 67, true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample appointments
INSERT INTO appointments (professional_name, specialty, room, start_time, end_time, date) VALUES
  ('Dr. Maria Silva', 'Cardiologia', 'Sala 101', '09:00', '10:00', CURRENT_DATE),
  ('Dr. João Santos', 'Neurologia', 'Sala 102', '10:30', '11:30', CURRENT_DATE),
  ('Dra. Ana Costa', 'Pediatria', 'Sala 103', '14:00', '15:00', CURRENT_DATE + INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Insert sample transactions
INSERT INTO transactions (type, description, amount, date, category) VALUES
  ('income', 'Consulta Cardiologia', 250.00, '2024-01-15', 'Consultas'),
  ('income', 'Consulta Neurologia', 300.00, '2024-01-15', 'Consultas'),
  ('expense', 'Material Médico', 150.00, '2024-01-14', 'Materiais'),
  ('expense', 'Manutenção Equipamentos', 500.00, '2024-01-13', 'Manutenção')
ON CONFLICT (id) DO NOTHING;