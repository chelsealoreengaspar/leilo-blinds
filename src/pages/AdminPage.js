import { AuthService } from "../services/AuthService.js";
import { OrderRepository } from "../repositories/OrderRepository.js";
import { ReportService } from "../services/ReportService.js";
import { peso, esc } from "../utils/format.js";

const STATUSES = ["Order placed", "Confirmed", "In production", "Quality check", "Out for delivery", "Delivered"];

export class AdminPage {
  #root;
  #auth = new AuthService();
  #orders = new OrderRepository();

  constructor(root) { this.#root = root; }

  async render() {
    if (!(await this.#auth.isSignedIn())) return this.#renderLogin();
    await this.#renderDashboard();
  }

  #renderLogin() {
    this.#root.innerHTML = `<header><b>Leilo Blinds</b><a href="#/">Back to shop</a></header>
      <main><h1>Admin sign in</h1>
      <form id="login" class="card">
        <input name="email" type="email" placeholder="Email" required>
        <input name="password" type="password" placeholder="Password" required>
        <button>Sign in</button><p id="err"></p>
      </form></main>`;
    this.#root.querySelector("#login").addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      try { await this.#auth.signIn(d.email, d.password); this.render(); }
      catch (err) { this.#root.querySelector("#err").textContent = err.message; }
    });
  }

  async #renderDashboard() {
    let orders;
    try { orders = await this.#orders.listAll(); }
    catch (err) { this.#root.innerHTML = `<main><h1>Could not load orders</h1><p>${esc(err.message)}</p></main>`; return; }
    const months = ReportService.monthly(orders);
    const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
    this.#root.innerHTML = `<header><b>Leilo Blinds admin</b><span><a href="#/">Shop</a> <button id="out" class="link">Sign out</button></span></header>
      <main><h1>Admin dashboard</h1>
      <p>${orders.length} orders, ${peso(revenue)} total revenue.</p>
      <h2>Monthly summary</h2>
      <div class="card tw"><table>
        <tr><th>Month</th><th>Orders</th><th>Blinds</th><th>Revenue</th></tr>
        ${months.map((m) => `<tr><td>${esc(m.month)}</td><td>${m.orders}</td><td>${m.blinds}</td><td>${peso(m.revenue)}</td></tr>`).join("")}
      </table></div>
      <h2>Orders</h2>
      ${orders.map((o) => `<div class="card">
        <b>${esc(o.order_no)}</b> ${esc(o.customer_name)}, ${esc(o.phone)}<br>${esc(o.address)}
        ${o.order_items.map((i) => `<span>${i.quantity} x ${esc(i.blind_type)}, ${esc(i.fabric_name)}, ${esc(i.color)}, ${i.width_in} x ${i.height_in} in, ${esc(i.casing)}${i.acetate ? ", acetate cover" : ""}</span>`).join("")}
        <p>Total: <b>${peso(o.total)}</b> (${esc(o.payment_method)})</p>
        <select data-id="${o.id}">${STATUSES.map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select>
      </div>`).join("")}</main>`;
    this.#root.querySelector("#out").addEventListener("click", async () => { await this.#auth.signOut(); this.render(); });
    this.#root.querySelectorAll("select[data-id]").forEach((s) =>
      s.addEventListener("change", () => this.#orders.updateStatus(Number(s.dataset.id), s.value)));
  }
}
