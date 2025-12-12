

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."_evo_fill_modality"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  from_appt text;
  from_json text;
  from_title text;
  final text;
begin
  -- pega da appointments, se houver vínculo
  if new.appointment_id is not null then
    select a.modality
      into from_appt
      from public.appointments a
     where a.id = new.appointment_id
     limit 1;
  end if;

  -- pega do JSON da própria evolução (se vier)
  if new.data_json is not null then
    from_json := coalesce(new.data_json->>'modality', null);
  end if;

  -- heurística pelo título
  from_title := lower(coalesce(new.title, ''));
  if final is null then
    if from_title like '%online%' then
      final := 'online';
    elsif from_title ~ '(presencial|local)' then
      final := 'presencial';
    end if;
  end if;

  -- prioridade: NEW.modality explícito → appointments → data_json → título
  final := coalesce(nullif(lower(new.modality), ''),
                    nullif(lower(from_appt), ''),
                    nullif(lower(from_json), ''),
                    final);

  if final is not null then
    new.modality := final;
    -- mantém no JSON também
    new.data_json := coalesce(new.data_json, '{}'::jsonb);
    new.data_json := jsonb_set(new.data_json, '{modality}', to_jsonb(final), true);
  end if;

  return new;
end
$$;


ALTER FUNCTION "public"."_evo_fill_modality"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."call_push_cron"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform net.http_post(
    url := 'https://yhcxdcnveyxntfzwaovp.supabase.co/functions/v1/push-cron',
    headers := jsonb_build_object(
      'authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloY3hkY252ZXl4bnRmendhb3ZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg2NTAxOSwiZXhwIjoyMDcxNDQxMDE5fQ.eFDp3JlBRtgoALpk2zfrmDwXXC0SIa1PNyX9xicmh2o',
      'content-type', 'application/json'
    ),
    body := '{}'
  );
end;
$$;


ALTER FUNCTION "public"."call_push_cron"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select tenant_id
  from public.profiles
  where id = auth.uid()
$$;


ALTER FUNCTION "public"."current_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_encounter"("p_appointment_id" "uuid", "p_meta" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
  v_slot_id_text text;
begin
  perform pg_advisory_xact_lock(
    ('x' || substr(md5(p_appointment_id::text), 1, 16))::bit(64)::bigint
  );

  select id into v_id
    from public.encounters
   where appointment_id = p_appointment_id
   limit 1;

  if v_id is not null then
    -- merge de meta, para persistir slotId se chegar depois
    update public.encounters
       set meta = coalesce(meta,'{}'::jsonb) || coalesce(p_meta,'{}'::jsonb)
     where id = v_id;
    return v_id;
  end if;

  insert into public.encounters (appointment_id, status, started_at, meta)
  values (p_appointment_id, 'in_progress', now(), coalesce(p_meta,'{}'::jsonb))
  returning id into v_id;

  -- tenta marcar appointment_slots como em_andamento
  v_slot_id_text := coalesce(p_meta->>'slotId', p_appointment_id::text);
  begin
    update public.appointment_slots
       set status = 'em_andamento'
     where id::text = v_slot_id_text;
  exception
    when undefined_table or undefined_column then null;
  end;

  -- tenta marcar appointments como in_progress (se existir)
  begin
    update public.appointments
       set status = 'in_progress'
     where id = p_appointment_id;
  exception
    when undefined_table or undefined_column then null;
  end;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."ensure_encounter"("p_appointment_id" "uuid", "p_meta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_encounter"("p_encounter_id" "uuid", "p_options" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("note_id" "uuid", "version" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_appt uuid;
  v_note_id uuid;
  v_next_version int;
  v_data jsonb;
  v_slot_id_text text;
begin
  -- pega rascunho mais recente
  select d.data_json
    into v_data
  from public.encounter_drafts d
  where d.encounter_id = p_encounter_id
  order by d.updated_at desc
  limit 1;

  if v_data is null then
    v_data := coalesce(p_options->'data_json', '{}'::jsonb);
  end if;

  -- próxima versão (qualificando a coluna da TABELA!)
  begin
    select coalesce(max(en."version"), 0) + 1
      into v_next_version
    from public.encounter_notes en
    where en.encounter_id = p_encounter_id;
  exception
    when undefined_column then
      v_next_version := null;
  end;

  -- insere evolução final
  if v_next_version is null then
    insert into public.encounter_notes (encounter_id, data_json, finalized_at)
    values (p_encounter_id, v_data, now())
    returning id into v_note_id;
  else
    insert into public.encounter_notes (encounter_id, data_json, finalized_at, "version")
    values (p_encounter_id, v_data, now(), v_next_version)
    returning id into v_note_id;
  end if;

  -- fecha encounter e captura appointment_id + slotId salvo no meta
  update public.encounters
     set status = 'done', ended_at = now()
   where id = p_encounter_id
   returning appointment_id, meta->>'slotId' into v_appt, v_slot_id_text;

  -- tenta marcar appointment_slots como concluido
  begin
    if v_slot_id_text is null then
      v_slot_id_text := v_appt::text; -- fallback
    end if;

    update public.appointment_slots
       set status = 'concluido'
     where id::text = v_slot_id_text;
  exception
    when undefined_table or undefined_column then null;
  end;

  -- tenta marcar appointments como done (se existir)
  begin
    update public.appointments
       set status = 'done'
     where id = v_appt;
  exception
    when undefined_table or undefined_column then null;
  end;

  note_id := v_note_id;
  "version" := coalesce(v_next_version, 1);
  return next;
end;
$$;


ALTER FUNCTION "public"."finalize_encounter"("p_encounter_id" "uuid", "p_options" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_set_owner_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;
  return new;
end$$;


ALTER FUNCTION "public"."fn_set_owner_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moddatetime"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."moddatetime"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pe_apply_defaults_from_appointment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Se veio appointment_id, preenche metadados do atendimento
  IF NEW.appointment_id IS NOT NULL THEN
    SELECT 
      a.professional_id,
      a.professional_name,
      a.specialty,
      a.modality
    INTO 
      NEW.professional_id,
      NEW.professional_name,
      NEW.specialty,
      NEW.modality
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id;

    -- título padrão se não vier do front
    IF COALESCE(NEW.title, '') = '' THEN
      NEW.title = 'Consulta';
    END IF;
  END IF;

  -- occurred_at padrão
  IF NEW.occurred_at IS NULL THEN
    NEW.occurred_at = now();
  END IF;

  RETURN NEW;
END
$$;


ALTER FUNCTION "public"."pe_apply_defaults_from_appointment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pe_apply_modality"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  slt record;
BEGIN
  -- tenta pegar a modalidade do slot (se veio appointment_id)
  IF NEW.appointment_id IS NOT NULL THEN
    SELECT s.modality
      INTO slt
    FROM public.appointment_slots s
    WHERE s.id = NEW.appointment_id;

    IF slt.modality IS NOT NULL THEN
      NEW.modality := slt.modality;
    END IF;
  END IF;

  -- normalização
  IF NEW.modality IS NOT NULL AND NEW.modality NOT IN ('online', 'presencial') THEN
    NEW.modality := NULL;
  END IF;

  -- defaults inofensivos
  IF COALESCE(NEW.title, '') = '' THEN
    NEW.title := 'Consulta';
  END IF;

  IF NEW.occurred_at IS NULL THEN
    NEW.occurred_at := now();
  END IF;

  RETURN NEW;
END
$$;


ALTER FUNCTION "public"."pe_apply_modality"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pef_fill_tenant_from_evolution"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  evo_tenant uuid;
begin
  select e.tenant_id into evo_tenant
  from public.patient_evolutions e
  where e.id = new.evolution_id;

  if evo_tenant is null then
    raise exception 'Evolution % not found or has no tenant_id', new.evolution_id;
  end if;

  new.tenant_id := evo_tenant;
  return new;
end;
$$;


ALTER FUNCTION "public"."pef_fill_tenant_from_evolution"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_evo_files_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  select tenant_id into new.tenant_id
  from public.patient_evolutions
  where id = new.evolution_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_evo_files_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_evolution_modality_from_appointment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.modality IS NULL AND NEW.appointment_id IS NOT NULL THEN
    SELECT modality INTO NEW.modality
    FROM appointments
    WHERE id = NEW.appointment_id;
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."set_evolution_modality_from_appointment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_evolution_professional"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- 1) Tenta do slot (se você estiver usando appointment_id como slot_id)
  if new.professional_id is null and new.appointment_id is not null then
    select professional_id
      into new.professional_id
    from appointment_slots
    where id = new.appointment_id;
  end if;

  -- 2) Tenta do encontro (se você relaciona evolution com encounter de alguma forma;
  -- se não relaciona diretamente, pule esta parte)
  -- Exemplo: se você armazena encounter_id dentro de data_json:
  -- if new.professional_id is null and (new.data_json->>'encounter_id') is not null then
  --   select professional_id into new.professional_id
  --   from encounters
  --   where id = (new.data_json->>'encounter_id')::uuid;
  -- end if;

  -- 3) Tenta um professional do owner (último recurso)
  if new.professional_id is null then
    select id into new.professional_id
    from professionals
    where owner_id = new.owner_id
    order by created_at asc
    limit 1;
  end if;

  -- Preencher o nome obrigatório, se vier vazio
  if (new.professional_name is null) then
    select name into new.professional_name
    from professionals
    where id = new.professional_id;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_evolution_professional"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_owner_and_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;

  if new.tenant_id is null then
    select tenant_id into new.tenant_id
    from public.profiles
    where id = auth.uid();
  end if;

  return new;
end; $$;


ALTER FUNCTION "public"."set_owner_and_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_owner_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;
  begin
    new.updated_at := now();
  exception when others then null;
  end;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_owner_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_patient_evolution_specialty"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- Só tenta copiar se tiver professional_id preenchido
  if NEW.professional_id is not null then
    select p.specialty
    into NEW.specialty
    from public.professionals p
    where p.id = NEW.professional_id;
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."set_patient_evolution_specialty"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tenant_id_if_null"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.tenant_id is null then
    new.tenant_id := public.current_tenant_id();
  end if;
  return new;
end
$$;


ALTER FUNCTION "public"."set_tenant_id_if_null"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."appointment_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "professional_id" "uuid",
    "professional_name" "text" NOT NULL,
    "patient_id" "uuid",
    "patient_name" "text" NOT NULL,
    "patient_phone" "text",
    "service" "text" NOT NULL,
    "price" numeric DEFAULT 0 NOT NULL,
    "date" "date" NOT NULL,
    "start_time" "text" NOT NULL,
    "end_time" "text" NOT NULL,
    "status" "text" NOT NULL,
    "billing_mode" "text" NOT NULL,
    "clinic_percentage" numeric DEFAULT 20,
    "notes" "text",
    "completed_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "actual_duration" integer,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    "slot_id" "uuid",
    "owner_id" "uuid",
    "note_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "modality" "text" DEFAULT 'presencial'::"text",
    CONSTRAINT "appointment_history_billing_mode_check" CHECK (("billing_mode" = ANY (ARRAY['clinica'::"text", 'profissional'::"text"]))),
    CONSTRAINT "appointment_history_modality_check" CHECK (("modality" = ANY (ARRAY['presencial'::"text", 'online'::"text"]))),
    CONSTRAINT "appointment_history_note_status_check" CHECK (("note_status" = ANY (ARRAY['none'::"text", 'pending'::"text", 'final'::"text"]))),
    CONSTRAINT "appointment_history_status_check" CHECK (("status" = ANY (ARRAY['concluido'::"text", 'cancelado'::"text", 'no_show'::"text"])))
);


ALTER TABLE "public"."appointment_history" OWNER TO "postgres";


COMMENT ON COLUMN "public"."appointment_history"."actual_duration" IS 'Duração real do atendimento em minutos';



COMMENT ON COLUMN "public"."appointment_history"."started_at" IS 'Timestamp de quando o atendimento foi iniciado';



COMMENT ON COLUMN "public"."appointment_history"."finished_at" IS 'Timestamp de quando o atendimento foi finalizado';



CREATE TABLE IF NOT EXISTS "public"."appointment_journeys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "professional_id" "uuid",
    "professional_name" "text" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" "text" NOT NULL,
    "end_time" "text" NOT NULL,
    "consultation_duration" integer NOT NULL,
    "buffer_duration" integer DEFAULT 10 NOT NULL,
    "total_slots" integer NOT NULL,
    "default_price" numeric DEFAULT 0 NOT NULL,
    "default_billing_mode" "text" DEFAULT 'clinica'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "clinic_percentage" numeric DEFAULT 20,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    CONSTRAINT "appointment_journeys_default_billing_mode_check" CHECK (("default_billing_mode" = ANY (ARRAY['clinica'::"text", 'profissional'::"text"])))
);


