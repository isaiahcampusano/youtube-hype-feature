const STORAGE_KEY = "hype-balance-concept-state-v2";
const DEFAULT_REMAINING_HYPES = 3;
const DEFAULT_EXPERIMENT = {
  group: "undo",
  quotaSchedule: "default",
  undoEnabled: true,
  badgesEnabled: false,
  weekendBonusMode: "unlimited",
};

function dateToKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getLocalPeriodKey(now = new Date(), schedule = "default") {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const anchor = schedule === "weekend_bonus" ? 5 : 1;
  date.setDate(date.getDate() - ((date.getDay() - anchor + 7) % 7));
  return dateToKey(date);
}

export function getLocalResetTime(now = new Date(), schedule = "default") {
  const start = new Date(`${getLocalPeriodKey(now, schedule)}T00:00:00`);
  start.setDate(start.getDate() + 7);
  return start;
}

function newState(now = new Date()) {
  return {
    periodKey: getLocalPeriodKey(now, DEFAULT_EXPERIMENT.quotaSchedule),
    remainingHypes: DEFAULT_REMAINING_HYPES,
    unlimitedHypes: false,
    resetTime: getLocalResetTime(now, DEFAULT_EXPERIMENT.quotaSchedule).toISOString(),
    experiment: DEFAULT_EXPERIMENT,
    hypeEvents: [],
    feedbackResponses: [],
    badges: [],
    dismissedBalanceCard: false,
  };
}

function loadRaw() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn("Could not read Hype state", error);
    return null;
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("hype-state-changed", { detail: state }));
  return state;
}

function currentLimit(experiment, now) {
  const weekend = experiment.quotaSchedule === "weekend_bonus" && [0, 5, 6].includes(now.getDay());
  if (weekend && experiment.weekendBonusMode === "unlimited") return null;
  return weekend ? 6 : DEFAULT_REMAINING_HYPES;
}

function normalize(state, now = new Date()) {
  if (!state) return newState(now);
  const experiment = { ...DEFAULT_EXPERIMENT, ...(state.experiment || {}) };
  const periodKey = getLocalPeriodKey(now, experiment.quotaSchedule);
  if ((state.periodKey || state.weekKey) !== periodKey) return {
    ...newState(now),
    experiment,
    periodKey,
    badges: Array.isArray(state.badges) ? state.badges : [],
    feedbackResponses: Array.isArray(state.feedbackResponses) ? state.feedbackResponses : [],
  };
  const events = (Array.isArray(state.hypeEvents) ? state.hypeEvents : []).map((event, index) => ({
    eventId: event.eventId ?? `local-${index}-${event.timestamp || Date.now()}`,
    videoId: event.videoId,
    timestamp: event.timestamp || new Date().toISOString(),
    isActive: event.isActive !== false,
    undoExpiresAt: event.undoExpiresAt || new Date(new Date(event.timestamp || now).getTime() + 86400000).toISOString(),
  }));
  const limit = currentLimit(experiment, now);
  const activeCount = events.filter((event) => event.isActive).length;
  return {
    ...state,
    periodKey,
    experiment,
    hypeEvents: events,
    feedbackResponses: Array.isArray(state.feedbackResponses) ? state.feedbackResponses : [],
    badges: Array.isArray(state.badges) ? state.badges : [],
    unlimitedHypes: limit === null,
    remainingHypes: limit === null ? null : Math.max(0, limit - activeCount),
    resetTime: state.resetTime || getLocalResetTime(now, experiment.quotaSchedule).toISOString(),
    dismissedBalanceCard: Boolean(state.dismissedBalanceCard),
  };
}

export function getState(now = new Date()) {
  return save(normalize(loadRaw(), now));
}

function awardLocalBadges(state) {
  const active = state.hypeEvents.filter((event) => event.isActive);
  const badgeMap = new Map((state.badges || []).map((badge) => [badge.slug, badge]));
  const award = (slug, name, description) => {
    if (!badgeMap.has(slug)) badgeMap.set(slug, { slug, name, description, awardedAt: new Date().toISOString() });
  };
  if (active.length >= 10) award("supporter", "Supporter", "Used 10 Hypes to support emerging creators.");
  if (new Set(active.map((event) => event.videoId)).size >= 3) award("community-builder", "Community Builder", "Supported at least 3 different creators.");
  if (active.some((event) => ["video-001", "video-004"].includes(event.videoId))) award("trendspotter", "Trendspotter", "Hyped a video that reached the prototype leaderboard.");
  return { ...state, badges: [...badgeMap.values()] };
}

export function hypeVideo(videoId, now = new Date()) {
  const state = getState(now);
  if (state.hypeEvents.some((event) => event.videoId === videoId)) {
    return { ok: false, reason: "already_hyped", state };
  }
  if (!state.unlimitedHypes && state.remainingHypes <= 0) return { ok: false, reason: "empty", state };
  const next = awardLocalBadges({
    ...state,
    dismissedBalanceCard: false,
    hypeEvents: [...state.hypeEvents, {
      eventId: `local-${now.getTime()}-${Math.random().toString(16).slice(2)}`,
      videoId,
      timestamp: now.toISOString(),
      isActive: true,
      undoExpiresAt: new Date(now.getTime() + 86400000).toISOString(),
    }],
  });
  return { ok: true, state: save(normalize(next, now)) };
}

export function undoHype(eventId, now = new Date()) {
  const state = getState(now);
  const target = state.hypeEvents.find((event) => String(event.eventId) === String(eventId));
  if (!target || !target.isActive || new Date(target.undoExpiresAt) <= now) return { ok: false, state };
  const next = { ...state, hypeEvents: state.hypeEvents.map((event) => String(event.eventId) === String(eventId) ? { ...event, isActive: false } : event) };
  return { ok: true, state: save(normalize(next, now)) };
}

export function reassignHype(eventId, videoId, now = new Date()) {
  const state = getState(now);
  const target = state.hypeEvents.find((event) => String(event.eventId) === String(eventId));
  if (!target || target.isActive) return { ok: false, state };
  return hypeVideo(videoId, now);
}

export function syncBackendState(payload) {
  if (!payload) return getState();
  const prior = getState();
  const next = normalize({
    ...prior,
    periodKey: payload.periodKey,
    remainingHypes: payload.remainingHypes,
    unlimitedHypes: payload.unlimitedHypes,
    resetTime: payload.resetTime,
    experiment: payload.experiment || prior.experiment,
    hypeEvents: payload.hypeHistory || prior.hypeEvents,
  });
  return save(next);
}

export function syncBadges(items = []) {
  const state = { ...getState(), badges: items };
  return save(state);
}

export function syncQueue(items = []) {
  const state = getState();
  return save(normalize({ ...state, hypeEvents: items }));
}

export function saveFeedbackResponse({ videoId, reasons, additionalFeedback = "" }, now = new Date()) {
  const state = getState(now);
  const response = {
    feedbackId: `local-feedback-${now.getTime()}-${Math.random().toString(16).slice(2)}`,
    videoId,
    reasons: [...reasons],
    additionalFeedback: additionalFeedback.trim(),
    timestamp: now.toISOString(),
  };
  save({ ...state, feedbackResponses: [...state.feedbackResponses, response] });
  return response;
}

export function dismissBalanceCard() {
  return save({ ...getState(), dismissedBalanceCard: true });
}

export function resetPrototype(now = new Date()) {
  return save(newState(now));
}

export function hypeCountForVideo(videoId, state = getState()) {
  return state.hypeEvents.filter((event) => event.isActive && event.videoId === videoId).length;
}

export const storeConfig = { DEFAULT_REMAINING_HYPES, STORAGE_KEY };
