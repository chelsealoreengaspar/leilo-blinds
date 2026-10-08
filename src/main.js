import "./style.css";
import { AuthService } from "./services/AuthService.js";
import { LoginPage } from "./pages/LoginPage.js";
import { StorefrontPage } from "./pages/StorefrontPage.js";
import { AdminPage } from "./pages/AdminPage.js";

class Router {
  #auth = new AuthService();

  constructor(root) { this.root = root; }

  async start() {
    try {
      const role = await this.#auth.role();
      if (!role) {
        let message = "";
        if (await this.#auth.isSignedIn()) {
          await this.#auth.signOut();
          message = "This account is not on the staff list. Ask the admin to add it.";
        }
        return new LoginPage(this.root, this.#auth, () => this.start(), message).render();
      }
      if (location.hash === "#/admin" && role === "admin") {
        return new AdminPage(this.root, this.#auth).render();
      }
      return new StorefrontPage(this.root, this.#auth, role).render();
    } catch (err) {
      this.root.innerHTML = `<main><h1>Something went wrong</h1><p>${String(err.message).replace(/</g, "&lt;")}</p></main>`;
    }
  }
}

const router = new Router(document.getElementById("app"));
router.start();
window.addEventListener("hashchange", () => router.start());
