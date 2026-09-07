const configuredBackendUrl = document.querySelector('meta[name="hype-api-url"]')?.content?.trim();
const DEFAULT_BACKEND_URL = configuredBackendUrl || (location.hostname === "127.0.0.1" || location.hostname === "localhost" ? "http://127.0.0.1:8000" : "");
const DEMO_USER_ID = "demo-user";

const mockPointMap = { "video-001": 120, "video-002": 85, "video-004": 95, "video-005": 72 };

async function request(path, options = {}) {
  if (!DEFAULT_BACKEND_URL) return { ok: false, unavailable: true, error: new Error("No live API URL is configured.") };
  try {
    const response = await fetch(`${DEFAULT_BACKEND_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload.detail;
      const message = typeof detail === "object" ? detail.message : detail;
      return {
        ok: false,
        unavailable: false,
        status: response.status,
        code: typeof detail === "object" ? detail.code : undefined,
        data: payload,
        error: new Error(message || "The Hype API rejected the request."),
      };
    }
    return { ok: true, data: payload };
  } catch (error) {
    console.warn("Hype API unavailable; using the local prototype store.", error);
    return { ok: false, unavailable: true, error };
  }
}

const idempotencyKey = (prefix) => `${prefix}-${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}`;
const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const getMockPointsValue = (videoId) => mockPointMap[videoId] || 75;
export const formatMockPoints = (value) => `${value.toLocaleString()} mock points`;
export const getFallbackMockPoints = (events = []) => events.reduce((total, event) => total + getMockPointsValue(event.videoId), 0);

export function fetchHypeState() {
  return request(`/api/hype-state/${DEMO_USER_ID}?timezone=${encodeURIComponent(browserTimezone())}`);
}

export function fetchHypeQueue() {
  return request(`/api/hype/queue?userId=${DEMO_USER_ID}`);
}

export function submitHypeToBackend(videoId) {
  return request("/api/hypes", {
    method: "POST",
    body: JSON.stringify({ userId: DEMO_USER_ID, videoId, timezone: browserTimezone(), idempotencyKey: idempotencyKey("hype") }),
  });
}

export function undoHypeOnBackend(eventId) {
  return request("/api/hype/undo", { method: "POST", body: JSON.stringify({ userId: DEMO_USER_ID, eventId: Number(eventId) }) });
}

export function reassignHypeOnBackend(eventId, videoId) {
  return request("/api/hype/reassign", {
    method: "POST",
    body: JSON.stringify({ userId: DEMO_USER_ID, eventId: Number(eventId), videoId, idempotencyKey: idempotencyKey("reassign") }),
  });
}

export function fetchBadges() {
  return request(`/api/badges?userId=${DEMO_USER_ID}`);
}

export function resetBackendDemo() {
  return request("/api/reset-demo", { method: "POST" });
}

export function submitFeedbackToBackend(videoId, reasons, additionalFeedback) {
  return request("/api/feedback", {
    method: "POST",
    body: JSON.stringify({
      userId: DEMO_USER_ID,
      videoId,
      reasons,
      additionalFeedback,
    }),
  });
}

export function getBackendResetLabel(resetTime) {
  if (!resetTime) return "Reset date unavailable";
  return `Resets ${new Date(resetTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
}