ALTER TABLE "public"."appointment_journeys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "journey_id" "uuid",
    "professional_id" "uuid",
    "patient_id" "uuid",
    "slot_number" integer NOT NULL,
    "start_time" "text" NOT NULL,
    "end_time" "text" NOT NULL,
    "date" "date" NOT NULL,
    "status" "text" DEFAULT 'disponivel'::"text" NOT NULL,
    "service" "text" DEFAULT 'Consulta'::"text" NOT NULL,
    "price" numeric DEFAULT 0 NOT NULL,
    "billing_mode" "text" DEFAULT 'clinica'::"text" NOT NULL,
    "patient_name" "text",
    "patient_phone" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "clinic_percentage" numeric DEFAULT 20,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "actual_duration" integer,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "canceled_at" timestamp with time zone,
    "no_show_at" timestamp with time zone,
    "modality" "text" DEFAULT 'presencial'::"text",
    "push_reminder_sent" boolean DEFAULT false NOT NULL,
    CONSTRAINT "appointment_slots_billing_mode_check" CHECK (("billing_mode" = ANY (ARRAY['clinica'::"text", 'profissional'::"text"]))),
    CONSTRAINT "appointment_slots_modality_check" CHECK (("modality" = ANY (ARRAY['presencial'::"text", 'online'::"text"]))),
    CONSTRAINT "appointment_slots_status_check" CHECK (("status" = ANY (ARRAY['disponivel'::"text", 'agendado'::"text", 'em_andamento'::"text", 'concluido'::"text", 'cancelado'::"text", 'no_show'::"text"])))
);


ALTER TABLE "public"."appointment_slots" OWNER TO "postgres";


COMMENT ON COLUMN "public"."appointment_slots"."started_at" IS 'Timestamp de quando o atendimento foi iniciado';



COMMENT ON COLUMN "public"."appointment_slots"."finished_at" IS 'Timestamp de quando o atendimento foi finalizado';



COMMENT ON COLUMN "public"."appointment_slots"."actual_duration" IS 'Duração real do atendimento em minutos';



CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "professional_id" "uuid",
    "professional_name" "text" NOT NULL,
    "specialty" "text" NOT NULL,
    "room" "text" NOT NULL,
    "start_time" "text" NOT NULL,
    "end_time" "text" NOT NULL,
    "date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "modality" "text",
    "reminder_minutes" integer DEFAULT 30 NOT NULL,
    "reminder_sent" boolean DEFAULT false NOT NULL,
    "reminder_sent_at" timestamp with time zone,
    "reminder60_sent" boolean DEFAULT false NOT NULL,
    "reminder15_sent" boolean DEFAULT false NOT NULL,
    "reminder5_sent" boolean DEFAULT false NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    CONSTRAINT "appointments_modality_chk" CHECK ((("modality" IS NULL) OR ("modality" = ANY (ARRAY['presencial'::"text", 'online'::"text"]))))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certificates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "evolution_id" "uuid",
    "professional_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'Atestado'::"text",
    "status" "text" DEFAULT 'issued'::"text",
    "issue_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "days" integer GENERATED ALWAYS AS (GREATEST(1, (("end_date" - "start_date") + 1))) STORED,
    "reason_text" "text",
    "cid_codes" "text"[] DEFAULT '{}'::"text"[],
    "restrictions" "text",
    "plain_text" "text",
    "data_json" "jsonb" DEFAULT '{}'::"jsonb",
    "pdf_url" "text",
    "verify_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text"
);


ALTER TABLE "public"."certificates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."encounter_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "encounter_id" "uuid" NOT NULL,
    "data_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."encounter_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."encounter_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "encounter_id" "uuid" NOT NULL,
    "t_rel_ms" integer DEFAULT 0 NOT NULL,
    "type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."encounter_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."encounter_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "encounter_id" "uuid" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "data_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "finalized_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."encounter_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."encounters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "appointment_id" "uuid",
    "patient_id" "uuid",
    "professional_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "encounters_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'done'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."encounters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slot_id" "uuid",
    "professional_id" "uuid",
    "type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "billing_mode" "text" NOT NULL,
    "date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    CONSTRAINT "financial_entries_billing_mode_check" CHECK (("billing_mode" = ANY (ARRAY['clinica'::"text", 'profissional'::"text"]))),
    CONSTRAINT "financial_entries_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'pago'::"text", 'cancelado'::"text"]))),
    CONSTRAINT "financial_entries_type_check" CHECK (("type" = ANY (ARRAY['receita_clinica'::"text", 'repasse_profissional'::"text", 'taxa_clinica'::"text"])))
);


ALTER TABLE "public"."financial_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_evolution" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "appointment_id" "uuid",
    "professional_id" "uuid" NOT NULL,
    "professional_name" "text" NOT NULL,
    "specialty" "text",
    "title" "text" NOT NULL,
    "type" "text" DEFAULT 'consultation'::"text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "vitals" "jsonb",
    "symptoms" "text"[] DEFAULT '{}'::"text"[],
    "diagnosis" "text"[] DEFAULT '{}'::"text"[],
    "conduct" "text",
    "observations" "text",
    "medications" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "data_json" "jsonb",
    "s_text" "text",
    "o_text" "text",
    "a_text" "text",
    "p_text" "text",
    "tags" "text"[],
    "modality" "text",
    CONSTRAINT "patient_evolution_modality_check" CHECK (("modality" = ANY (ARRAY['online'::"text", 'presencial'::"text"]))),
    CONSTRAINT "patient_evolution_modality_chk" CHECK ((("modality" IS NULL) OR ("modality" = ANY (ARRAY['presencial'::"text", 'online'::"text"]))))
);


ALTER TABLE "public"."patient_evolution" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."patient_evolution_feed" AS
 SELECT "id" AS "note_id",
    "appointment_id",
    "patient_id",
    "professional_id",
    "professional_name",
    "specialty",
    "title",
    "type",
    "occurred_at" AS "ts",
    "data_json",
    "s_text",
    "o_text",
    "a_text",
    "p_text",
    "vitals",
    "medications" AS "meds",
    COALESCE("tags", ( SELECT COALESCE("array_agg"("t"."value"), '{}'::"text"[]) AS "coalesce"
           FROM "jsonb_array_elements_text"(("e"."data_json" -> 'tags'::"text")) "t"("value"))) AS "tags"
   FROM "public"."patient_evolution" "e"
  ORDER BY "occurred_at" DESC;


ALTER VIEW "public"."patient_evolution_feed" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_evolution_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "evolution_id" "uuid" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pef_path_prefix_ck" CHECK ((POSITION(((("tenant_id")::"text" || '/'::"text")) IN ("file_path")) = 1))
);


ALTER TABLE "public"."patient_evolution_files" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."patient_evolutions" AS
 SELECT "id",
    NULL::"uuid" AS "tenant_id",
    "patient_id",
    "professional_id",
    "occurred_at",
    "specialty",
    "vitals",
    "symptoms",
    "array_to_string"("diagnosis", ','::"text") AS "diagnosis",
    "conduct" AS "treatment",
    "observations" AS "notes",
    NULL::"text" AS "next_steps",
    "created_at",
    "now"() AS "updated_at"
   FROM "public"."patient_evolution" "pe";


ALTER VIEW "public"."patient_evolutions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "cpf" "text",
    "birth_date" "date"
);


ALTER TABLE "public"."patients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."professional_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "bucket" "text" DEFAULT 'attachments'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "content_type" "text",
    "size_bytes" integer,
    "category" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."professional_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."professionals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "specialty" "text" NOT NULL,
    "avatar" "text" DEFAULT 'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop'::"text",
    "value" numeric DEFAULT 0 NOT NULL,
    "patients" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "commission_rate" numeric DEFAULT 20,
    "avatar_path" "text",
    "avatar_updated_at" timestamp with time zone,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "phone" "text",
    "registration_code" "text" NOT NULL,
    "cpf" "text",
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."professionals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "tenant_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email" "text",
    "full_name" "text",
    "name" "text",
    "cpf" "text",
    "phone" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "clinic_name" "text",
    "clinic_cnpj" "text",
    "clinic_address" "text",
    "clinic_phone" "text",
    "clinic_email" "text",
    "clinic_logo_key" "text",
    "clinic_logo_path" "text",
    "default_mode" "text" DEFAULT 'live'::"text",
    "default_template" "text" DEFAULT 'SOAP'::"text",
    "required_fields" "text"[] DEFAULT '{}'::"text"[],
    "features" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "profiles_default_mode_check" CHECK (("default_mode" = ANY (ARRAY['live'::"text", 'quick'::"text", 'after'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_notifications_delivery" (
    "appointment_id" "uuid" NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_notifications_delivery" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_notifications_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_notifications_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meta" "jsonb"
);


ALTER TABLE "public"."push_outbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_agent" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'Relatório'::"text" NOT NULL,
    "type" "text" DEFAULT 'custom'::"text" NOT NULL,
    "period_start" "date",
    "period_end" "date",
    "totals" "jsonb" DEFAULT '{}'::"jsonb",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reports_type_check" CHECK (("type" = ANY (ARRAY['financial'::"text", 'appointments'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "date" "text" NOT NULL,
    "category" "text" NOT NULL,
    "professional_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "slot_id" "uuid",
    "appointment_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "payment_method" "text",
    "paid_at" timestamp with time zone,
    "due_date" "date",
    "professional_name" "text",
    "patient_name" "text",
    "notes" "text",
    CONSTRAINT "transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text"]))),
    CONSTRAINT "transactions_status_chk" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'canceled'::"text"]))),
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_appointment_starts" AS
 SELECT "s"."id" AS "slot_id",
    "s"."journey_id",
    "s"."patient_id",
    "s"."professional_id",
    "j"."date" AS "appt_date",
    "s"."start_time",
    "s"."end_time",
    "s"."status",
    COALESCE("s"."tenant_id", "j"."tenant_id") AS "tenant_id",
    COALESCE("s"."owner_id", "j"."owner_id") AS "owner_id",
    "timezone"('UTC'::"text", ((((("j"."date")::"text" || ' '::"text") || "s"."start_time"))::timestamp without time zone AT TIME ZONE 'America/Sao_Paulo'::"text")) AS "starts_at_utc"
   FROM ("public"."appointment_slots" "s"
     JOIN "public"."appointment_journeys" "j" ON (("j"."id" = "s"."journey_id")))
  WHERE (("s"."canceled_at" IS NULL) AND ("s"."no_show_at" IS NULL));


