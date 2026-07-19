import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  focusPortalSectionTitle,
  scrollToPortalSection,
} from "./scroll-to-section";

describe("scrollToPortalSection", () => {
  test("scrolls the requested section into view", () => {
    const calls: ScrollIntoViewOptions[] = [];
    const section = {
      scrollIntoView: (options: ScrollIntoViewOptions) => calls.push(options),
    };
    const document = {
      getElementById: (id: string) => (id === "sec_new" ? section : null),
    };

    assert.equal(scrollToPortalSection("sec_new", document), true);
    assert.deepEqual(calls, [{ behavior: "smooth", block: "start" }]);
  });

  test("does nothing when the section is not mounted", () => {
    const document = { getElementById: () => null };

    assert.equal(scrollToPortalSection("sec_missing", document), false);
  });

  test("focuses the title without changing the scroll position", () => {
    const calls: FocusOptions[] = [];
    const title = {
      focus: (options: FocusOptions) => calls.push(options),
    };
    const section = {
      querySelector: (selector: string) =>
        selector === "[data-portal-section-title]" ? title : null,
    };
    const document = {
      getElementById: (id: string) => (id === "sec_new" ? section : null),
    };

    assert.equal(focusPortalSectionTitle("sec_new", document), true);
    assert.deepEqual(calls, [{ preventScroll: true }]);
  });

  test("does not focus when the section title is not mounted", () => {
    const document = { getElementById: () => null };

    assert.equal(focusPortalSectionTitle("sec_missing", document), false);
  });
});
