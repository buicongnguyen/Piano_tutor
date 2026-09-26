import "./game.css";
import { App } from "./app";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const ui = document.querySelector<HTMLElement>("#ui")!;
const boot = document.querySelector<HTMLElement>("#boot")!;
const bar = boot.querySelector<HTMLElement>(".boot-bar i")!;
const label = boot.querySelector<HTMLElement>("p")!;

function fail(message: string) {
  boot.classList.add("error");
  label.innerHTML = `${message}<br><a href="./studio.html">Open the classic piano studio instead</a>`;
}

const probe = document.createElement("canvas");
if (!probe.getContext("webgl2")) {
  fail("Stillnote Encore needs WebGL 2, which this browser doesn't provide.");
} else {
  try {
    const app = new App(canvas, ui);
    (window as unknown as { __encore: unknown }).__encore = app.debugHooks();
    app
      .boot((p, text) => {
        bar.style.transform = `scaleX(${p})`;
        label.textContent = text;
      })
      .then(() => {
        boot.classList.add("done");
        setTimeout(() => boot.remove(), 700);
      })
      .catch((error) => {
        console.error(error);
        fail("The Sky Isles couldn't load. Check your connection and reload.");
      });
  } catch (error) {
    console.error(error);
    fail("The Sky Isles couldn't start on this device.");
  }
}
