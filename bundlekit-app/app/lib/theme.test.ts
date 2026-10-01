import { describe, expect, it } from "vitest";
import { normaliseAccent } from "./theme";

describe("normaliseAccent", () => {
  it("keeps 3- and 6-digit hex colours", () => {
    expect(normaliseAccent("#FF4A1C", "#000000")).toBe("#FF4A1C");
    expect(normaliseAccent(" #abc ", "#000000")).toBe("#abc");
  });

  it("falls back on anything that isn't a hex colour", () => {
    expect(normaliseAccent("red", "#000000")).toBe("#000000");
    expect(normaliseAccent('#fff;"><script>', "#000000")).toBe("#000000");
    expect(normaliseAccent(null, "#000000")).toBe("#000000");
  });
});
