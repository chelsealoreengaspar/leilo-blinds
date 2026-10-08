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
const PAYMENTS = ["GCash", "Credit or debit card", "Bank transfer", "Cash on delivery"];
const STATUSES = ["Order placed", "Confirmed", "In production", "Quality check", "Out for delivery", "Delivered"];

// One shared cart, so it survives when the customer opens the admin page and returns.
const cart = new Cart();

export class StorefrontPage {
  #root;
  #orders = new OrderRepository();
  #fabrics = [];
  #view = "shop";
  #pay = PAYMENTS[0];
  #sel = { type: null, fabricId: null, color: null, width: 48, height: 60, casing: "Plastic", acetate: false, quantity: 1 };
  #track = { no: "", result: undefined, error: "" };

  constructor(root) { this.#root = root; }

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
    const tabs = [["shop", "Shop"], ["cart", count ? `Cart (${count})` : "Cart"], ["track", "Track order"]];
    const views = {
      shop: () => this.#shopHtml(), cart: () => this.#cartHtml(),
      checkout: () => this.#checkoutHtml(), track: () => this.#trackHtml(),
    };
    const binders = {
      shop: () => this.#bindShop(), cart: () => this.#bindCart(),
      checkout: () => this.#bindCheckout(), track: () => this.#bindTrack(),
    };
    if (this.#view === "checkout" && cart.isEmpty) this.#view = "cart";
    this.#root.innerHTML = `<header><div class="brand"><span class="dot"></span>Leilo Blinds</div>
      <nav>${tabs.map(([v, l]) => `<button type="button" class="tab ${this.#view === v || (v === "cart" && this.#view === "checkout") ? "on" : ""}" data-go="${v}">${l}</button>`).join("")}<a class="tab" href="#/admin">Admin</a></nav></header>
      <main>${views[this.#view]()}</main>`;
    this.#root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => this.#go(b.dataset.go)));
    binders[this.#view]();
  }

  #go(view) { this.#view = view; this.#draw(); scrollTo(0, 0); }

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
    return `<h1>Design your blinds</h1>
      <p class="sub">Choose a style, set your window size in inches, and watch the price and preview update.</p>
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
        <button type="button" class="btn" id="add" ${ok ? "" : "disabled"}>Add to cart</button>
        <button type="button" class="btn ghost" data-go="cart">View cart (${cart.items.length})</button>
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
      return `<div class="card empty"><h2>Your cart is empty</h2><p>Add a blind to start your order.</p>
        <button type="button" class="btn fit" data-go="shop">Design a blind</button></div>`;
    }
    const count = cart.items.reduce((s, i) => s + i.quantity, 0);
    return `<h1>Order summary</h1><p class="sub">Review your blinds before checkout. You can add as many as you need.</p>
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
        <div class="ln">Delivery and installation<b>Free</b></div>
        <div class="tot"><span>Total</span><span>${peso(cart.subtotal)}</span></div>
        <div class="actions"><button type="button" class="btn" data-go="checkout">Proceed to checkout</button></div></aside></div>`;
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
  }

  // ---------- checkout and payment ----------
  #checkoutHtml() {
    return `<h1>Checkout and payment</h1><p class="sub">Tell us where to deliver and how you would like to pay.</p>
      <form id="checkout" class="layout"><div class="stack">
        <section class="card"><h3>Delivery details</h3>
          <div class="two"><label>Full name<input name="name" required></label><label>Mobile number<input name="phone" type="tel" required></label></div>
          <label>Email<input name="email" type="email"></label>
          <label>Address<textarea name="address" rows="2" required></textarea></label></section>
        <section class="card"><h3>Payment method</h3>
          <div class="opts">${PAYMENTS.map((p) => `<button type="button" class="opt ${p === this.#pay ? "on" : ""}" data-pay="${p}">${p}</button>`).join("")}</div>
          <p class="note">Payment is not processed yet. This records your order.</p></section>
      </div><aside class="card sticky"><h3>Your order</h3>
        ${cart.items.map((i) => `<div class="ln"><span>${i.quantity} x ${esc(i.fabric.blind_type)}, ${i.width} x ${i.height} in</span><b>${peso(PricingService.lineTotal(i))}</b></div>`).join("")}
        <div class="tot"><span>Total</span><span>${peso(cart.subtotal)}</span></div>
        <p class="err" id="err"></p>
        <div class="actions"><button type="submit" class="btn">Place order</button></div></aside></form>`;
  }

  #bindCheckout() {
    const form = this.#root.querySelector("#checkout");
    form.querySelectorAll("[data-pay]").forEach((b) => b.addEventListener("click", () => {
      this.#pay = b.dataset.pay;
      form.querySelectorAll("[data-pay]").forEach((x) => x.classList.toggle("on", x === b));
    }));
    form.addEventListener("submit", (e) => this.#placeOrder(e));
  }

  async #placeOrder(e) {
    e.preventDefault();
    const form = e.target;
    const button = form.querySelector("[type=submit]");
    const customer = { ...Object.fromEntries(new FormData(form)), payment: this.#pay };
    button.disabled = true;
    try {
      const orderNo = await this.#orders.place(customer, cart.toPayload());
      cart.clear();
      this.#track = { no: orderNo, result: undefined, error: "" };
      this.#view = "track";
      this.#toast("Order placed");
      await this.#lookup();
    } catch (err) {
      form.querySelector("#err").textContent = err.message;
      button.disabled = false;
    }
  }

  // ---------- order status ----------
  #trackHtml() {
    const t = this.#track;
    const r = t.result;
    const index = r ? STATUSES.indexOf(r.status) : -1;
    return `<h1>Track your order</h1><p class="sub">Enter your order number to see where your blinds are.</p>
      <section class="card"><div class="trackbar">
        <label class="grow">Order number<input id="trackNo" value="${esc(t.no)}" placeholder="BL-261008-1234"></label>
        <button type="button" class="btn fit" id="trackBtn">Track order</button></div></section>
      ${t.error ? `<p class="err">${esc(t.error)}</p>` : ""}
      ${r === null ? '<p class="err">No order found with that number. Check it and try again.</p>' : ""}
      ${r ? `<section class="card"><h3>${esc(r.order_no)}</h3>
        <div class="tl">${STATUSES.map((s, n) => `<div class="${n <= index ? "done" : ""} ${n === index ? "now" : ""}">${s}</div>`).join("")}</div>
        <div class="ln">Total<b>${peso(r.total)}</b></div></section>` : ""}`;
  }

  #bindTrack() {
    const input = this.#root.querySelector("#trackNo");
    input.addEventListener("input", () => { this.#track.no = input.value; });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.#lookup(); });
    this.#root.querySelector("#trackBtn").addEventListener("click", () => this.#lookup());
  }

  async #lookup() {
    const no = this.#track.no.trim();
    if (!no) { this.#draw(); return; }
    try { this.#track.result = await this.#orders.track(no); this.#track.error = ""; }
    catch (err) { this.#track.result = undefined; this.#track.error = err.message; }
    this.#draw();
  }
}
