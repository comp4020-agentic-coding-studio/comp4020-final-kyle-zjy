// Every engine message template (`m` tagged templates) in src/, as the key
// format() looks up: the cooked strings joined with {0}, {1}, ...
// Used by test/localization.test.ts and `node scripts/i18n/message-keys.ts`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

export function messageKeys(root = "src"): Map<string, string> {
  const keys = new Map<string, string>();
  for (const file of files(root)) {
    const text = readFileSync(file, "utf8");
    if (!text.includes("m`")) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === "m") {
        const t = node.template;
        const key = ts.isNoSubstitutionTemplateLiteral(t)
          ? t.text
          : t.head.text + t.templateSpans.map((s, i) => `{${i}}${s.literal.text}`).join("");
        if (key) keys.set(key, `${file}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return keys;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify([...messageKeys().keys()], null, 1));
}
