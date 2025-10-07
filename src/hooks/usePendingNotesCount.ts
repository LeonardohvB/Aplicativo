import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function usePendingNotesCount(pollMs = 30000) {
  const [count, setCount] = useState<number>(0);
  async function load() {
    const { count } = await supabase
      .from("appointment_history")
      .select("*", { count: "exact", head: true })
      .eq("note_status", "pending");
    setCount(count || 0);
  }
  useEffect(() => {
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, []);
  return count;
}
