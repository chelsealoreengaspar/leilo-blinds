export class CartItem {
  constructor({ fabric, color, width, height, casing, acetate, quantity }) {
    this.fabric = fabric;
    this.color = color;
    this.width = Number(width);
    this.height = Number(height);
    this.casing = casing;
    this.acetate = Boolean(acetate);
    this.quantity = Math.max(1, Number(quantity) || 1);
  }

  get isValid() {
    const ok = (v) => v >= 12 && v <= 120;
    return ok(this.width) && ok(this.height);
  }

  get label() {
    return `${this.fabric.blind_type}, ${this.fabric.name}, ${this.color}, ` +
      `${this.width} x ${this.height} in, ${this.casing} casing` +
      `${this.acetate ? ", acetate cover" : ""}`;
  }

  toPayload() {
    return {
      fabric_id: this.fabric.id, color: this.color,
      width: this.width, height: this.height,
      casing: this.casing, acetate: this.acetate, quantity: this.quantity,
    };
  }
}
