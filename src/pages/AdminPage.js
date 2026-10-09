import { OrderRepository } from "../repositories/OrderRepository.js";
import { ReportService } from "../services/ReportService.js";
import { peso, esc } from "../utils/format.js";
import { Brand } from "../components/Brand.js";

const STATUSES = ["Pending", "Completed", "Cancelled"];
const CHARGE_LABELS = ["Installation fee", "Transportation", "Other"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export class AdminPage {
  #root;
  #auth;
  #repo = new OrderRepository();
  #orders = [];
  #tab = "orders";
  #filter = "All";

  constructor(root, auth) { this.#root = root; this.#auth = auth; }

  async render() {
    this.#orders = await this.#repo.listAll();
    this.#draw();
  }

  // Runs a change, reloads the orders, and redraws the page.
  async #run(action) {
    try { await action(); this.#orders = await this.#repo.listAll(); this.#draw(); }
    catch (err) { alert(err.message); }
  }

  #draw() {
    const t = ReportService.totals(this.#orders);
    const list = this.#orders.filter((o) => this.#filter === "All" || o.status === this.#filter);
    this.#root.innerHTML = `<header>${Brand.html("admin")}
      <nav><a class="tab" href="#/">Order form</a><button type="button" class="tab" id="out">Sign out</button></nav></header>
      <main><h1>Admin dashboard</h1>
      <p class="sub">Mark each order Completed or Cancelled and add extra charges such as installation or transportation. Only Completed orders count as inflow.</p>
      <div class="kpis">
        <div class="kpi"><b>${peso(t.inflow)}</b><span>Inflow (completed)</span></div>
        <div class="kpi"><b>${peso(t.pendingValue)}</b><span>Pending value (${t.pending} orders)</span></div>
        <div class="kpi"><b>${t.completed}</b><span>Completed orders</span></div>
        <div class="kpi"><b>${t.cancelled}</b><span>Cancelled orders</span></div>
      </div>
      <div class="tabs">
        <button type="button" class="${this.#tab === "orders" ? "on" : ""}" data-tab="orders">Orders</button>
        <button type="button" class="${this.#tab === "month" ? "on" : ""}" data-tab="month">Monthly summary</button>
      </div>
      ${this.#tab === "orders" ? this.#ordersHtml(list) : this.#monthlyHtml()}
      <datalist id="labels">${CHARGE_LABELS.map((l) => `<option value="${l}">`).join("")}</datalist></main>`;
    this.#bind();
  }

  #ordersHtml(list) {
    return `<div class="tabs">${["All", ...STATUSES].map((s) =>
        `<button type="button" class="${this.#filter === s ? "on" : ""}" data-filter="${s}">${s}</button>`).join("")}</div>
      ${list.length ? list.map((o) => this.#orderHtml(o)).join("") : '<p class="note">No orders here yet.</p>'}`;
  }

  #orderHtml(o) {
    const charges = o.order_charges ?? [];
    return `<article class="card">
      <div class="ohead"><div><b>${esc(o.order_no)}</b> <span class="pill ${o.status.toLowerCase()}">${esc(o.status)}</span>
        <div class="note">${esc(o.customer_name)}${o.phone ? ", " + esc(o.phone) : ""}</div>
        ${o.address ? `<div class="note">${esc(o.address)}</div>` : ""}
        <div class="note">Agent: ${esc(o.agent_email ?? "not recorded")}, created ${esc(o.created_at.slice(0, 10))}</div>
        ${o.notes ? `<div class="note">Notes: ${esc(o.notes)}</div>` : ""}</div>
        <b class="big">${peso(ReportService.grandTotal(o))}</b></div>
      ${o.order_items.map((i) => `<div class="ln"><span>${i.quantity} x ${esc(i.blind_type)}, ${esc(i.fabric_name)}, ${esc(i.color)}, ${i.width_in} x ${i.height_in} in, ${esc(i.casing)}${i.acetate ? ", acetate cover" : ""}</span><b>${peso(i.unit_price * i.quantity)}</b></div>`).join("")}
      <div class="ln"><span>Items subtotal</span><b>${peso(o.total)}</b></div>
      ${charges.map((c) => `<div class="ln"><span>${esc(c.label)}</span><span><b>${peso(c.amount)}</b> <button type="button" class="link" data-rmcharge="${c.id}">Remove</button></span></div>`).join("")}
      <form class="chargeform" data-order="${o.id}">
        <input name="label" list="labels" placeholder="Installation fee" required>
        <input name="amount" type="number" step="0.01" placeholder="Amount" required>
        <button class="btn fit">Add charge</button>
      </form>
      <div class="opts">${STATUSES.map((s) => `<button type="button" class="opt ${o.status === s ? "on" : ""}" data-status="${s}" data-id="${o.id}">${s}</button>`).join("")}</div>
    </article>`;
  }

  #monthlyHtml() {
    const rows = ReportService.monthly(this.#orders);
    const top = Math.max(...rows.map((m) => m.inflow), 1);
    return `<section class="card tw"><table>
      <tr><th>Month</th><th>Orders</th><th>Pending</th><th>Completed</th><th>Cancelled</th><th>Inflow</th><th>Share of top month</th></tr>
      ${rows.map((m) => `<tr><td>${MONTHS[+m.month.slice(5) - 1]} ${m.month.slice(0, 4)}</td><td>${m.orders}</td><td>${m.pending}</td><td>${m.completed}</td><td>${m.cancelled}</td><td>${peso(m.inflow)}</td>
        <td><div class="bar"><i style="width:${(m.inflow / top) * 100}%"></i></div></td></tr>`).join("")}
    </table></section>`;
  }

  #bind() {
    const r = this.#root;
    r.querySelector("#out").addEventListener("click", async () => {
      await this.#auth.signOut();
      location.hash = "#/";
      location.reload();
    });
    r.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { this.#tab = b.dataset.tab; this.#draw(); }));
    r.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => { this.#filter = b.dataset.filter; this.#draw(); }));
    r.querySelectorAll("[data-status]").forEach((b) => b.addEventListener("click", () =>
      this.#run(() => this.#repo.updateStatus(Number(b.dataset.id), b.dataset.status))));
    r.querySelectorAll("[data-rmcharge]").forEach((b) => b.addEventListener("click", () =>
      this.#run(() => this.#repo.removeCharge(Number(b.dataset.rmcharge)))));
    r.querySelectorAll(".chargeform").forEach((f) => f.addEventListener("submit", (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      this.#run(() => this.#repo.addCharge(Number(f.dataset.order), d.label.trim(), Number(d.amount)));
    }));
  }
}