import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useTenantId() {
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const tid = data.session?.user?.user_metadata?.tenant_id;
      if (tid) setTenantId(tid);
    });
  }, []);

  return tenantId;
}
