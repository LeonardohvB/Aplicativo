// src/components/EnablePushButton.tsx
import { useEffect, useState } from "react";
import { enableWebPush, disableWebPush, isPushSupported } from "../lib/push";
import { supabase } from "../lib/supabase";

type Props = {
  userId: string;
  tenantId?: string | null;
};

export default function EnablePushButton({ userId, tenantId = null }: Props) {
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = carregando
  const [msg, setMsg] = useState<string | null>(null);

  // quando montar, descobrir no Supabase se está ativo
  useEffect(() => {
    let alive = true;

    async function fetchStatus() {
      if (!userId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        console.warn("[EnablePushButton] erro ao ler push_subscriptions", error);
        setEnabled(false);
      } else {
        setEnabled(!!data);
      }
      setLoading(false);
    }

    fetchStatus();

    return () => {
      alive = false;
    };
  }, [userId]);

  async function handleEnable() {
    setMsg(null);
    if (!isPushSupported()) {
      setMsg("Seu navegador não suporta Web Push.");
      return;
    }
    setLoading(true);
    try {
      await enableWebPush({ tenantId,});
      setEnabled(true);
      setMsg("Notificações ativadas.");
    } catch (e: any) {
      setMsg(e?.message || "Erro ao ativar notificações.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setMsg(null);
    setLoading(true);
    try {
      await disableWebPush();
      setEnabled(false);
      setMsg("Notificações desativadas.");
    } catch (e: any) {
      setMsg(e?.message || "Erro ao desativar notificações.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 items-stretch">
      <button
        onClick={enabled ? handleDisable : handleEnable}
        disabled={loading || enabled === null}
        className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
          enabled
            ? "bg-slate-200 text-slate-900 hover:bg-slate-300"
            : "bg-blue-600 text-white hover:bg-blue-700"
        } ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
      >
        {enabled === null
          ? "Carregando..."
          : enabled
          ? loading
            ? "Desativando..."
            : "Desativar notificações"
          : loading
          ? "Ativando..."
          : "Ativar notificações"}
      </button>
      {msg ? <p className="text-xs text-slate-500">{msg}</p> : null}
    </div>
  );
}
