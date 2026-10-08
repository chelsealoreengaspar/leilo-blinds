import { createClient } from "@supabase/supabase-js";

// Singleton: the whole app shares one connection.
export class SupabaseClient {
  static #instance = null;

  static get() {
    if (!SupabaseClient.#instance) {
      SupabaseClient.#instance = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
    }
    return SupabaseClient.#instance;
  }
}
