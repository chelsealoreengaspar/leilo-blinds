import { SupabaseClient } from "../config/SupabaseClient.js";

export class OrderRepository {
  #db = SupabaseClient.get();

  async place(customer, items) {
    const { data, error } = await this.#db.rpc("place_order", { customer, items });
    if (error) throw error;
    return data;
  }

  // Admin only: orders with their items and extra charges.
  async listAll() {
    const { data, error } = await this.#db
      .from("orders").select("*, order_items(*), order_charges(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async updateStatus(id, status) {
    const { error } = await this.#db.from("orders").update({ status }).eq("id", id);
    if (error) throw error;
  }

  async addCharge(orderId, label, amount) {
    const { error } = await this.#db.from("order_charges").insert({ order_id: orderId, label, amount });
    if (error) throw error;
  }

  async removeCharge(id) {
    const { error } = await this.#db.from("order_charges").delete().eq("id", id);
    if (error) throw error;
  }
}