ALTER VIEW "public"."v_appointment_starts" OWNER TO "postgres";


ALTER TABLE ONLY "public"."appointment_history"
    ADD CONSTRAINT "appointment_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_journeys"
    ADD CONSTRAINT "appointment_journeys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_slots"
    ADD CONSTRAINT "appointment_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."encounter_drafts"
    ADD CONSTRAINT "encounter_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."encounter_events"
    ADD CONSTRAINT "encounter_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."encounter_notes"
    ADD CONSTRAINT "encounter_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."encounters"
    ADD CONSTRAINT "encounters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_entries"
    ADD CONSTRAINT "financial_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_evolution_files"
    ADD CONSTRAINT "patient_evolution_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_evolution"
    ADD CONSTRAINT "patient_evolution_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professional_files"
    ADD CONSTRAINT "professional_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_notifications_delivery"
    ADD CONSTRAINT "push_notifications_delivery_pkey" PRIMARY KEY ("appointment_id", "target_user_id", "kind", "endpoint");



ALTER TABLE ONLY "public"."push_notifications_log"
    ADD CONSTRAINT "push_notifications_log_appointment_id_target_user_id_kind_key" UNIQUE ("appointment_id", "target_user_id", "kind");



ALTER TABLE ONLY "public"."push_notifications_log"
    ADD CONSTRAINT "push_notifications_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_outbox"
    ADD CONSTRAINT "push_outbox_appointment_id_kind_key" UNIQUE ("appointment_id", "kind");



ALTER TABLE ONLY "public"."push_outbox"
    ADD CONSTRAINT "push_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_endpoint_uniq" UNIQUE ("user_id", "endpoint");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



CREATE INDEX "appointment_history_note_idx" ON "public"."appointment_history" USING "btree" ("note_status");



CREATE INDEX "appointment_history_tenant_idx" ON "public"."appointment_history" USING "btree" ("tenant_id");



CREATE INDEX "appointment_journeys_tenant_idx" ON "public"."appointment_journeys" USING "btree" ("tenant_id");



CREATE INDEX "appointment_slots_tenant_idx" ON "public"."appointment_slots" USING "btree" ("tenant_id");



CREATE INDEX "appointments_tenant_idx" ON "public"."appointments" USING "btree" ("tenant_id");



CREATE INDEX "certificates_owner_id_patient_id_idx" ON "public"."certificates" USING "btree" ("owner_id", "patient_id");



CREATE INDEX "certificates_professional_id_issue_date_idx" ON "public"."certificates" USING "btree" ("professional_id", "issue_date" DESC);



CREATE INDEX "encounter_drafts_enc_idx" ON "public"."encounter_drafts" USING "btree" ("encounter_id");



CREATE INDEX "encounter_drafts_owner_idx" ON "public"."encounter_drafts" USING "btree" ("owner_id");



CREATE INDEX "encounter_notes_enc_idx" ON "public"."encounter_notes" USING "btree" ("encounter_id");



CREATE INDEX "encounter_notes_owner_idx" ON "public"."encounter_notes" USING "btree" ("owner_id");



CREATE INDEX "encounters_appt_idx" ON "public"."encounters" USING "btree" ("appointment_id");



CREATE INDEX "encounters_owner_idx" ON "public"."encounters" USING "btree" ("owner_id");



CREATE INDEX "encounters_status_idx" ON "public"."encounters" USING "btree" ("status");



CREATE INDEX "financial_entries_tenant_idx" ON "public"."financial_entries" USING "btree" ("tenant_id");



CREATE INDEX "idx_app_reminder15_sent" ON "public"."appointments" USING "btree" ("reminder15_sent");



CREATE INDEX "idx_app_reminder5_sent" ON "public"."appointments" USING "btree" ("reminder5_sent");



CREATE INDEX "idx_app_reminder60_sent" ON "public"."appointments" USING "btree" ("reminder60_sent");



CREATE INDEX "idx_app_reminder_sent" ON "public"."appointments" USING "btree" ("reminder_sent");



CREATE INDEX "idx_app_start_at" ON "public"."appointments" USING "btree" ("start_at");



CREATE INDEX "idx_appointment_history_completed_at" ON "public"."appointment_history" USING "btree" ("completed_at");



CREATE INDEX "idx_appointment_history_date" ON "public"."appointment_history" USING "btree" ("date");



CREATE INDEX "idx_appointment_history_patient_name" ON "public"."appointment_history" USING "btree" ("patient_name");



CREATE INDEX "idx_appointment_history_professional" ON "public"."appointment_history" USING "btree" ("professional_id");



CREATE INDEX "idx_appointment_journeys_date" ON "public"."appointment_journeys" USING "btree" ("date");



CREATE INDEX "idx_appointment_journeys_owner" ON "public"."appointment_journeys" USING "btree" ("owner_id");



CREATE INDEX "idx_appointment_journeys_professional" ON "public"."appointment_journeys" USING "btree" ("professional_id");



CREATE INDEX "idx_appointment_slots_canceled_at" ON "public"."appointment_slots" USING "btree" ("canceled_at");



CREATE INDEX "idx_appointment_slots_date" ON "public"."appointment_slots" USING "btree" ("date");



CREATE INDEX "idx_appointment_slots_finished_at" ON "public"."appointment_slots" USING "btree" ("finished_at");



CREATE INDEX "idx_appointment_slots_journey" ON "public"."appointment_slots" USING "btree" ("journey_id");



CREATE INDEX "idx_appointment_slots_no_show_at" ON "public"."appointment_slots" USING "btree" ("no_show_at");



CREATE INDEX "idx_appointment_slots_owner" ON "public"."appointment_slots" USING "btree" ("owner_id");



CREATE INDEX "idx_appointment_slots_status" ON "public"."appointment_slots" USING "btree" ("status");



CREATE INDEX "idx_appointments_end_at" ON "public"."appointments" USING "btree" ("end_at");



CREATE INDEX "idx_appointments_owner" ON "public"."appointments" USING "btree" ("owner_id");



CREATE INDEX "idx_appointments_reminder15_sent" ON "public"."appointments" USING "btree" ("reminder15_sent");



CREATE INDEX "idx_appointments_reminder5_sent" ON "public"."appointments" USING "btree" ("reminder5_sent");



CREATE INDEX "idx_appointments_reminder60_sent" ON "public"."appointments" USING "btree" ("reminder60_sent");



CREATE INDEX "idx_appointments_reminder_sent" ON "public"."appointments" USING "btree" ("reminder_sent");



