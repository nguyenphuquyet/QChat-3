/**
 * Render session: the view side of `setData`.
 *
 * The Service Runtime sends one full tree when a page becomes visible, then
 * path-based operations for every later `setData`. This session applies those
 * payloads in order, validates them, and never reloads the page for a data
 * update.
 *
 * Ordering contract:
 * - `seq` is monotonic per service runtime; a payload whose `seq` is not
 *   greater than the last applied one is ignored (never replayed out of order).
 * - A `tree` payload replaces the page tree; it is the only way to start a page.
 * - An `ops` payload requires a tree for the same page and is applied in array
 *   order. Operations for another page are rejected.
 * - A theme change is written to the page root only; it never reloads.
 */

import {
  validateRenderPayload,
  type RenderPayload,
  type ResolvedTheme,
  type ViewRenderer,
} from "@qchat/miniapp-contracts";

export type RenderApplyResult = "tree" | "ops" | "ignored";

export interface RenderSession {
  /** Apply one `view.render` payload. Throws on a malformed or out-of-order payload. */
  apply(payload: unknown): RenderApplyResult;
  /** Last applied sequence number, or 0 before the first payload. */
  seq(): number;
  /** Page the current tree belongs to, or `null` before the first tree. */
  pageId(): string | null;
}

export function createRenderSession(renderer: ViewRenderer): RenderSession {
  let lastSeq = 0;
  let currentPage: string | null = null;
  let hasTree = false;
  let appliedTheme: ResolvedTheme | null = null;

  return {
    apply(payload: unknown): RenderApplyResult {
      if (!validateRenderPayload(payload)) throw new Error("invalid render payload");
      const message: RenderPayload = payload;
      if (message.seq <= lastSeq) return "ignored";
      const update = message.update;

      if (update.kind === "ops") {
        if (!hasTree) throw new Error("render ops before a page tree");
        if (currentPage !== message.pageId) {
          throw new Error(`render ops for ${message.pageId} but the current tree is ${currentPage ?? "none"}`);
        }
        renderer.patch(update.ops);
      } else {
        renderer.render(update.tree);
        hasTree = true;
        currentPage = message.pageId;
      }

      if (appliedTheme !== update.theme) {
        renderer.setTheme(update.theme);
        appliedTheme = update.theme;
      }
      lastSeq = message.seq;
      return update.kind;
    },

    seq() {
      return lastSeq;
    },

    pageId() {
      return currentPage;
    },
  };
}
