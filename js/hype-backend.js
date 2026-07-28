const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const DEMO_USER_ID = "demo-user";

const mockPointMap = {
  "video-001": 120,
  "video-002": 85,
  "video-004": 95,
  "video-005": 72,
};

export function getMockPointsValue(videoId) {
  return mockPointMap[videoId] || 75;
}

export function formatMockPoints(value) {
  return `${value.toLocaleString()} mock points`;
}

export function getFallbackMockPoints(events = []) {
  return events.reduce((total, event) => total + getMockPointsValue(event.videoId), 0);
}

export async function submitHypeToBackend(videoId) {
  try {
    const response = await fetch(`${DEFAULT_BACKEND_URL}/api/hypes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: DEMO_USER_ID, videoId }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || "The backend rejected the Hype request.");
    }

    return { ok: true, data: payload };
  } catch (error) {
    console.warn("Backend Hype request unavailable; falling back to local storage.", error);
    return { ok: false, error };
  }
}

export function getBackendResetLabel(resetTime) {
  if (!resetTime) return "Monday at 12:00 a.m. local time";
  const resetDate = new Date(resetTime);
  return `Reset timing: ${resetDate.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
}
