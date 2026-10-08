import { FabricRepository } from "../repositories/FabricRepository.js";
import { OrderRepository } from "../repositories/OrderRepository.js";
import { Cart } from "../services/Cart.js";
import { CartItem } from "../models/CartItem.js";
import { PricingService } from "../services/PricingService.js";
import { peso, esc } from "../utils/format.js";

export class StorefrontPage {
  #root;
  #fabrics = [];
  #cart = new Cart();
  #orders = new OrderRepository();

  constructor(root) { this.#root = root; }

  async render() {
    try {
      this.#fabrics = await new FabricRepository().list();
    } catch (err) {
      this.#root.innerHTML = `<main><h1>Could not load fabrics</h1><p>${esc(err.message)}</p></main>`;
      return;
    }
    const types = [...new Set(this.#fabrics.map((f) => f.blind_type))];
    this.#root.innerHTML = `
      <header><b>Leilo Blinds</b><a href="#/admin">Admin</a></header>
      <main>
        <h1>Design your blinds</h1>
        <form id="shop" class="card">
          <label>Type <select name="type">${types.map((t) => `<option>${esc(t)}</option>`).join("")}</select></label>
          <label>Fabric <select name="fabric"></select></label>
          <label>Color <select name="color"></select></label>
          <label>Width (in) <input name="width" type="number" min="12" max="120" value="48"></label>
          <label>Height (in) <input name="height" type="number" min="12" max="120" value="60"></label>
          <label>Casing <select name="casing"><option>Plastic</option><option>Metal</option></select></label>
          <label class="check"><input name="acetate" type="checkbox"> Acetate cover (optional)</label>
          <label>Quantity <input name="quantity" type="number" min="1" value="1"></label>
          <p>Price: <b id="price"></b></p>
          <button>Add to cart</button>
        </form>
        <section id="cart" class="card"></section>
        <section class="card">
          <h2>Track your order</h2>
          <input id="trackNo" placeholder="Order number">
          <button id="trackBtn">Track order</button>
          <p id="trackOut"></p>
        </section>
      </main>`;
    this.#bind();
    this.#syncFabrics();
    this.#renderCart();
  }

  get #form() { return this.#root.querySelector("#shop"); }

  #syncFabrics() {
    const f = this.#form;
    const list = this.#fabrics.filter((x) => x.blind_type === f.type.value);
    f.fabric.innerHTML = list.map((x) =>
      `<option value="${x.id}">${esc(x.name)} (${peso(x.price_per_sqft)}/sq ft)</option>`).join("");
    this.#syncColors();
  }

  #syncColors() {
    const f = this.#form;
    const fabric = this.#fabrics.find((x) => x.id === Number(f.fabric.value));
    f.color.innerHTML = fabric.colors.map((c) => `<option>${esc(c)}</option>`).join("");
    this.#updatePrice();
  }

  #currentItem() {
    const f = this.#form;
    return new CartItem({
      fabric: this.#fabrics.find((x) => x.id === Number(f.fabric.value)),
      color: f.color.value, width: f.width.value, height: f.height.value,
      casing: f.casing.value, acetate: f.acetate.checked, quantity: f.quantity.value,
    });
  }

  #updatePrice() {
    const item = this.#currentItem();
    this.#root.querySelector("#price").textContent =
      item.isValid ? peso(PricingService.lineTotal(item)) : "Sizes must be 12 to 120 inches";
  }

  #bind() {
    const f = this.#form;
    f.addEventListener("input", (e) => {
      if (e.target.name === "type") this.#syncFabrics();
      else if (e.target.name === "fabric") this.#syncColors();
      else this.#updatePrice();
    });
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const item = this.#currentItem();
      if (!item.isValid) return;
      this.#cart.add(item);
      this.#renderCart();
    });
    this.#root.querySelector("#trackBtn").addEventListener("click", () => this.#track());
  }

  #renderCart() {
    const box = this.#root.querySelector("#cart");
    if (this.#cart.isEmpty) { box.innerHTML = "<h2>Cart</h2><p>Your cart is empty.</p>"; return; }
    box.innerHTML = `<h2>Order summary</h2>
      ${this.#cart.items.map((i, n) => `
        <p>${i.quantity} x ${esc(i.label)}: <b>${peso(PricingService.lineTotal(i))}</b>
        <button type="button" class="link" data-rm="${n}">Remove</button></p>`).join("")}
      <h3>Total: ${peso(this.#cart.subtotal)}</h3>
      <h2>Checkout and payment</h2>
      <form id="checkout">
        <input name="name" placeholder="Full name" required>
        <input name="phone" placeholder="Mobile number" required>
        <input name="email" type="email" placeholder="Email">
        <textarea name="address" placeholder="Delivery address" required></textarea>
        <select name="payment">
          <option>GCash</option><option>Credit or debit card</option>
          <option>Bank transfer</option><option>Cash on delivery</option>
        </select>
        <p class="note">Payment is not processed yet. This records your order.</p>
        <button>Place order</button>
      </form><p id="msg"></p>`;
    box.querySelectorAll("[data-rm]").forEach((b) =>
      b.addEventListener("click", () => { this.#cart.remove(Number(b.dataset.rm)); this.#renderCart(); }));
    box.querySelector("#checkout").addEventListener("submit", (e) => this.#checkout(e));
  }

  async #checkout(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const msg = this.#root.querySelector("#msg");
    try {
      const orderNo = await this.#orders.place(data, this.#cart.toPayload());
      this.#cart.clear();
      this.#root.querySelector("#cart").innerHTML =
        `<h2>Order placed</h2><p>Your order number is <b>${esc(orderNo)}</b>. Use it to track your order below.</p>`;
      this.#root.querySelector("#trackNo").value = orderNo;
    } catch (err) { msg.textContent = err.message; }
  }

  async #track() {
    const out = this.#root.querySelector("#trackOut");
    try {
      const o = await this.#orders.track(this.#root.querySelector("#trackNo").value);
      out.textContent = o ? `Status: ${o.status}. Total: ${peso(o.total)}` : "No order found with that number.";
    } catch (err) { out.textContent = err.message; }
  }
}
