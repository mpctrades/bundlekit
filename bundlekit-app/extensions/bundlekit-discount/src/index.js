// Shopify CLI's JS-function build only looks for src/index.{js,ts} as the
// entry point. The actual logic lives in run.js (see the README's warning
// about keeping the export shape stable), so this file just re-exports it.
export { run } from "./run.js";
