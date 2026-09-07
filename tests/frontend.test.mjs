import assert from "node:assert/strict";
import test from "node:test";

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};
globalThis.window = { dispatchEvent: () => {} };
globalThis.CustomEvent = class CustomEvent {
  constructor(name, options) { this.name = name; this.detail = options?.detail; }
};

const store = await import("../js/hype-store.js");
const ui = await import("../js/hype-ui.js");
const { FeedbackModal } = await import("../js/components/FeedbackModal.js");

function resetStorage() {
  values.clear();
}

test("a video can only be hyped once in a quota period", () => {
  resetStorage();
  const now = new Date("2026-09-07T12:00:00Z");
  const first = store.hypeVideo("video-001", now);
  const duplicate = store.hypeVideo("video-001", new Date(now.getTime() + 1000));
  assert.equal(first.ok, true);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "already_hyped");
  assert.equal(duplicate.state.remainingHypes, 2);
});

test("an undone Hype cannot be reassigned to the same video", () => {
  resetStorage();
  const now = new Date("2026-09-07T12:00:00Z");
  const created = store.hypeVideo("video-001", now);
  const eventId = created.state.hypeEvents[0].eventId;
  assert.equal(store.undoHype(eventId, new Date(now.getTime() + 1000)).ok, true);
  const reassigned = store.reassignHype(eventId, "video-001", new Date(now.getTime() + 2000));
  assert.equal(reassigned.ok, false);
  assert.equal(reassigned.reason, "already_hyped");
});

test("zero quota renders a reset message and no Hype button", () => {
  const video = { id: "video-001", title: "Example", eligible: true };
  const state = { remainingHypes: 0, unlimitedHypes: false };
  const control = ui.getHypeControlState(video, state, 0);
  const markup = ui.renderHypeControl({ control, video, remainingText: "0 Hypes left", resetText: "Resets Monday", iconMarkup: "" });
  assert.equal(control.kind, "quota_exhausted");
  assert.match(markup, /No Hypes left/);
  assert.doesNotMatch(markup, /data-hype=/);
});

test("successful Hypes trigger the feedback survey", () => {
  assert.equal(ui.shouldOpenFeedbackSurvey({ ok: true }), true);
  assert.equal(ui.shouldOpenFeedbackSurvey({ ok: false }), false);
  const markup = FeedbackModal({ id: "video-001", title: "Example video" });
  assert.match(markup, /Why did you Hype this video/);
  assert.match(markup, /data-feedback-form/);
  assert.match(markup, /Supporting a small creator/);
});

test("feedback responses are retained in the local fallback", () => {
  resetStorage();
  store.saveFeedbackResponse({
    videoId: "video-001",
    reasons: ["Loved the content"],
    additionalFeedback: "  Great explanation.  ",
  }, new Date("2026-09-07T12:00:00Z"));
  const state = store.getState(new Date("2026-09-07T12:01:00Z"));
  assert.equal(state.feedbackResponses.length, 1);
  assert.equal(state.feedbackResponses[0].additionalFeedback, "Great explanation.");
});
