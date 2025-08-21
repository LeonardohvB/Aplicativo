/*
  # Adicionar coluna patients na tabela professionals

  1. Alterações na Tabela
    - Adicionar coluna `patients` (integer) na tabela `professionals`
    - Definir valor padrão como 0
    - Permitir valores nulos

  2. Segurança
    - Manter as políticas RLS existentes
*/

-- Adicionar coluna patients se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professionals' AND column_name = 'patients'
  ) THEN
    ALTER TABLE professionals ADD COLUMN patients integer DEFAULT 0;
  END IF;
END $$;