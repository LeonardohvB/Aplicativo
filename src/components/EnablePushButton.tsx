// src/components/EnablePushButton.tsx
import { useEffect, useState } from "react";
import { enableWebPush, disableWebPush, isPushSupported, getCurrentSubscriptionEndpoint } from "../lib/push";

type Props = {
  userId: string;
  tenantId?: string | null;
};

export default function EnablePushButton({ userId, tenantId = null }: Props) {
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setSupported(isPushSupported());
    (async () => {
      const ep = await getCurrentSubscriptionEndpoint();
      setActive(!!ep);
    })();
  }, []);

  const onEnable = async () => {
    setMsg(null);
    if (!supported) {
      setMsg("Seu navegador não suporta Web Push.");
      return;
    }
    setLoading(true);
    try {
      await enableWebPush({ userId, tenantId });
      setActive(true);
      setMsg("Notificações ativadas! ✅");
    } catch (e: any) {
      setMsg(e?.message || "Falha ao ativar notificações.");
    } finally {
      setLoading(false);
    }
  };

  const onDisable = async () => {
    setMsg(null);
    setLoading(true);
    try {
      await disableWebPush();
      setActive(false);
      setMsg("Notificações desativadas.");
    } catch (e: any) {
      setMsg(e?.message || "Falha ao desativar.");
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return (
      <div className="text-xs text-gray-500">
        Notificações não suportadas neste dispositivo/navegador.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {active ? (
        <button
          onClick={onDisable}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl bg-gray-200 text-gray-800 text-sm"
        >
          {loading ? "Desativando..." : "Desativar notificações"}
        </button>
      ) : (
        <button
          onClick={onEnable}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-sm shadow"
        >
          {loading ? "Ativando..." : "Ativar notificações"}
        </button>
      )}
      {active !== null && (
        <span className="text-[10px] text-gray-500">
          {active ? "Ativo" : "Inativo"}
        </span>
      )}
      {msg && <span className="text-xs text-gray-600 ml-2">{msg}</span>}
    </div>
  );
}
