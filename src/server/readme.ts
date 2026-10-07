// /readme/ — README.md rendered on the server, because the course spec reads
// its headings from the HTML as sent (no script runs).
import { readFileSync } from "node:fs";
import { marked } from "marked";
import { config } from "./config.ts";

export function renderReadme(): string {
  const body = marked.parse(readFileSync(config.readmePath, "utf8"), { async: false });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>README — Fate Instance</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #05060d; color: #e7eaf6; font: 16px/1.65 system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 48px 16px 96px; }
  h1, h2, h3 { font-family: "Cormorant Garamond", Georgia, serif; color: #e8c97f; line-height: 1.2; }
  h1 { font-size: 2.5rem; margin-top: 0; }
  a { color: #5ce1e6; }
  code, pre { font-family: ui-monospace, monospace; background: #121a3a; border-radius: 6px; }
  code { padding: 0.1em 0.35em; }
  pre { padding: 16px; overflow-x: auto; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; display: block; overflow-x: auto; }
  th, td { border: 1px solid #1d2657; padding: 6px 10px; }
  nav { margin-bottom: 32px; font-size: 0.875rem; }
</style>
</head>
<body><main><nav><a href="/">← Back to the game</a></nav>
${body}
</main></body>
</html>`;
}
