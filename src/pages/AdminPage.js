import { OrderRepository } from "../repositories/OrderRepository.js";
import { ReportService } from "../services/ReportService.js";
import { peso, esc } from "../utils/format.js";
import { Brand } from "../components/Brand.js";
import { SHOP, ACK } from "../config/ShopInfo.js";

const STATUSES = ["Pending", "Completed", "Cancelled"];
const CHARGE_LABELS = ["Installation fee", "Transportation", "Other"];
// Peso amount that keeps centavos and negative values (for example a discount).
const money = (n) => {
  const v = Number(n);
  const text = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  return (v < 0 ? "-" : "") + "\u20B1" + text;
};
const longDate = (v) => (v ? new Date(v).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export class AdminPage {
  #root;
  #auth;
  #repo = new OrderRepository();
  #orders = [];
  #tab = "orders";
  #filter = "All";
  #ackId = null;

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
    if (this.#ackId !== null) { this.#drawAck(); return; }
    const t = ReportService.totals(this.#orders);
    const list = this.#orders.filter((o) => this.#filter === "All" || o.status === this.#filter);
    this.#root.innerHTML = `${this.#header()}
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
        <b class="big">${money(ReportService.grandTotal(o))}</b></div>
      ${o.order_items.map((i) => `<div class="ln"><span>${i.quantity} x ${esc(i.blind_type)}, ${esc(i.fabric_name)}, ${esc(i.color)}, ${i.width_in} x ${i.height_in} in, ${esc(i.casing)}${i.acetate ? ", acetate cover" : ""}</span><b>${peso(i.unit_price * i.quantity)}</b></div>`).join("")}
      <div class="ln"><span>Items subtotal</span><b>${money(o.total)}</b></div>
      ${charges.map((c) => `<div class="ln"><span>${esc(c.label)}</span><span><b>${money(c.amount)}</b> <button type="button" class="link" data-rmcharge="${c.id}">Remove</button></span></div>`).join("")}
      <form class="chargeform" data-order="${o.id}">
        <input name="label" list="labels" placeholder="Installation fee" required>
        <input name="amount" type="number" step="0.01" placeholder="Amount" required>
        <button class="btn fit">Add charge</button>
      </form>
      <div class="opts">${STATUSES.map((s) => `<button type="button" class="opt ${o.status === s ? "on" : ""}" data-status="${s}" data-id="${o.id}">${s}</button>`).join("")}</div>
      ${o.status === "Completed" ? `<button type="button" class="btn ghost fit" data-ack="${o.id}">Print acknowledgement</button>` : ""}
    </article>`;
  }

  #header() {
    return `<header>${Brand.html("admin")}
      <nav><a class="tab" href="#/">Order form</a><button type="button" class="tab" id="out">Sign out</button></nav></header>`;
  }

  #bindHeader() {
    this.#root.querySelector("#out").addEventListener("click", async () => {
      await this.#auth.signOut();
      location.hash = "#/";
      location.reload();
    });
  }

  // ---------- acknowledgement (screenshot or PDF) ----------
  #drawAck() {
    const o = this.#orders.find((x) => x.id === this.#ackId);
    if (!o || o.status !== "Completed") { this.#ackId = null; this.#draw(); return; }
    this.#root.innerHTML = `${this.#header()}<main>${this.#ackHtml(o)}
      <div class="receipt-actions noprint">
        <div class="actions">
          <button type="button" class="btn" id="pdf">Download as PDF</button>
          <button type="button" class="btn ghost" id="back">Back to orders</button>
        </div>
        <p class="note">In the print window, choose Save as PDF as the destination.</p>
      </div></main>`;
    this.#bindHeader();
    this.#root.querySelector("#back").addEventListener("click", () => { this.#ackId = null; this.#draw(); });
    this.#root.querySelector("#pdf").addEventListener("click", () => {
      const original = document.title;
      document.title = `Acknowledgement ${o.order_no}`;
      window.print();
      document.title = original;
    });
  }

  #ackHtml(o) {
    const charges = o.order_charges ?? [];
    const total = ReportService.grandTotal(o);
    const done = o.completed_at ?? o.created_at;
    const statement = ACK.statement
      .replaceAll("{customer}", () => o.customer_name).replaceAll("{total}", () => money(total))
      .replaceAll("{order}", () => o.order_no).replaceAll("{date}", () => longDate(done));
    const shopLines = [SHOP.address, SHOP.phone, SHOP.email].filter(Boolean);
    return `<article class="card receipt ack">
      <div class="rhead">
        <div>${Brand.html()}
          ${SHOP.name ? `<b>${esc(SHOP.name)}</b>` : ""}
          ${shopLines.map((l) => `<div class="note">${esc(l)}</div>`).join("")}</div>
        <div class="rmeta"><b>${esc(ACK.title)}</b><div>No. ${esc(o.order_no)}</div>
          <div class="note">Order date: ${esc(longDate(o.created_at))}</div>
          <div class="note">Completed: ${esc(longDate(done))}</div></div>
      </div>
      <section><h3>Customer</h3>
        <div>${esc(o.customer_name)}</div>${o.phone ? `<div>${esc(o.phone)}</div>` : ""}${o.address ? `<div>${esc(o.address)}</div>` : ""}
        ${ACK.showNotes && o.notes ? `<div class="note">Notes: ${esc(o.notes)}</div>` : ""}</section>
      <section><h3>Order</h3>
        <table class="rtable"><tr><th>Item</th><th>Size</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr>
          ${o.order_items.map((i) => `<tr>
            <td><b>${esc(i.blind_type)}</b><div class="note">${esc(i.fabric_name)}, ${esc(i.color)}, ${esc(i.casing)} casing${i.acetate ? ", acetate cover" : ""}</div></td>
            <td>${i.width_in} x ${i.height_in} in</td><td class="num">${i.quantity}</td>
            <td class="num">${money(i.unit_price)}</td><td class="num">${money(i.unit_price * i.quantity)}</td></tr>`).join("")}
        </table></section>
      <section class="ack-sum">
        <div class="ln"><span>Items subtotal</span><b>${money(o.total)}</b></div>
        ${charges.map((c) => `<div class="ln"><span>${esc(c.label)}</span><b>${money(c.amount)}</b></div>`).join("")}
      </section>
      <div class="rtotal"><span>Total</span><span>${money(total)}</span></div>
      <p class="ack-statement">${esc(statement)}</p>
      ${ACK.terms.length ? `<ul class="ack-terms">${ACK.terms.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      <div class="sigs">
        <div class="sig"><div class="sigline"></div><div class="note">${esc(ACK.preparedByLabel)}</div></div>
        <div class="sig"><div class="sigline"></div><div class="note">${esc(ACK.receivedByLabel)}</div><div>${esc(o.customer_name)}</div></div>
      </div>
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
    this.#bindHeader();
    r.querySelectorAll("[data-ack]").forEach((b) => b.addEventListener("click", () => {
      this.#ackId = Number(b.dataset.ack);
      this.#draw();
      scrollTo(0, 0);
    }));
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