CREATE INDEX "idx_appointments_start_at" ON "public"."appointments" USING "btree" ("start_at");



CREATE INDEX "idx_appointments_start_time" ON "public"."appointments" USING "btree" ("start_time");



CREATE INDEX "idx_encounter_events_encounter" ON "public"."encounter_events" USING "btree" ("encounter_id");



CREATE INDEX "idx_encounter_events_owner" ON "public"."encounter_events" USING "btree" ("owner_id");



CREATE INDEX "idx_encounters_appointment" ON "public"."encounters" USING "btree" ("appointment_id");



CREATE INDEX "idx_encounters_owner" ON "public"."encounters" USING "btree" ("owner_id");



CREATE INDEX "idx_financial_entries_owner" ON "public"."financial_entries" USING "btree" ("owner_id");



CREATE INDEX "idx_financial_entries_professional" ON "public"."financial_entries" USING "btree" ("professional_id");



CREATE INDEX "idx_financial_entries_slot" ON "public"."financial_entries" USING "btree" ("slot_id");



CREATE INDEX "idx_patient_evolution_owner" ON "public"."patient_evolution" USING "btree" ("owner_id");



CREATE INDEX "idx_patient_evolution_patient" ON "public"."patient_evolution" USING "btree" ("patient_id", "occurred_at" DESC);



CREATE INDEX "idx_patient_evolution_professional_id" ON "public"."patient_evolution" USING "btree" ("professional_id");



CREATE INDEX "idx_patients_owner" ON "public"."patients" USING "btree" ("owner_id");



CREATE INDEX "idx_pe_owner_created" ON "public"."patient_evolution" USING "btree" ("owner_id", "created_at" DESC);



CREATE INDEX "idx_pe_patient_occurred" ON "public"."patient_evolution" USING "btree" ("patient_id", "occurred_at" DESC);



CREATE INDEX "idx_pe_professional_occurred" ON "public"."patient_evolution" USING "btree" ("professional_id", "occurred_at" DESC);



CREATE INDEX "idx_pef_created_at" ON "public"."patient_evolution_files" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_pef_evolution" ON "public"."patient_evolution_files" USING "btree" ("evolution_id");



CREATE INDEX "idx_pef_evolution_id" ON "public"."patient_evolution_files" USING "btree" ("evolution_id");



CREATE INDEX "idx_pef_tenant" ON "public"."patient_evolution_files" USING "btree" ("tenant_id");



CREATE INDEX "idx_professionals_owner" ON "public"."professionals" USING "btree" ("owner_id");



CREATE INDEX "idx_professionals_registration_code" ON "public"."professionals" USING "btree" ("registration_code");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_tenant" ON "public"."profiles" USING "btree" ("tenant_id");



CREATE INDEX "idx_push_tenant" ON "public"."push_subscriptions" USING "btree" ("tenant_id");



CREATE INDEX "idx_push_user" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_reports_created" ON "public"."reports" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_reports_owner" ON "public"."reports" USING "btree" ("owner_id");



CREATE INDEX "idx_transactions_owner" ON "public"."transactions" USING "btree" ("owner_id");



CREATE UNIQUE INDEX "idx_transactions_slot_unique" ON "public"."transactions" USING "btree" ("slot_id");



CREATE UNIQUE INDEX "patients_cpf_key" ON "public"."patients" USING "btree" ("cpf");



CREATE INDEX "patients_tenant_idx" ON "public"."patients" USING "btree" ("tenant_id");



CREATE INDEX "professional_files_professional_idx" ON "public"."professional_files" USING "btree" ("professional_id");



CREATE INDEX "professional_files_tenant_idx" ON "public"."professional_files" USING "btree" ("tenant_id");



CREATE INDEX "professional_files_tenant_prof_idx" ON "public"."professional_files" USING "btree" ("tenant_id", "professional_id");



CREATE INDEX "professional_files_tenant_professional_idx" ON "public"."professional_files" USING "btree" ("tenant_id", "professional_id");



CREATE UNIQUE INDEX "professional_files_unique_path" ON "public"."professional_files" USING "btree" ("tenant_id", "professional_id", "storage_path");



CREATE UNIQUE INDEX "professionals_cpf_unique_active" ON "public"."professionals" USING "btree" ("cpf") WHERE (("cpf" IS NOT NULL) AND ("deleted_at" IS NULL));



CREATE INDEX "professionals_tenant_idx" ON "public"."professionals" USING "btree" ("tenant_id");



CREATE INDEX "profiles_tenant_idx" ON "public"."profiles" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "profiles_tenant_unique" ON "public"."profiles" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "push_notifications_log_unique" ON "public"."push_notifications_log" USING "btree" ("appointment_id", "target_user_id", "kind");



CREATE UNIQUE INDEX "push_subscriptions_user_endpoint_unique" ON "public"."push_subscriptions" USING "btree" ("user_id", "endpoint");



CREATE INDEX "transactions_tenant_idx" ON "public"."transactions" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "uniq_transactions_appointment" ON "public"."transactions" USING "btree" ("appointment_id");



CREATE UNIQUE INDEX "uq_push_log" ON "public"."push_notifications_log" USING "btree" ("appointment_id", "target_user_id", "kind");



CREATE UNIQUE INDEX "ux_appointment_history_natural" ON "public"."appointment_history" USING "btree" ("professional_id", "date", "start_time", "end_time", "status");



CREATE UNIQUE INDEX "ux_financial_entries_slot_type" ON "public"."financial_entries" USING "btree" ("slot_id", "type");



