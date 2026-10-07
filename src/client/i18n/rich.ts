// Templates whose placeholders are styled elements ("Room {code} doesn't
// exist" with the code in gold). Each locale keeps its own word order; only
// the placeholders become nodes.
import { createElement, Fragment, type ReactNode } from "react";

export function rich(template: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return createElement(Fragment, { key: i }, name && name in nodes ? nodes[name] : part);
  });
}
