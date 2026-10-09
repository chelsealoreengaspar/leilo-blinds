import { esc } from "../utils/format.js";
import { Brand } from "../components/Brand.js";

// Staff type a username; the app adds this ending before talking to Supabase.
const DOMAIN = "@leilo.app";

export class LoginPage {
  #root; #auth; #onDone; #message;

  constructor(root, auth, onDone, message = "") {
    this.#root = root;
    this.#auth = auth;
    this.#onDone = onDone;
    this.#message = message;
  }

  render() {
    this.#root.innerHTML = `<header>${Brand.html()}</header>
      <div class="login">
        <form id="login" class="card login-card">
          <h1>Staff sign in</h1>
          <p class="sub">This order form is for sales staff only.</p>
          <label>Username<input name="username" required autocomplete="username" autocapitalize="none"></label>
          <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
          <button class="btn">Sign in</button>
          <p class="err" id="err">${esc(this.#message)}</p>
        </form>
      </div>`;
    this.#root.querySelector("#login").addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      const name = d.username.trim().toLowerCase();
      const email = name.includes("@") ? name : name + DOMAIN;
      try { await this.#auth.signIn(email, d.password); this.#onDone(); }
      catch (err) { this.#root.querySelector("#err").textContent = "Wrong username or password."; }
    });
  }
}