CREATE UNIQUE INDEX "ux_history_slot_status" ON "public"."appointment_history" USING "btree" ("slot_id", "status") WHERE ("slot_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_transactions_slot" ON "public"."transactions" USING "btree" ("slot_id") WHERE ("slot_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "_evo_fill_modality_bi" BEFORE INSERT ON "public"."patient_evolution" FOR EACH ROW EXECUTE FUNCTION "public"."_evo_fill_modality"();

ALTER TABLE "public"."patient_evolution" DISABLE TRIGGER "_evo_fill_modality_bi";



CREATE OR REPLACE TRIGGER "_evo_fill_modality_bu" BEFORE UPDATE OF "modality", "appointment_id", "title", "data_json" ON "public"."patient_evolution" FOR EACH ROW EXECUTE FUNCTION "public"."_evo_fill_modality"();

ALTER TABLE "public"."patient_evolution" DISABLE TRIGGER "_evo_fill_modality_bu";



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."encounters" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "pe_apply_modality_biud" BEFORE INSERT OR UPDATE OF "modality", "data_json", "appointment_id", "title" ON "public"."patient_evolution" FOR EACH ROW EXECUTE FUNCTION "public"."pe_apply_modality"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp"();



CREATE OR REPLACE TRIGGER "t_bi_appointments" BEFORE INSERT ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_and_tenant"();



CREATE OR REPLACE TRIGGER "t_bi_financial_entries" BEFORE INSERT ON "public"."financial_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_and_tenant"();



CREATE OR REPLACE TRIGGER "t_bi_history" BEFORE INSERT ON "public"."appointment_history" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_and_tenant"();



CREATE OR REPLACE TRIGGER "t_bi_journeys" BEFORE INSERT ON "public"."appointment_journeys" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_and_tenant"();



CREATE OR REPLACE TRIGGER "t_bi_patients" BEFORE INSERT ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_and_tenant"();



CREATE OR REPLACE TRIGGER "t_bi_professionals" BEFORE INSERT ON "public"."professionals" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_and_tenant"();



CREATE OR REPLACE TRIGGER "t_bi_slots" BEFORE INSERT ON "public"."appointment_slots" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_and_tenant"();



CREATE OR REPLACE TRIGGER "t_bi_transactions" BEFORE INSERT ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_and_tenant"();



CREATE OR REPLACE TRIGGER "t_set_owner_appointment_history" BEFORE INSERT ON "public"."appointment_history" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "t_set_owner_appointment_journeys" BEFORE INSERT ON "public"."appointment_journeys" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "t_set_owner_appointment_slots" BEFORE INSERT ON "public"."appointment_slots" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "t_set_owner_appointments" BEFORE INSERT ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "t_set_owner_financial_entries" BEFORE INSERT ON "public"."financial_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "t_set_owner_history" BEFORE INSERT ON "public"."appointment_history" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "t_set_owner_patients" BEFORE INSERT ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "t_set_owner_professionals" BEFORE INSERT ON "public"."professionals" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "t_set_owner_reports" BEFORE INSERT OR UPDATE ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "t_set_owner_transactions" BEFORE INSERT ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_appointment_history_set_tenant" BEFORE INSERT ON "public"."appointment_history" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_if_null"();



CREATE OR REPLACE TRIGGER "trg_appointment_journeys_set_owner" BEFORE INSERT ON "public"."appointment_journeys" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_appointment_journeys_set_tenant" BEFORE INSERT ON "public"."appointment_journeys" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_if_null"();



CREATE OR REPLACE TRIGGER "trg_appointment_slots_set_owner" BEFORE INSERT ON "public"."appointment_slots" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_appointment_slots_set_tenant" BEFORE INSERT ON "public"."appointment_slots" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_if_null"();



CREATE OR REPLACE TRIGGER "trg_appointments_set_owner" BEFORE INSERT ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_appointments_set_tenant" BEFORE INSERT ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_if_null"();



CREATE OR REPLACE TRIGGER "trg_encounters_updated_at" BEFORE UPDATE ON "public"."encounters" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"();



CREATE OR REPLACE TRIGGER "trg_financial_entries_set_owner" BEFORE INSERT ON "public"."financial_entries" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_financial_entries_set_tenant" BEFORE INSERT ON "public"."financial_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_if_null"();



CREATE OR REPLACE TRIGGER "trg_patients_set_owner" BEFORE INSERT ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_patients_set_tenant" BEFORE INSERT ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_if_null"();



CREATE OR REPLACE TRIGGER "trg_pe_apply_defaults" BEFORE INSERT ON "public"."patient_evolution" FOR EACH ROW EXECUTE FUNCTION "public"."pe_apply_defaults_from_appointment"();



CREATE OR REPLACE TRIGGER "trg_pe_set_specialty" BEFORE INSERT ON "public"."patient_evolution" FOR EACH ROW EXECUTE FUNCTION "public"."set_patient_evolution_specialty"();

ALTER TABLE "public"."patient_evolution" DISABLE TRIGGER "trg_pe_set_specialty";



CREATE OR REPLACE TRIGGER "trg_pef_fill_tenant" BEFORE INSERT ON "public"."patient_evolution_files" FOR EACH ROW EXECUTE FUNCTION "public"."pef_fill_tenant_from_evolution"();



CREATE OR REPLACE TRIGGER "trg_professionals_set_owner" BEFORE INSERT ON "public"."professionals" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_professionals_set_tenant" BEFORE INSERT ON "public"."professionals" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_if_null"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_evo_files_tenant" BEFORE INSERT ON "public"."patient_evolution_files" FOR EACH ROW EXECUTE FUNCTION "public"."set_evo_files_tenant"();



CREATE OR REPLACE TRIGGER "trg_set_evolution_modality" BEFORE INSERT OR UPDATE ON "public"."patient_evolution" FOR EACH ROW EXECUTE FUNCTION "public"."set_evolution_modality_from_appointment"();

ALTER TABLE "public"."patient_evolution" DISABLE TRIGGER "trg_set_evolution_modality";



CREATE OR REPLACE TRIGGER "trg_set_evolution_prof" BEFORE INSERT ON "public"."patient_evolution" FOR EACH ROW EXECUTE FUNCTION "public"."set_evolution_professional"();



CREATE OR REPLACE TRIGGER "trg_set_owner_id" BEFORE INSERT ON "public"."appointment_history" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_set_owner_id" BEFORE INSERT ON "public"."appointment_journeys" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_set_owner_id" BEFORE INSERT ON "public"."appointment_slots" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_set_owner_id" BEFORE INSERT ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_set_owner_id" BEFORE INSERT ON "public"."professionals" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_set_owner_id" BEFORE INSERT ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_set_owner_id_evolution" BEFORE INSERT ON "public"."patient_evolution" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_set_patient_evolution_specialty" BEFORE INSERT OR UPDATE OF "professional_id" ON "public"."patient_evolution" FOR EACH ROW EXECUTE FUNCTION "public"."set_patient_evolution_specialty"();



CREATE OR REPLACE TRIGGER "trg_transactions_set_owner" BEFORE INSERT ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_owner_id"();



CREATE OR REPLACE TRIGGER "trg_transactions_set_tenant" BEFORE INSERT ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_if_null"();



ALTER TABLE ONLY "public"."appointment_history"
    ADD CONSTRAINT "appointment_history_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointment_history"
    ADD CONSTRAINT "appointment_history_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointment_history"
    ADD CONSTRAINT "appointment_history_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."profiles"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_journeys"
    ADD CONSTRAINT "appointment_journeys_owner_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_journeys"
    ADD CONSTRAINT "appointment_journeys_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_journeys"
    ADD CONSTRAINT "appointment_journeys_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."profiles"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_slots"
    ADD CONSTRAINT "appointment_slots_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "public"."appointment_journeys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_slots"
    ADD CONSTRAINT "appointment_slots_owner_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_slots"
    ADD CONSTRAINT "appointment_slots_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointment_slots"
    ADD CONSTRAINT "appointment_slots_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_slots"
    ADD CONSTRAINT "appointment_slots_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."profiles"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_owner_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."profiles"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."encounter_drafts"
    ADD CONSTRAINT "encounter_drafts_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."encounter_events"
    ADD CONSTRAINT "encounter_events_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."encounter_notes"
    ADD CONSTRAINT "encounter_notes_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."financial_entries"
    ADD CONSTRAINT "financial_entries_owner_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_entries"
    ADD CONSTRAINT "financial_entries_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_entries"
    ADD CONSTRAINT "financial_entries_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "public"."appointment_slots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_entries"
    ADD CONSTRAINT "financial_entries_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."profiles"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_evolution"
    ADD CONSTRAINT "fk_pe_professional" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_owner_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."profiles"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_evolution_files"
    ADD CONSTRAINT "pef_evolution_fk" FOREIGN KEY ("evolution_id") REFERENCES "public"."patient_evolution"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professional_files"
    ADD CONSTRAINT "professional_files_professional_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_owner_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."profiles"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_owner_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_owner_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_slot_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."appointment_slots"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."profiles"("tenant_id") ON DELETE CASCADE;



CREATE POLICY "Allow all operations on appointment_history" ON "public"."appointment_history" USING (true) WITH CHECK (true);



CREATE POLICY "Select professional_files by tenant" ON "public"."professional_files" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") AND ("tenant_id" = ((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'tenant_id'::"text"))::"uuid")));



ALTER TABLE "public"."appointment_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointment_history delete tenant" ON "public"."appointment_history" FOR DELETE USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "appointment_history insert tenant" ON "public"."appointment_history" FOR INSERT WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "appointment_history select tenant" ON "public"."appointment_history" FOR SELECT USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "appointment_history update tenant" ON "public"."appointment_history" FOR UPDATE USING (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "appointment_history_modify" ON "public"."appointment_history" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "appointment_history_select" ON "public"."appointment_history" FOR SELECT USING (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."appointment_journeys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointment_journeys_modify" ON "public"."appointment_journeys" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "appointment_journeys_own_rows" ON "public"."appointment_journeys" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "appointment_journeys_select" ON "public"."appointment_journeys" FOR SELECT USING (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."appointment_slots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointment_slots_modify" ON "public"."appointment_slots" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "appointment_slots_own_rows" ON "public"."appointment_slots" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "appointment_slots_select" ON "public"."appointment_slots" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "appointment_slots_select_owner" ON "public"."appointment_slots" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointments_own_rows" ON "public"."appointments" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."certificates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete own subscription" ON "public"."push_subscriptions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "delete professional_files by tenant" ON "public"."professional_files" FOR DELETE USING (("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid"));



CREATE POLICY "delete_own" ON "public"."appointment_history" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "delete_own" ON "public"."appointment_journeys" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "delete_own" ON "public"."appointment_slots" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "delete_own" ON "public"."appointments" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "delete_own" ON "public"."financial_entries" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "delete_own" ON "public"."patients" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "delete_own" ON "public"."professionals" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "delete_own" ON "public"."reports" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "delete_own" ON "public"."transactions" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "drafts_modify_own" ON "public"."encounter_drafts" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "drafts_select_own" ON "public"."encounter_drafts" FOR SELECT USING (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."encounter_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."encounter_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "encounter_events_owner_all" ON "public"."encounter_events" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."encounter_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."encounters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "encounters_modify_own" ON "public"."encounters" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "encounters_owner_all" ON "public"."encounters" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "encounters_select_own" ON "public"."encounters" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "encounters_select_owner" ON "public"."encounters" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "evolution_delete_owner" ON "public"."patient_evolution" FOR DELETE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "evolution_insert_owner" ON "public"."patient_evolution" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "evolution_select_owner" ON "public"."patient_evolution" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "evolution_update_owner" ON "public"."patient_evolution" FOR UPDATE USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."financial_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_entries_own_rows" ON "public"."financial_entries" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "insert own subscription" ON "public"."push_subscriptions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "insert professional_files by tenant" ON "public"."professional_files" FOR INSERT WITH CHECK (("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid"));



CREATE POLICY "insert_own" ON "public"."appointment_history" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "insert_own" ON "public"."appointment_journeys" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "insert_own" ON "public"."appointment_slots" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "insert_own" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "insert_own" ON "public"."financial_entries" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "insert_own" ON "public"."patients" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "insert_own" ON "public"."professionals" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "insert_own" ON "public"."reports" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "insert_own" ON "public"."transactions" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "notes_insert_own" ON "public"."encounter_notes" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "notes_select_own" ON "public"."encounter_notes" FOR SELECT USING (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."patient_evolution" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_evolution_files" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patient_evolution_insert_owner" ON "public"."patient_evolution" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "patient_evolution_select_owner" ON "public"."patient_evolution" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patients_modify" ON "public"."patients" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "patients_own_rows" ON "public"."patients" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "patients_select" ON "public"."patients" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "pe_delete_owner" ON "public"."patient_evolution" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "pe_insert_owner" ON "public"."patient_evolution" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "pe_select_owner" ON "public"."patient_evolution" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "pe_update_owner" ON "public"."patient_evolution" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "pef_delete_by_tenant" ON "public"."patient_evolution_files" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."patient_evolution" "pe"
     JOIN "public"."profiles" "p_owner" ON (("p_owner"."id" = "pe"."owner_id")))
     JOIN "public"."profiles" "p_me" ON (("p_me"."id" = "auth"."uid"())))
  WHERE (("pe"."id" = "patient_evolution_files"."evolution_id") AND ("p_owner"."tenant_id" = "p_me"."tenant_id")))));



CREATE POLICY "pef_delete_owner" ON "public"."patient_evolution_files" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."patient_evolution" "pe"
  WHERE (("pe"."id" = "patient_evolution_files"."evolution_id") AND ("pe"."owner_id" = "auth"."uid"())))));



