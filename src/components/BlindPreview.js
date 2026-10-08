// Draws the live window preview shown beside the order form.
// It only builds HTML, so it can be reused anywhere (shop, cart, admin).
export class BlindPreview {
  static #HEX = {
    "White": "#f5f4f0", "Cream": "#e9e0cf", "Dove Gray": "#cfd2d6", "Charcoal": "#5d6269",
    "Oak": "#c9a97f", "Walnut": "#8b6b4e", "Ash": "#d8cdbd",
  };
  static #OPACITY = { "Sheer": 0.72, "Light Filtering": 0.86 };
  static #KIND = { "Combi Blinds": "combi", "Roller Blinds": "roller", "HoneyComb": "honey", "Smart Curtain": "curtain" };

  // Add a new color here when you add it to the fabrics table.
  static hex(color) { return BlindPreview.#HEX[color] ?? "#e9e6e0"; }

  static #kind(item) {
    if (item.fabric.name === "Woodlook") return "wood";
    return BlindPreview.#KIND[item.fabric.blind_type] ?? "roller";
  }

  static render(item) {
    const ok = item.isValid;
    const w = ok ? item.width : 48;
    const h = ok ? item.height : 60;
    const widthPct = Math.round(35 + (w / 120) * 65);
    const dropPct = Math.round(30 + (h / 120) * 62);
    const opacity = BlindPreview.#OPACITY[item.fabric.name] ?? 1;
    const rail = item.casing === "Metal" ? "metal" : "plastic";
    return `<figure class="preview" aria-label="Preview of your blind">
      <div class="window">
        <div class="hang" style="width:${widthPct}%;height:${dropPct}%">
          <div class="rail ${rail}">${item.acetate ? '<span class="cover"></span>' : ""}</div>
          <div class="blind k-${BlindPreview.#kind(item)}" style="background-color:${BlindPreview.hex(item.color)};opacity:${opacity}"></div>
        </div>
      </div>
      <figcaption>${w} x ${h} in, ${item.casing} casing${item.acetate ? ", acetate cover" : ""}</figcaption>
    </figure>`;
  }
}
