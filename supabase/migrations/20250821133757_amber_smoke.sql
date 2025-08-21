/*
  # Criar tabela de transações financeiras

  1. Nova Tabela
    - `transactions`
      - `id` (uuid, chave primária)
      - `type` (text, tipo: 'income' ou 'expense')
      - `description` (text, descrição da transação)
      - `amount` (numeric, valor)
      - `date` (text, data formatada)
      - `category` (text, categoria)
      - `professional_id` (uuid, referência opcional ao profissional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Segurança
    - Habilitar RLS na tabela `transactions`
    - Adicionar política para usuários autenticados
*/

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

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users"
  ON transactions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);