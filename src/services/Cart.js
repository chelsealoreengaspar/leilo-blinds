import { PricingService } from "./PricingService.js";

export class Cart {
  #items = [];

  add(item) { this.#items.push(item); }
  remove(index) { this.#items.splice(index, 1); }
  clear() { this.#items = []; }

  get items() { return [...this.#items]; }
  get isEmpty() { return this.#items.length === 0; }
  get subtotal() {
    return this.#items.reduce((sum, i) => sum + PricingService.lineTotal(i), 0);
  }

  toPayload() { return this.#items.map((i) => i.toPayload()); }
}
