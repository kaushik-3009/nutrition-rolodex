document.documentElement.dataset.input = "keyboard";
document.addEventListener("pointerdown", () => { document.documentElement.dataset.input = "pointer"; }, true);
document.addEventListener("keydown", event => {
  if (event.key === "Tab" || event.key.startsWith("Arrow") || event.key === "Enter" || event.key === " ") document.documentElement.dataset.input = "keyboard";
}, true);
