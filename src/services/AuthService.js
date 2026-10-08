import { SupabaseClient } from "../config/SupabaseClient.js";

export class AuthService {
  #db = SupabaseClient.get();

  async signIn(email, password) {
    const { error } = await this.#db.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signOut() { await this.#db.auth.signOut(); }

  async isSignedIn() {
    const { data } = await this.#db.auth.getSession();
    return Boolean(data.session);
  }

  // Returns "admin", "agent", or null when the account is not on the staff list.
  async role() {
    if (!(await this.isSignedIn())) return null;
    const { data, error } = await this.#db.rpc("my_role");
    if (error) throw error;
    return data ?? null;
  }
}
