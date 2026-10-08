import { FabricRepository } from "../repositories/FabricRepository.js";
import { OrderRepository } from "../repositories/OrderRepository.js";
import { Cart } from "../services/Cart.js";
import { CartItem } from "../models/CartItem.js";
import { PricingService } from "../services/PricingService.js";
import { BlindPreview } from "../components/BlindPreview.js";
import { peso, esc } from "../utils/format.js";
 
const TYPE_NOTES = {
  "Combi Blinds": "Day and night stripes", "Roller Blinds": "Clean and flat",
  "HoneyComb": "Insulating cells", "Smart Curtain": "Motorized, app control",
};
// One shared cart, so it survives when the admin switches pages and returns.
const cart = new Cart();
 
export class StorefrontPage {
  #root;
  #auth;
  #role;
  #orders = new OrderRepository();
  #fabrics = [];
  #view = "shop";
  #saved = null;
  #sel = { type: null, fabricId: null, color: null, width: 48, height: 60, casing: "Plastic", acetate: false, quantity: 1 };
 
  constructor(root, auth, role) { this.#root = root; this.#auth = auth; this.#role = role; }
 
  async render() {
    try { this.#fabrics = await new FabricRepository().list(); }
    catch (err) {
      this.#root.innerHTML = `<main><h1>Could not load fabrics</h1><p>${esc(err.message)}</p></main>`;
      return;
    }
    if (!this.#fabrics.length) {
      this.#root.innerHTML = "<main><h1>No fabrics yet</h1><p>Add rows to the fabrics table in Supabase.</p></main>";
      return;
    }
    this.#pickType(this.#types[0]);
    this.#draw();
  }
 
  // ---------- selection state ----------
  get #types() { return [...new Set(this.#fabrics.map((f) => f.blind_type))]; }
  get #fabric() { return this.#fabrics.find((f) => f.id === this.#sel.fabricId); }
 
  #pickType(type) {
    this.#sel.type = type;
    this.#pickFabric(this.#fabrics.find((f) => f.blind_type === type).id);
  }
 
  #pickFabric(id) {
    const fabric = this.#fabrics.find((f) => f.id === id);
    this.#sel.fabricId = id;
    if (!fabric.colors.includes(this.#sel.color)) this.#sel.color = fabric.colors[0];
  }
 
  #currentItem() {
    const s = this.#sel;
    return new CartItem({
      fabric: this.#fabric, color: s.color, width: s.width, height: s.height,
      casing: s.casing, acetate: s.acetate, quantity: s.quantity,
    });
  }
 
  // ---------- layout ----------
  #draw() {
    const count = cart.items.reduce((s, i) => s + i.quantity, 0);
    const tabs = [["shop", "Shop"], ["cart", count ? `Cart (${count})` : "Cart"]];
    const views = {
      shop: () => this.#shopHtml(), cart: () => this.#cartHtml(),
      checkout: () => this.#checkoutHtml(), done: () => this.#doneHtml(),
    };
    const binders = {
      shop: () => this.#bindShop(), cart: () => this.#bindCart(),
      checkout: () => this.#bindCheckout(), done: () => this.#bindDone(),
    };
    if (this.#view === "checkout" && cart.isEmpty) this.#view = "cart";
    this.#root.innerHTML = `<header><div class="brand"><span class="dot"></span>Leilo Blinds</div>
      <nav>${tabs.map(([v, l]) => `<button type="button" class="tab ${this.#view === v || (v === "cart" && this.#view === "checkout") ? "on" : ""}" data-go="${v}">${l}</button>`).join("")}
      ${this.#role === "admin" ? '<a class="tab" href="#/admin">Admin</a>' : ""}
      <button type="button" class="tab" id="out">Sign out</button></nav></header>
      <main>${views[this.#view]()}</main>`;
    this.#root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => this.#go(b.dataset.go)));
    this.#root.querySelector("#out").addEventListener("click", () => this.#signOut());
    binders[this.#view]();
  }
 
  #go(view) { this.#view = view; this.#draw(); scrollTo(0, 0); }
 
  async #signOut() {
    await this.#auth.signOut();
    location.hash = "#/";
    location.reload();
  }
 
  #toast(message) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = message;
    document.body.append(t);
    setTimeout(() => t.remove(), 2000);
  }
 
  // ---------- shop ----------
  #shopHtml() {
    const s = this.#sel;
    const opt = (on, attr, label, sub) =>
      `<button type="button" class="opt ${on ? "on" : ""}" ${attr}>${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
    return `<h1>New order</h1>
      <p class="sub">Choose a style, set the window size in inches, and show the customer the preview and price.</p>
      <div class="layout"><div class="stack" id="shop">
        <section class="card"><h3>Type of blinds</h3><div class="opts">
          ${this.#types.map((t) => opt(t === s.type, `data-type="${esc(t)}"`, t, TYPE_NOTES[t])).join("")}</div></section>
        <section class="card"><h3>Fabric</h3><div class="opts">
          ${this.#fabrics.filter((f) => f.blind_type === s.type).map((f) =>
            opt(f.id === s.fabricId, `data-fabric="${f.id}"`, f.name, `${peso(f.price_per_sqft)} per sq ft`)).join("")}</div></section>
        <section class="card"><h3>Color</h3><div class="opts swatches">
          ${this.#fabric.colors.map((c) => `<div class="swl"><button type="button" class="sw ${c === s.color ? "on" : ""}"
            style="background:${BlindPreview.hex(c)}" aria-label="${esc(c)}" data-color="${esc(c)}"></button>${esc(c)}</div>`).join("")}</div></section>
        <section class="card"><h3>Size in inches</h3>
          <div class="two">
            <label>Width (in)<input name="width" type="number" min="12" max="120" value="${s.width}"></label>
            <label>Height (in)<input name="height" type="number" min="12" max="120" value="${s.height}"></label>
          </div>
          <p class="note">Each side can be 12 to 120 inches. Orders under ${PricingService.MIN_AREA_SQFT} sq ft are billed at ${PricingService.MIN_AREA_SQFT} sq ft.</p></section>
        <section class="card"><h3>Casing</h3><div class="opts">
          ${["Plastic", "Metal"].map((c) => opt(c === s.casing, `data-casing="${c}"`, c, `${peso(PricingService.CASING_PER_FT[c])} per ft of width`)).join("")}</div>
          <label class="check"><input name="acetate" type="checkbox" ${s.acetate ? "checked" : ""}> Add acetate cover (optional, ${peso(PricingService.ACETATE_FEE)})</label></section>
      </div><aside class="card sticky" id="quote"></aside></div>`;
  }
 
  #bindShop() {
    const shop = this.#root.querySelector("#shop");
    shop.addEventListener("click", (e) => {
      const b = e.target.closest("[data-type],[data-fabric],[data-color],[data-casing]");
      if (!b) return;
      const d = b.dataset;
      if (d.type) this.#pickType(d.type);
      else if (d.fabric) this.#pickFabric(Number(d.fabric));
      else if (d.color) this.#sel.color = d.color;
      else if (d.casing) this.#sel.casing = d.casing;
      this.#draw();
    });
    shop.addEventListener("input", (e) => {
      const t = e.target;
      if (t.name === "width" || t.name === "height") this.#sel[t.name] = Number(t.value);
      else if (t.name === "acetate") this.#sel.acetate = t.checked;
      this.#updateQuote();
    });
    this.#updateQuote();
  }
 
  // Redraws only the side panel, so typing in the size boxes keeps its focus.
  #updateQuote() {
    const box = this.#root.querySelector("#quote");
    const item = this.#currentItem();
    const ok = item.isValid;
    const unit = ok ? PricingService.unitPrice(item) : 0;
    const area = ok ? PricingService.area(item) : 0;
    box.innerHTML = `${BlindPreview.render(item)}<h3>Your blind</h3>
      <div class="ln">Style<b>${esc(item.fabric.blind_type)}</b></div>
      <div class="ln">Fabric and color<b>${esc(item.fabric.name)}, ${esc(item.color)}</b></div>
      <div class="ln">Size<b>${item.width || 0} x ${item.height || 0} in</b></div>
      <div class="ln">Casing<b>${esc(item.casing)}</b></div>
      <div class="ln">Acetate cover<b>${item.acetate ? "Yes" : "No"}</b></div>
      <div class="ln">Billable area<b>${area.toFixed(1)} sq ft</b></div>
      <div class="ln">Quantity<b class="qty"><button type="button" class="round" id="qm" aria-label="Less">-</button>${item.quantity}<button type="button" class="round" id="qp" aria-label="More">+</button></b></div>
      <div class="tot"><span>Total</span><span>${peso(unit * item.quantity)}</span></div>
      ${ok ? "" : '<p class="err">Enter a width and height between 12 and 120 inches.</p>'}
      <div class="actions">
        <button type="button" class="btn" id="add" ${ok ? "" : "disabled"}>Add to Quote</button>
        <button type="button" class="btn ghost" data-go="cart">View Quote (${cart.items.length})</button>
      </div>`;
    const step = (d) => { this.#sel.quantity = Math.max(1, this.#sel.quantity + d); this.#updateQuote(); };
    box.querySelector("#qm").addEventListener("click", () => step(-1));
    box.querySelector("#qp").addEventListener("click", () => step(1));
    box.querySelector("[data-go]").addEventListener("click", () => this.#go("cart"));
    box.querySelector("#add").addEventListener("click", () => {
      cart.add(this.#currentItem());
      this.#sel.quantity = 1;
      this.#toast("Added to cart");
      this.#draw();
    });
  }
 
  // ---------- cart (order summary) ----------
  #cartHtml() {
    if (cart.isEmpty) {
      return `<div class="card empty"><h2>The cart is empty</h2><p>Add a blind to start an order.</p>
        <button type="button" class="btn fit" data-go="shop">Design a blind</button></div>`;
    }
    const count = cart.items.reduce((s, i) => s + i.quantity, 0);
    return `<h1>Order summary</h1><p class="sub">Review the blinds with the customer. You can add as many as needed.</p>
      <div class="layout"><section class="card">
        ${cart.items.map((i, n) => `<div class="item">
          <div class="chip" style="background:${BlindPreview.hex(i.color)}"></div>
          <div class="grow"><b>${esc(i.fabric.blind_type)}</b>
            <div class="note">${esc(i.fabric.name)}, ${esc(i.color)}, ${i.width} x ${i.height} in, ${esc(i.casing)} casing${i.acetate ? ", acetate cover" : ""}</div>
            <div class="qty"><button type="button" class="round" data-q="${n}" data-d="-1" aria-label="Less">-</button>${i.quantity}
              <button type="button" class="round" data-q="${n}" data-d="1" aria-label="More">+</button>
              <button type="button" class="link" data-rm="${n}">Remove</button></div></div>
          <b>${peso(PricingService.lineTotal(i))}</b></div>`).join("")}
        <button type="button" class="link" data-go="shop">Add another blind</button></section>
      <aside class="card sticky"><h3>Totals</h3>
        <div class="ln">Blinds (${count})<b>${peso(cart.subtotal)}</b></div>
        <div class="note">Installation and transportation are added later by the admin.</div>
        <div class="tot"><span>Total</span><span>${peso(cart.subtotal)}</span></div>
        <div class="actions">
          <button type="button" class="btn" data-go="checkout">Continue to customer details</button>
          <button type="button" class="btn ghost" id="print">Print quote</button>
        </div></aside></div>`;
  }
 
  #bindCart() {
    this.#root.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => {
      const item = cart.items[Number(b.dataset.q)];
      item.quantity = Math.max(1, item.quantity + Number(b.dataset.d));
      this.#draw();
    }));
    this.#root.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => {
      cart.remove(Number(b.dataset.rm));
      this.#draw();
    }));
    const print = this.#root.querySelector("#print");
    if (print) print.addEventListener("click", () => window.print());
  }
 
  // ---------- customer details ----------
  #checkoutHtml() {
    return `<h1>Customer details</h1><p class="sub">Enter the customer's details to save this quotation and order.</p>
      <form id="checkout" class="layout"><div class="stack">
        <section class="card"><h3>Customer</h3>
          <div class="two"><label>Full name<input name="name" required></label><label>Contact number<input name="phone" type="tel" required></label></div>
          <label>Address<textarea name="address" rows="2" required></textarea></label>
          <label>Notes (optional)<textarea name="notes" rows="2" placeholder="Room, preferred install date, and so on"></textarea></label></section>
      </div><aside class="card sticky"><h3>Order</h3>
        ${cart.items.map((i) => `<div class="ln"><span>${i.quantity} x ${esc(i.fabric.blind_type)}, ${i.width} x ${i.height} in</span><b>${peso(PricingService.lineTotal(i))}</b></div>`).join("")}
        <div class="tot"><span>Total</span><span>${peso(cart.subtotal)}</span></div>
        <p class="err" id="err"></p>
        <div class="actions"><button type="submit" class="btn">Save order</button></div></aside></form>`;
  }
 
  #bindCheckout() {
    this.#root.querySelector("#checkout").addEventListener("submit", (e) => this.#placeOrder(e));
  }
 
  async #placeOrder(e) {
    e.preventDefault();
    const form = e.target;
    const button = form.querySelector("[type=submit]");
    const customer = Object.fromEntries(new FormData(form));
    for (const k of Object.keys(customer)) customer[k] = String(customer[k]).trim();
    if (!customer.name || !customer.phone || !customer.address) {
      form.querySelector("#err").textContent = "Enter the customer's name, contact number, and address.";
      return;
    }
    button.disabled = true;
    try {
      const items = cart.items;
      const total = cart.subtotal;
      const no = await this.#orders.place(customer, cart.toPayload());
      cart.clear();
      this.#saved = {
        no, customer, items, total,
        date: new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }),
      };
      this.#view = "done";
      this.#toast("Order saved");
      this.#draw();
      scrollTo(0, 0);
    } catch (err) {
      form.querySelector("#err").textContent = err.message;
      button.disabled = false;
    }
  }
 
  // ---------- saved summary (screenshot or PDF) ----------
  #doneHtml() {
    const s = this.#saved;
    const c = s.customer;
    return `<article class="card receipt">
        <div class="rhead">
          <div><div class="brand"><span class="dot"></span>Leilo Blinds</div><p class="note">Quotation and order</p></div>
          <div class="rmeta"><b>${esc(s.no)}</b><div class="note">${esc(s.date)}</div></div>
        </div>
        <section><h3>Customer</h3>
          <div>${esc(c.name)}</div><div>${esc(c.phone)}</div><div>${esc(c.address)}</div>
          ${c.notes ? `<div class="note">Notes: ${esc(c.notes)}</div>` : ""}</section>
        <section><h3>Order</h3>
          <table class="rtable"><tr><th>Item</th><th>Size</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr>
            ${s.items.map((i) => `<tr>
              <td><span class="mini" style="background:${BlindPreview.hex(i.color)}"></span><b>${esc(i.fabric.blind_type)}</b><div class="note">${esc(i.fabric.name)}, ${esc(i.color)}, ${esc(i.casing)} casing${i.acetate ? ", acetate cover" : ""}</div></td>
              <td>${i.width} x ${i.height} in</td><td class="num">${i.quantity}</td>
              <td class="num">${peso(PricingService.unitPrice(i))}</td><td class="num">${peso(PricingService.lineTotal(i))}</td></tr>`).join("")}
          </table></section>
        <div class="rtotal"><span>Total</span><span>${peso(s.total)}</span></div>
        <p class="note">Installation and transportation fees are quoted separately.</p>
      </article>
      <div class="receipt-actions noprint">
        <div class="actions">
          <button type="button" class="btn" id="pdf">Download as PDF</button>
          <button type="button" class="btn ghost" data-go="shop">Start a new order</button>
        </div>
        <p class="note">In the print window, choose Save as PDF as the destination. You can also take a screenshot of this page.</p>
      </div>`;
  }
 
  #bindDone() {
    this.#root.querySelector("#pdf").addEventListener("click", () => {
      const original = document.title;
      document.title = `Quotation ${this.#saved.no}`;
      window.print();
      document.title = original;
    });
  }
}
 
