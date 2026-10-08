import "./style.css";
import { StorefrontPage } from "./pages/StorefrontPage.js";
import { AdminPage } from "./pages/AdminPage.js";

class Router {
  constructor(root) { this.root = root; }

  start() {
    const Page = location.hash === "#/admin" ? AdminPage : StorefrontPage;
    new Page(this.root).render();
  }
}

const router = new Router(document.getElementById("app"));
router.start();
window.addEventListener("hashchange", () => router.start());