CREATE POLICY "pef_insert_by_tenant" ON "public"."patient_evolution_files" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."patient_evolution" "pe"
     JOIN "public"."profiles" "p_owner" ON (("p_owner"."id" = "pe"."owner_id")))
     JOIN "public"."profiles" "p_me" ON (("p_me"."id" = "auth"."uid"())))
  WHERE (("pe"."id" = "patient_evolution_files"."evolution_id") AND ("p_owner"."tenant_id" = "p_me"."tenant_id")))));



CREATE POLICY "pef_insert_owner" ON "public"."patient_evolution_files" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."patient_evolution" "pe"
  WHERE (("pe"."id" = "patient_evolution_files"."evolution_id") AND ("pe"."owner_id" = "auth"."uid"())))));



CREATE POLICY "pef_select_by_tenant" ON "public"."patient_evolution_files" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."patient_evolution" "pe"
     JOIN "public"."profiles" "p_owner" ON (("p_owner"."id" = "pe"."owner_id")))
     JOIN "public"."profiles" "p_me" ON (("p_me"."id" = "auth"."uid"())))
  WHERE (("pe"."id" = "patient_evolution_files"."evolution_id") AND ("p_owner"."tenant_id" = "p_me"."tenant_id")))));



CREATE POLICY "pef_select_owner" ON "public"."patient_evolution_files" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."patient_evolution" "pe"
  WHERE (("pe"."id" = "patient_evolution_files"."evolution_id") AND ("pe"."owner_id" = "auth"."uid"())))));



CREATE POLICY "pef_update_by_tenant" ON "public"."patient_evolution_files" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."patient_evolution" "pe"
     JOIN "public"."profiles" "p_owner" ON (("p_owner"."id" = "pe"."owner_id")))
     JOIN "public"."profiles" "p_me" ON (("p_me"."id" = "auth"."uid"())))
  WHERE (("pe"."id" = "patient_evolution_files"."evolution_id") AND ("p_owner"."tenant_id" = "p_me"."tenant_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."patient_evolution" "pe"
     JOIN "public"."profiles" "p_owner" ON (("p_owner"."id" = "pe"."owner_id")))
     JOIN "public"."profiles" "p_me" ON (("p_me"."id" = "auth"."uid"())))
  WHERE (("pe"."id" = "patient_evolution_files"."evolution_id") AND ("p_owner"."tenant_id" = "p_me"."tenant_id")))));



