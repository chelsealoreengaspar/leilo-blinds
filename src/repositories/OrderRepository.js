import { SupabaseClient } from "../config/SupabaseClient.js";

export class OrderRepository {
  #db = SupabaseClient.get();

  async place(customer, items) {
    const { data, error } = await this.#db.rpc("place_order", { customer, items });
    if (error) throw error;
    return data;
  }

  async track(orderNo) {
    const { data, error } = await this.#db.rpc("track_order", { p_no: orderNo.trim() });
    if (error) throw error;
    return data[0] ?? null;
  }

  async listAll() {
    const { data, error } = await this.#db
      .from("orders").select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async updateStatus(id, status) {
    const { error } = await this.#db.from("orders").update({ status }).eq("id", id);
    if (error) throw error;
  }
}
