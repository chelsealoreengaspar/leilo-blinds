import { esc } from "../utils/format.js";

// Shows two pictures beside the order form: the style photo and the
// color variation photo (for example "Black Out - White").
export class BlindPreview {
  // Stand-in colors for swatches and for photos that are not uploaded yet.
  // Approximate on purpose; a real photo replaces them. Add new color names here.
  static #HEX = {
    "White": "#f7f6f2", "Ivory": "#f3ecd9", "Cream": "#efe6d0", "Peach": "#f2c9b0",
    "M. Taupe": "#9c8b7c", "Taupe": "#b3a393", "Mustard": "#d4a82a", "Brown": "#7a5a44",
    "Caramel": "#b9803f", "Mocha": "#8d6b55", "Grey": "#b3b6b9", "Gray": "#b3b6b9",
    "Black": "#2b2b2d", "Dark Green": "#3e5b46", "Blue": "#5b86b8", "Pink": "#e8b4c0",
    "Red": "#b8343a", "Chocolate": "#5a3a2c", "Choco": "#5a3a2c", "Dark Grey": "#6a6d71",
    "Yellow": "#efd04d", "Ice Blue": "#cfe4ee", "Dark Blue": "#274a78", "Orange": "#e58a3a",
    "Purple": "#7a5a9a", "N. White": "#f2efe6", "N. Beige": "#e4d6bd", "Sand": "#d9c7a3",
    "N. Peach": "#efd2bd", "N. Cherry": "#b8764f", "Cherry": "#9b4a3a", "Light Green": "#b9d3a8",
    "Nile": "#a9c7b5", "Coffee": "#6f4e37", "Khaki": "#bfae86", "Ashtree": "#cdbfa6",
    "Stone": "#b9b2a6", "Navy": "#28385e", "Light Blue": "#b7d0e6", "Sky Blue": "#8fc1e3",
    "Turquoise": "#3fb5b0", "Lilac": "#c6b1d6", "Wine": "#6e2335", "L. Grey": "#d0d2d4",
    "Light Grey": "#d0d2d4", "D. Grey": "#6a6d71", "Blue Grey": "#7f93a3", "Mushroom": "#b8a99a",
    "Coconut": "#efe8dc", "Charcoal": "#4a4e53", "Beige": "#e3d5bc", "Green": "#6f9a6a",
    "Mint": "#bfe3d0", "Project Screen": "#d8d8d6", "Violet": "#8a6bb5", "Anthracite": "#3b3f44",
    "Cinder": "#8a8580", "Nordick": "#c4bfb5", "Metal Navy": "#2e3b4e", "Olive Night": "#5e6240",
    "Beige and Choco": "linear-gradient(90deg,#e3d5bc 50%,#5a3a2c 50%)",
    "White and Ivory": "linear-gradient(90deg,#f7f6f2 50%,#efe3c9 50%)",
    "Oak": "#c9a97f", "Walnut": "#8b6b4e", "Ash": "#d8cdbd", "Natural": "#d2b48c", "Sage": "#b7c4b1",
  };

  static hex(color) { return BlindPreview.#HEX[color] ?? "#e9e6e0"; }

  // Turns a stored path such as "styles/combi-blinds.jpg" into a public Storage URL.
  static src(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const base = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/blinds/`;
    return base + encodeURI(path.replace(/^\/+/, "")).replace(/'/g, "%27");
  }

  // CSS background for a color button: the photo, with the stand-in color behind it.
  static swatch(fabric, color) {
    const path = fabric.color_images?.[color];
    const fallback = BlindPreview.hex(color);
    return path ? `url('${BlindPreview.src(path)}') center/cover, ${fallback}` : fallback;
  }

  static #pic(path, label, name, background) {
    return `<div class="pic">
      <div class="frame" style="background:${background}">
        <span class="nophoto">No photo yet</span>
        ${path ? `<img src="${esc(BlindPreview.src(path))}" alt="${esc(name)}" onerror="this.remove()">` : ""}
      </div>
      <div class="cap"><small>${label}</small><b>${esc(name)}</b></div>
    </div>`;
  }

  static render(item, stylePath) {
    const w = item.isValid ? item.width : 48;
    const h = item.isValid ? item.height : 60;
    const colorPath = item.fabric.color_images?.[item.color];
    return `<figure class="preview" aria-label="Preview of your blind">
      <div class="pics">
        ${BlindPreview.#pic(stylePath, "Style", item.fabric.blind_type, "var(--soft)")}
        ${BlindPreview.#pic(colorPath, "Color variation", `${item.fabric.name} - ${item.color}`, BlindPreview.hex(item.color))}
      </div>
      <div class="specs">${w} x ${h} in, ${esc(item.casing)} casing${item.acetate ? ", acetate cover" : ""}</div>
    </figure>`;
  }
}