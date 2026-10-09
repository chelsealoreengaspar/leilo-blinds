import { SupabaseClient } from "../config/SupabaseClient.js";

export class StyleRepository {
  #db = SupabaseClient.get();

  // Active blind styles in display order, each with its description and picture path.
  async list() {
    const { data, error } = await this.#db
      .from("blind_styles").select("*").eq("active", true)
      .order("sort_order").order("name");
    if (error) throw error;
    return data;
  }
}