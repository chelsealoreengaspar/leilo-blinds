import { esc } from "../utils/format.js";

// One place to change the logo and the shop name shown in every header.
const LOGO = "/branding/logo.png";   // file in public/branding/
const NAME = "Leilo Blinds";
const SHOW_NAME = true;              // set to false if your logo picture already contains the words

export class Brand {
  static html(suffix = "") {
    const label = suffix ? `${NAME} ${suffix}` : NAME;
    // If the logo file is missing, show nothing extra (or the name, when SHOW_NAME is false).
    const fallback = SHOW_NAME ? "this.remove()" : `this.replaceWith(document.createTextNode('${NAME}'))`;
    return `<div class="brand"><img class="logo" src="${LOGO}" alt="${esc(NAME)} logo" onerror="${fallback}">${SHOW_NAME ? `<span>${esc(label)}</span>` : ""}</div>`;
  }
}