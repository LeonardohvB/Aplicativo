// src/hooks/useEncounterDraft.ts
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export type SaveState = "idle" | "saving" | "saved" | "error";

export type EncounterDraft = {
  vitals?: { bp?: string; hr?: string; temp?: string; weight?: string; height?: string };
  S?: string;
  O?: string;
  A?: string;
  P?: string;
  meds?: any[];
  tags?: string[];
  updatedAt?: string; // ISO
};

const nowIso = () => new Date().toISOString();

type Options = { appointmentId?: string };

/**
 * Autosave do rascunho do encontro.
 * Agora com:
 * - fallback por appointment (salva local em `encdraft:appt:{appointmentId}` se não houver encounterId);
 * - migração automática do rascunho local p/ o encontro quando o encounterId ficar disponível;
 * - save remoto com debounce quando já houver encounterId.
 */
export function useEncounterDraft(encounterId?: string, opts?: Options) {
  const apptId = opts?.appointmentId;
  const encKey = encounterId ? `encdraft:${encounterId}` : null;
  const apptKey = !encounterId && apptId ? `encdraft:appt:${apptId}` : null;
  const activeKey = encKey || apptKey; // onde salvar local agora

  const [draft, setDraftState] = useState<EncounterDraft>({ updatedAt: nowIso() });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [rowId, setRowId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  /** Carrega rascunho mais recente: remoto (se tiver encounterId) vs local (encKey/apptKey) */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // 1) local (prioriza encKey se existir, senão apptKey)
      const readLocal = (key: string | null) => {
        if (!key) return null;
        try {
          const raw = localStorage.getItem(key);
          return raw ? (JSON.parse(raw) as EncounterDraft) : null;
        } catch {
          return null;
        }
      };
      const localEnc = readLocal(encKey);
      const localAppt = encKey ? null : readLocal(apptKey);
      const local = localEnc || localAppt;

      // 2) remoto (apenas se já houver encounterId)
      let remote: EncounterDraft | null = null;
      let remoteRowId: string | null = null;
      if (encounterId) {
        try {
          const { data } = await supabase
            .from("encounter_drafts")
            .select("id, data_json, updated_at")
            .eq("encounter_id", encounterId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (data) {
            remote = { ...(data.data_json || {}), updatedAt: data.updated_at || nowIso() };
            remoteRowId = data.id as string;
          }
        } catch {}
      }

      if (cancelled) return;

      // 3) escolhe o mais recente
      const localAt = local?.updatedAt ? Date.parse(local.updatedAt) : 0;
      const remoteAt = remote?.updatedAt ? Date.parse(remote.updatedAt) : 0;
      const chosen = (remoteAt >= localAt ? (remote || {}) : (local || {})) as EncounterDraft;

      setRowId(remoteRowId);
      setDraftState({ ...chosen, updatedAt: chosen.updatedAt || nowIso() });

      // 4) garante que o “ativo” local esteja preenchido com o escolhido (para manter consistência)
      if (activeKey && chosen && Object.keys(chosen).length) {
        try {
          localStorage.setItem(activeKey, JSON.stringify(chosen));
        } catch {}
      }
    };

    load();
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [encounterId, encKey, apptKey, activeKey]);

  /**
   * Migração automática:
   * se havia rascunho salvo no apptKey e o encounterId ficou disponível,
   * copia p/ encKey e insere/atualiza no Supabase, depois remove o apptKey.
   */
  useEffect(() => {
    if (!encounterId || !apptId) return;
    const tempKey = `encdraft:appt:${apptId}`;
    const toIso = (s?: string) => (s ? s : nowIso());

    try {
      const raw = localStorage.getItem(tempKey);
      if (!raw) return;
      const tempDraft = JSON.parse(raw) as EncounterDraft;

      // 1) joga p/ storage definitivo
      const finalKey = `encdraft:${encounterId}`;
      localStorage.setItem(finalKey, JSON.stringify(tempDraft));

      // 2) salva no Supabase (create se não houver row)
      (async () => {
        try {
          const { data: existing } = await supabase
            .from("encounter_drafts")
            .select("id")
            .eq("encounter_id", encounterId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existing?.id) {
            await supabase
              .from("encounter_drafts")
              .update({ data_json: tempDraft, updated_at: toIso(tempDraft.updatedAt) })
              .eq("id", existing.id);
            setRowId(existing.id);
          } else {
            const { data } = await supabase
              .from("encounter_drafts")
              .insert({ encounter_id: encounterId, data_json: tempDraft, updated_at: toIso(tempDraft.updatedAt) })
              .select("id")
              .single();
            setRowId(data?.id ?? null);
          }
        } catch (e) {
          console.warn("migration save error", e);
        } finally {
          // 3) remove temporário
          localStorage.removeItem(tempKey);
        }
      })();
    } catch {}
  }, [encounterId, apptId]);

  /** setter com debounce: salva no local (sempre) e no remoto (se já houver encounterId) */
  const setDraft = (updater: (d: EncounterDraft) => EncounterDraft) => {
    setDraftState((prev: EncounterDraft) => {
      const next = updater({ ...(prev || {}) });
      next.updatedAt = nowIso();

      // salva no local: se já temos encounterId usa encKey, senão apptKey
      const key = encKey || apptKey;
      if (key) {
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {}
      }

      // remoto com debounce (somente se houver encounterId)
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (encounterId) {
        timerRef.current = window.setTimeout(async () => {
          try {
            setSaveState("saving");
     const clientTs = nowIso();

if (rowId) {
  // Atualiza apenas se este save for MAIS NOVO que o que está no banco
  const { data: updated, error } = await supabase
    .from("encounter_drafts")
    .update({ data_json: next, updated_at: clientTs })
    .eq("id", rowId)
    .lt("updated_at", clientTs)   // 👈 guarda: só atualiza se o banco estiver com algo mais antigo
    .select("id, updated_at")
    .maybeSingle();

  if (error) throw error;
  // Se 'updated' vier null, significa que já existe um save mais novo no banco.
  // Nesse caso, simplesmente ignoramos este save antigo.
} else {
  // Primeira gravação: cria a linha
  const { data, error } = await supabase
    .from("encounter_drafts")
    .insert({ encounter_id: encounterId, data_json: next, updated_at: clientTs })
    .select("id")
    .single();
  if (error) throw error;
  setRowId(data.id as string);
}

            setSaveState("saved");
            window.setTimeout(() => setSaveState("idle"), 800);
          } catch (e) {
            console.warn("save draft error", e);
            setSaveState("error");
            window.setTimeout(() => setSaveState("idle"), 1200);
          }
        }, 500) as unknown as number;
      }

      return next;
    });
  };

  const clearLocal = () => {
    if (encKey) localStorage.removeItem(encKey);
    if (apptKey) localStorage.removeItem(apptKey);
  };

  return { draft, setDraft, saveState, clearLocal };
}