CREATE POLICY "pef_update_owner" ON "public"."patient_evolution_files" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."patient_evolution" "pe"
  WHERE (("pe"."id" = "patient_evolution_files"."evolution_id") AND ("pe"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."patient_evolution" "pe"
  WHERE (("pe"."id" = "patient_evolution_files"."evolution_id") AND ("pe"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."professional_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professionals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "professionals_insert_owner" ON "public"."professionals" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "professionals_modify" ON "public"."professionals" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "professionals_own_rows" ON "public"."professionals" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "professionals_select" ON "public"."professionals" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "professionals_select_owner" ON "public"."professionals" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "professionals_update_owner" ON "public"."professionals" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles select own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles update own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles upsert own" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_insert_self" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "push_delete_own" ON "public"."push_subscriptions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "push_insert_own" ON "public"."push_subscriptions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "push_select_own" ON "public"."push_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_update_own" ON "public"."push_subscriptions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "read professionals" ON "public"."professionals" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read_own" ON "public"."appointment_history" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "read_own" ON "public"."appointment_journeys" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "read_own" ON "public"."appointment_slots" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "read_own" ON "public"."appointments" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "read_own" ON "public"."financial_entries" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "read_own" ON "public"."patients" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "read_own" ON "public"."professionals" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "read_own" ON "public"."reports" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "read_own" ON "public"."transactions" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select own subscription" ON "public"."push_subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "select professional_files by tenant" ON "public"."professional_files" FOR SELECT USING (("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid"));



CREATE POLICY "tenant can insert" ON "public"."certificates" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "tenant can see" ON "public"."certificates" FOR SELECT USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "tenant can update" ON "public"."certificates" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "tenant_delete_professional_files" ON "public"."professional_files" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."tenant_id" = "professional_files"."tenant_id")))));



CREATE POLICY "tenant_insert_professional_files" ON "public"."professional_files" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."tenant_id" = "professional_files"."tenant_id")))));



CREATE POLICY "tenant_select_professional_files" ON "public"."professional_files" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."tenant_id" = "professional_files"."tenant_id")))));



CREATE POLICY "tenant_update_professional_files" ON "public"."professional_files" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."tenant_id" = "professional_files"."tenant_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."tenant_id" = "professional_files"."tenant_id")))));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_modify" ON "public"."transactions" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "transactions_own_rows" ON "public"."transactions" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "transactions_select" ON "public"."transactions" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "update professionals" ON "public"."professionals" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "update_own" ON "public"."appointment_history" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "update_own" ON "public"."appointment_journeys" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "update_own" ON "public"."appointment_slots" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "update_own" ON "public"."appointments" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "update_own" ON "public"."financial_entries" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "update_own" ON "public"."patients" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "update_own" ON "public"."professionals" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "update_own" ON "public"."reports" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "update_own" ON "public"."transactions" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "users can update own push subscription" ON "public"."push_subscriptions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";












GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."_evo_fill_modality"() TO "anon";
GRANT ALL ON FUNCTION "public"."_evo_fill_modality"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_evo_fill_modality"() TO "service_role";



GRANT ALL ON FUNCTION "public"."call_push_cron"() TO "anon";
GRANT ALL ON FUNCTION "public"."call_push_cron"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."call_push_cron"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_encounter"("p_appointment_id" "uuid", "p_meta" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_encounter"("p_appointment_id" "uuid", "p_meta" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_encounter"("p_appointment_id" "uuid", "p_meta" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."finalize_encounter"("p_encounter_id" "uuid", "p_options" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."finalize_encounter"("p_encounter_id" "uuid", "p_options" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_encounter"("p_encounter_id" "uuid", "p_options" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_set_owner_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_set_owner_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_set_owner_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."moddatetime"() TO "anon";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pe_apply_defaults_from_appointment"() TO "anon";
GRANT ALL ON FUNCTION "public"."pe_apply_defaults_from_appointment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pe_apply_defaults_from_appointment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pe_apply_modality"() TO "anon";
GRANT ALL ON FUNCTION "public"."pe_apply_modality"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pe_apply_modality"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pef_fill_tenant_from_evolution"() TO "anon";
GRANT ALL ON FUNCTION "public"."pef_fill_tenant_from_evolution"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pef_fill_tenant_from_evolution"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_evo_files_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_evo_files_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_evo_files_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_evolution_modality_from_appointment"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_evolution_modality_from_appointment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_evolution_modality_from_appointment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_evolution_professional"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_evolution_professional"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_evolution_professional"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_owner_and_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_owner_and_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_owner_and_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_owner_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_owner_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_owner_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_patient_evolution_specialty"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_patient_evolution_specialty"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_patient_evolution_specialty"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_tenant_id_if_null"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_tenant_id_if_null"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_tenant_id_if_null"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";
























GRANT ALL ON TABLE "public"."appointment_history" TO "anon";
GRANT ALL ON TABLE "public"."appointment_history" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_history" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_journeys" TO "anon";
GRANT ALL ON TABLE "public"."appointment_journeys" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_journeys" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_slots" TO "anon";
GRANT ALL ON TABLE "public"."appointment_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_slots" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."certificates" TO "anon";
GRANT ALL ON TABLE "public"."certificates" TO "authenticated";
GRANT ALL ON TABLE "public"."certificates" TO "service_role";



GRANT ALL ON TABLE "public"."encounter_drafts" TO "anon";
GRANT ALL ON TABLE "public"."encounter_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."encounter_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."encounter_events" TO "anon";
GRANT ALL ON TABLE "public"."encounter_events" TO "authenticated";
GRANT ALL ON TABLE "public"."encounter_events" TO "service_role";



GRANT ALL ON TABLE "public"."encounter_notes" TO "anon";
GRANT ALL ON TABLE "public"."encounter_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."encounter_notes" TO "service_role";



GRANT ALL ON TABLE "public"."encounters" TO "anon";
GRANT ALL ON TABLE "public"."encounters" TO "authenticated";
GRANT ALL ON TABLE "public"."encounters" TO "service_role";



GRANT ALL ON TABLE "public"."financial_entries" TO "anon";
GRANT ALL ON TABLE "public"."financial_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_entries" TO "service_role";



GRANT ALL ON TABLE "public"."patient_evolution" TO "anon";
GRANT ALL ON TABLE "public"."patient_evolution" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_evolution" TO "service_role";



GRANT ALL ON TABLE "public"."patient_evolution_feed" TO "anon";
GRANT ALL ON TABLE "public"."patient_evolution_feed" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_evolution_feed" TO "service_role";



GRANT ALL ON TABLE "public"."patient_evolution_files" TO "anon";
GRANT ALL ON TABLE "public"."patient_evolution_files" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_evolution_files" TO "service_role";



GRANT ALL ON TABLE "public"."patient_evolutions" TO "anon";
GRANT ALL ON TABLE "public"."patient_evolutions" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_evolutions" TO "service_role";



GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";



GRANT ALL ON TABLE "public"."professional_files" TO "anon";
GRANT ALL ON TABLE "public"."professional_files" TO "authenticated";
GRANT ALL ON TABLE "public"."professional_files" TO "service_role";



GRANT ALL ON TABLE "public"."professionals" TO "anon";
GRANT ALL ON TABLE "public"."professionals" TO "authenticated";
GRANT ALL ON TABLE "public"."professionals" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."push_notifications_delivery" TO "anon";
GRANT ALL ON TABLE "public"."push_notifications_delivery" TO "authenticated";
GRANT ALL ON TABLE "public"."push_notifications_delivery" TO "service_role";



GRANT ALL ON TABLE "public"."push_notifications_log" TO "anon";
GRANT ALL ON TABLE "public"."push_notifications_log" TO "authenticated";
GRANT ALL ON TABLE "public"."push_notifications_log" TO "service_role";



GRANT ALL ON TABLE "public"."push_outbox" TO "anon";
GRANT ALL ON TABLE "public"."push_outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."push_outbox" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."v_appointment_starts" TO "anon";
GRANT ALL ON TABLE "public"."v_appointment_starts" TO "authenticated";
GRANT ALL ON TABLE "public"."v_appointment_starts" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























