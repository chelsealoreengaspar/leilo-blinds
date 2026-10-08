export const peso = (n) => "₱" + Math.round(Number(n)).toLocaleString("en-US");

// Escapes text before it is placed inside innerHTML.
export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
