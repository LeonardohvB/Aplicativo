// src/components/Dashboard/PushTestButton.tsx
import { useState } from "react";

/**
 * Botão de teste de notificação (visível apenas em ambiente DEV)
 */
export default function PushTestButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Oculta o botão em produção
  if (!import.meta.env.DEV) return null;

  const handleSend = async () => {
    setMsg(null);
    setLoading(true);

    try {
      const res = await fetch(
        `https://yhcxdcnveyxntfzwaovp.functions.supabase.co/push`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "x-admin-token": "dlashld51312qwdqdws65432asd",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            title: "🚀 Notificação de teste",
            body: "Seu sistema de push está funcionando!",
            url: "/",
            tag: "teste",
          }),
        }
      );

      const data = await res.json();

      if (res.ok && data?.count) {
        setMsg("✅ Notificação enviada com sucesso!");
      } else {
        setMsg(`⚠️ Erro: ${JSON.stringify(data)}`);
      }
    } catch (e: any) {
      setMsg(`❌ Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col items-start">
      <button
        onClick={handleSend}
        disabled={loading}
        className={`px-4 py-2 rounded-lg text-white shadow transition ${
          loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {loading ? "Enviando..." : "🔔 Enviar notificação de teste"}
      </button>
      {msg && <p className="text-sm mt-2 text-gray-700">{msg}</p>}
    </div>
  );
}
