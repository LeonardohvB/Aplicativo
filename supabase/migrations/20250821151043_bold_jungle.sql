/*
  # Sistema de Jornadas de Atendimento

  1. Novas Tabelas
    - `appointment_journeys` - Jornadas de atendimento criadas pelos profissionais
    - `appointment_slots` - Slots individuais de cada jornada
    - `patients` - Cadastro de pacientes
    - `financial_entries` - Lançamentos financeiros automáticos

  2. Modificações
    - Atualizar tabela `appointments` para usar o novo sistema
    - Adicionar campos de controle financeiro

  3. Segurança
    - Habilitar RLS em todas as tabelas
    - Adicionar políticas de acesso público para demonstração
*/

-- Tabela de pacientes
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on patients"
  ON patients
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Tabela de jornadas de atendimento
CREATE TABLE IF NOT EXISTS appointment_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  professional_name text NOT NULL,
  date date NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  consultation_duration integer NOT NULL, -- em minutos
  buffer_duration integer NOT NULL DEFAULT 10, -- em minutos
  total_slots integer NOT NULL,
  default_price numeric NOT NULL DEFAULT 0,
  default_service text NOT NULL DEFAULT 'Consulta',
  default_billing_mode text NOT NULL DEFAULT 'clinica' CHECK (default_billing_mode IN ('clinica', 'profissional')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE appointment_journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on appointment_journeys"
  ON appointment_journeys
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Tabela de slots de atendimento
CREATE TABLE IF NOT EXISTS appointment_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid REFERENCES appointment_journeys(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  slot_number integer NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'agendado', 'em_andamento', 'concluido', 'cancelado', 'no_show')),
  service text NOT NULL DEFAULT 'Consulta',
  price numeric NOT NULL DEFAULT 0,
  billing_mode text NOT NULL DEFAULT 'clinica' CHECK (billing_mode IN ('clinica', 'profissional')),
  patient_name text,
  patient_phone text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on appointment_slots"
  ON appointment_slots
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Tabela de lançamentos financeiros automáticos
CREATE TABLE IF NOT EXISTS financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid REFERENCES appointment_slots(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES professionals(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('receita_clinica', 'repasse_profissional', 'taxa_clinica')),
  description text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  billing_mode text NOT NULL CHECK (billing_mode IN ('clinica', 'profissional')),
  date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on financial_entries"
  ON financial_entries
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_appointment_journeys_date ON appointment_journeys(date);
CREATE INDEX IF NOT EXISTS idx_appointment_journeys_professional ON appointment_journeys(professional_id);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_journey ON appointment_slots(journey_id);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_date ON appointment_slots(date);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_status ON appointment_slots(status);
CREATE INDEX IF NOT EXISTS idx_financial_entries_slot ON financial_entries(slot_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_professional ON financial_entries(professional_id);