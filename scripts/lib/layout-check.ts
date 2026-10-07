// Layout checks run on a live page by the browser scripts. html/body hide
// horizontal overflow, so page-level scrollWidth can't see clipping: measure
// elements instead. Touch targets follow CLAUDE.md (at least 48 px).
import type { Page } from "playwright";

/** Elements sticking out past the right edge, outside any scroll container of their own. */
export function clippedElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === "auto" || o === "scroll" || o === "hidden") return true;
      }
      return false;
    };
    return [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== "fixed" && !inScroller(el);
      })
      .slice(0, 3)
      .map((el) => `<${el.tagName.toLowerCase()} class="${String(el.getAttribute("class") ?? "").slice(0, 60)}">`);
  });
}

/** Visible buttons and links smaller than 48 px in either direction. */
export function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("button, a[href], [role=button]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.pointerEvents !== "none" && (r.width < 47.5 || r.height < 47.5) && !el.closest("[inert]");
      })
      .slice(0, 6)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `"${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`;
      }),
  );
}
