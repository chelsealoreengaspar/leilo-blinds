import { SupabaseClient } from "../config/SupabaseClient.js";

export class FabricRepository {
  #db = SupabaseClient.get();

  async list() {
    const { data, error } = await this.#db
      .from("fabrics").select("*").order("blind_type").order("name");
    if (error) throw error;
    return data;
  }
}
