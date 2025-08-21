/*
  # Criar tabela de profissionais

  1. Nova Tabela
    - `professionals`
      - `id` (uuid, chave primária)
      - `name` (text, nome do profissional)
      - `specialty` (text, especialidade)
      - `avatar` (text, URL da foto)
      - `value` (numeric, valor da consulta)
      - `patients` (integer, número de pacientes)
      - `is_active` (boolean, se está ativo)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Segurança
    - Habilitar RLS na tabela `professionals`
    - Adicionar política para usuários autenticados lerem e modificarem dados
*/

CREATE TABLE IF NOT EXISTS professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialty text NOT NULL,
  avatar text DEFAULT 'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
  value numeric NOT NULL DEFAULT 0,
  patients integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users"
  ON professionals
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);