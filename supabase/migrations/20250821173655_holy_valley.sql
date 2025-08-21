/*
  # Adicionar rastreamento de tempo real aos atendimentos

  1. Novas Colunas
    - `appointment_slots`
      - `started_at` (timestamp) - Quando o atendimento foi iniciado
      - `finished_at` (timestamp) - Quando o atendimento foi finalizado
    - `appointment_history`
      - `actual_duration` (integer) - Duração real em minutos
      - `started_at` (timestamp) - Quando foi iniciado
      - `finished_at` (timestamp) - Quando foi finalizado

  2. Funcionalidades
    - Rastreamento automático de tempo quando atendimento é iniciado/finalizado
    - Cálculo de duração real baseado nos timestamps
    - Histórico com duração precisa dos atendimentos
*/

-- Adicionar colunas de rastreamento de tempo na tabela appointment_slots
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

-- Adicionar colunas de rastreamento de tempo na tabela appointment_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointment_history' AND column_name = 'actual_duration'
  ) THEN
    ALTER TABLE appointment_history ADD COLUMN actual_duration integer;
  END IF;
END $$;

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

-- Adicionar comentários para documentação
COMMENT ON COLUMN appointment_slots.started_at IS 'Timestamp de quando o atendimento foi iniciado';
COMMENT ON COLUMN appointment_slots.finished_at IS 'Timestamp de quando o atendimento foi finalizado';
COMMENT ON COLUMN appointment_history.actual_duration IS 'Duração real do atendimento em minutos';
COMMENT ON COLUMN appointment_history.started_at IS 'Timestamp de quando o atendimento foi iniciado';
COMMENT ON COLUMN appointment_history.finished_at IS 'Timestamp de quando o atendimento foi finalizado';