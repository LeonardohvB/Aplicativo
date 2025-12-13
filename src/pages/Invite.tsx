import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type InviteData = {
  tenant_name: string;
  owner_name: string;
  email: string;
};


export default function Invite() {
  const [token, setToken] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InviteData | null>(null);
  const [inviteRow, setInviteRow] = useState<any>(null);
  // Senha
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  

  // ============================
  // Lê token da URL
  // ============================
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");

    if (!t) {
      setInvalid(true);
      setLoading(false);
    } else {
      setToken(t);
    }
  }, []);

  // ============================
  // Busca dados do convite
  // ============================
  useEffect(() => {
    if (!token) return;

    (async () => {
      setLoading(true);

      const { data: invite, error } = await supabase
  .from("invites")
  .select("tenant_id, invited_by, email")
  .eq("token", token)
  .maybeSingle();


      if (error || !invite) {
        setInvalid(true);
        setLoading(false);
        return;
      }

      setInviteRow(invite);


      const [{ data: tenant }, { data: owner }] = await Promise.all([
        supabase
          .from("tenants")
          .select("name")
          .eq("id", invite.tenant_id)
          .maybeSingle(),

        supabase
          .from("profiles")
          .select("name")
          .eq("id", invite.invited_by)
          .maybeSingle(),
      ]);

      if (!tenant || !owner) {
        setInvalid(true);
        setLoading(false);
        return;
      }

      setData({
  tenant_name: tenant.name,
  owner_name: owner.name,
  email: invite.email,
});


      setLoading(false);
    })();
  }, [token]);

  // ============================
  // Validação de senha
  // ============================
  const isPasswordValid =
    password.length >= 6 && password === confirmPassword;

  // ============================
  // Estados de tela
  // ============================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-500">Carregando convite…</span>
      </div>
    );
  }

  if (invalid || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-xl shadow p-6 max-w-md w-full text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Convite inválido
          </h1>
          <p className="text-sm text-gray-600">
            Este link de convite é inválido, expirado ou já foi utilizado.
          </p>
        </div>
      </div>
    );
  }

  // ============================
  // Tela válida
  // ============================
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Você foi convidado
        </h1>

        <p className="text-sm text-gray-600 mb-6">
          <strong>{data.owner_name}</strong> convidou você para acessar a clínica{" "}
          <strong>{data.tenant_name}</strong>.
        </p>

        <div className="space-y-3">
          <input
            type="password"
            placeholder="Crie uma senha"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrorMsg(null);
            }}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="password"
            placeholder="Confirme a senha"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setErrorMsg(null);
            }}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {errorMsg && (
          <div className="text-sm text-red-600 mt-3">
            {errorMsg}
          </div>
        )}

       <button
  disabled={!isPasswordValid}
 onClick={async () => {
  setErrorMsg(null);

  if (password.length < 6) {
    setErrorMsg("A senha deve ter no mínimo 6 caracteres.");
    return;
  }

  if (password !== confirmPassword) {
    setErrorMsg("As senhas não conferem.");
    return;
  }

  if (!data?.email || !inviteRow) {
    setErrorMsg("Erro ao identificar os dados do convite.");
    return;
  }

  const { error } = await supabase.auth.signUp({
    email: data.email,
    password,
    options: {
      data: {
        tenant_id: inviteRow.tenant_id,
        role: "professional",
      },
    },
  });

  if (error) {
    setErrorMsg(error.message);
    return;
  }

  alert("Conta criada com sucesso. Você já pode acessar o sistema.");



    alert("Perfil do profissional atualizado com sucesso.");
  }}
  className={`mt-6 w-full py-2 rounded-lg text-sm font-medium transition ${
    isPasswordValid
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : "bg-gray-300 text-gray-500 cursor-not-allowed"
  }`}
>
  Criar acesso
</button>

      </div>
    </div>
  );
}
