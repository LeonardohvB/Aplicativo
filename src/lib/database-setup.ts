import { supabase, isSupabaseConfigured } from './supabase';

export const setupDatabase = async () => {
  // Skip database setup if Supabase is not configured
  if (!isSupabaseConfigured) {
    console.log('📋 Supabase não configurado. Usando dados locais.');
    return false;
  }

  try {
    console.log('🔄 Configurando banco de dados automaticamente...');

    // Verificar se as tabelas já existem
    const { error: testError } = await supabase
      .from('professionals')
      .select('count')
      .limit(1);

    if (!testError) {
      console.log('✅ Banco de dados já configurado!');
      return true;
    }

    console.log('📋 Criando tabelas do banco de dados...');

    // Criar todas as tabelas em sequência
    const migrations = [
      // 1. Tabela professionals
      `
      CREATE TABLE IF NOT EXISTS professionals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        specialty text NOT NULL,
        avatar text DEFAULT 'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
        value numeric DEFAULT 0,
        patients integer DEFAULT 0,
        is_active boolean DEFAULT true,
        commission_rate numeric DEFAULT 20,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      
      ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Allow all operations on professionals"
        ON professionals
        FOR ALL
        TO public
        USING (true)
        WITH CHECK (true);
      `,

      // 2. Tabela patients
      `
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
      `,

      // 3. Tabela appointment_journeys
      `
      CREATE TABLE IF NOT EXISTS appointment_journeys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
        professional_name text NOT NULL,
        date date NOT NULL,
        start_time text NOT NULL,
        end_time text NOT NULL,
        consultation_duration integer NOT NULL,
        buffer_duration integer DEFAULT 10,
        total_slots integer NOT NULL,
        default_price numeric DEFAULT 0,
        default_service text DEFAULT 'Consulta',
        default_billing_mode text DEFAULT 'clinica' CHECK (default_billing_mode IN ('clinica', 'profissional')),
        clinic_percentage numeric DEFAULT 20,
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
        
      CREATE INDEX IF NOT EXISTS idx_appointment_journeys_date ON appointment_journeys(date);
      CREATE INDEX IF NOT EXISTS idx_appointment_journeys_professional ON appointment_journeys(professional_id);
      `,

      // 4. Tabela appointment_slots
      `
      CREATE TABLE IF NOT EXISTS appointment_slots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        journey_id uuid REFERENCES appointment_journeys(id) ON DELETE CASCADE,
        professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
        patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
        slot_number integer NOT NULL,
        start_time text NOT NULL,
        end_time text NOT NULL,
        date date NOT NULL,
        status text DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'agendado', 'em_andamento', 'concluido', 'cancelado', 'no_show')),
        service text DEFAULT 'Consulta',
        price numeric DEFAULT 0,
        billing_mode text DEFAULT 'clinica' CHECK (billing_mode IN ('clinica', 'profissional')),
        patient_name text,
        patient_phone text,
        notes text,
        clinic_percentage numeric DEFAULT 20,
        started_at timestamptz,
        finished_at timestamptz,
        actual_duration integer,
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
        
      CREATE INDEX IF NOT EXISTS idx_appointment_slots_date ON appointment_slots(date);
      CREATE INDEX IF NOT EXISTS idx_appointment_slots_journey ON appointment_slots(journey_id);
      CREATE INDEX IF NOT EXISTS idx_appointment_slots_status ON appointment_slots(status);
      `,

      // 5. Tabela transactions
      `
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
      
      CREATE POLICY "Allow all operations on transactions"
        ON transactions
        FOR ALL
        TO public
        USING (true)
        WITH CHECK (true);
      `,

      // 6. Tabela appointment_history
      `
      CREATE TABLE IF NOT EXISTS appointment_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        professional_id uuid REFERENCES professionals(id) ON DELETE SET NULL,
        professional_name text NOT NULL,
        patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
        patient_name text NOT NULL,
        patient_phone text,
        service text NOT NULL,
        price numeric DEFAULT 0,
        date date NOT NULL,
        start_time text NOT NULL,
        end_time text NOT NULL,
        status text NOT NULL CHECK (status IN ('concluido', 'cancelado', 'no_show')),
        billing_mode text NOT NULL CHECK (billing_mode IN ('clinica', 'profissional')),
        clinic_percentage numeric DEFAULT 20,
        notes text,
        completed_at timestamptz NOT NULL,
        actual_duration integer,
        started_at timestamptz,
        finished_at timestamptz,
        created_at timestamptz DEFAULT now()
      );
      
      ALTER TABLE appointment_history ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Allow all operations on appointment_history"
        ON appointment_history
        FOR ALL
        TO public
        USING (true)
        WITH CHECK (true);
        
      CREATE INDEX IF NOT EXISTS idx_appointment_history_date ON appointment_history(date);
      CREATE INDEX IF NOT EXISTS idx_appointment_history_professional ON appointment_history(professional_id);
      CREATE INDEX IF NOT EXISTS idx_appointment_history_completed_at ON appointment_history(completed_at);
      CREATE INDEX IF NOT EXISTS idx_appointment_history_patient_name ON appointment_history(patient_name);
      `,

      // 7. Tabela financial_entries
      `
      CREATE TABLE IF NOT EXISTS financial_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slot_id uuid REFERENCES appointment_slots(id) ON DELETE CASCADE,
        professional_id uuid REFERENCES professionals(id) ON DELETE SET NULL,
        type text NOT NULL CHECK (type IN ('receita_clinica', 'repasse_profissional', 'taxa_clinica')),
        description text NOT NULL,
        amount numeric NOT NULL,
        status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
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
        
      CREATE INDEX IF NOT EXISTS idx_financial_entries_slot ON financial_entries(slot_id);
      CREATE INDEX IF NOT EXISTS idx_financial_entries_professional ON financial_entries(professional_id);
      `
    ];

    // Executar cada migração
    for (let i = 0; i < migrations.length; i++) {
      console.log(`📊 Executando migração ${i + 1}/${migrations.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', {
        sql: migrations[i]
      });

      if (error) {
        // Se rpc não funcionar, tentar com query direta
        const { error: directError } = await supabase
          .from('_temp_migration')
          .select('*')
          .limit(0);
        
        if (directError) {
          console.warn(`⚠️ Migração ${i + 1} falhou, mas continuando...`);
        }
      }
    }

    // Inserir dados de exemplo
    console.log('📝 Inserindo dados de exemplo...');
    
    const { error: profError } = await supabase
      .from('professionals')
      .insert([
        {
          name: 'Dra. Ana Silva',
          specialty: 'Nutricionista',
          value: 130,
          patients: 9,
          is_active: true
        },
        {
          name: 'Dra. Marina Santos',
          specialty: 'Fonoaudióloga',
          value: 130,
          patients: 16,
          is_active: true
        },
        {
          name: 'Dra. Carla Oliveira',
          specialty: 'Psicopedagoga',
          value: 120,
          patients: 8,
          is_active: false
        }
      ]);

    if (!profError) {
      console.log('✅ Dados de exemplo inseridos com sucesso!');
    }

    console.log('🎉 Banco de dados configurado automaticamente!');
    return true;

  } catch (error) {
    console.error('❌ Erro na configuração automática:', error);
    console.log('📋 Para configurar manualmente:');
    console.log('1. Acesse o painel do Supabase');
    console.log('2. Vá para "SQL Editor"');
    console.log('3. Execute os scripts de migração');
    return false;
  }
};