const STORAGE_KEY = "hype-balance-concept-state-v1";
const DEFAULT_REMAINING_HYPES = 3;

function dateToKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalWeekKey(now = new Date()) {
  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (localDate.getDay() + 6) % 7;
  localDate.setDate(localDate.getDate() - daysSinceMonday);
  return dateToKey(localDate);
}

function newState(now = new Date()) {
  return {
    weekKey: getLocalWeekKey(now),
    remainingHypes: DEFAULT_REMAINING_HYPES,
    hypeEvents: [],
    dismissedBalanceCard: false,
  };
}

function loadRaw() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn("Could not read Hype Balance state", error);
    return null;
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

function normalize(state, now = new Date()) {
  const currentWeekKey = getLocalWeekKey(now);
  if (!state || state.weekKey !== currentWeekKey) return newState(now);

  return {
    weekKey: currentWeekKey,
    remainingHypes: Math.max(0, Math.min(DEFAULT_REMAINING_HYPES, Number(state.remainingHypes) || 0)),
    hypeEvents: Array.isArray(state.hypeEvents) ? state.hypeEvents : [],
    dismissedBalanceCard: Boolean(state.dismissedBalanceCard),
  };
}

export function getState(now = new Date()) {
  const state = normalize(loadRaw(), now);
  return save(state);
}

export function hypeVideo(videoId, now = new Date()) {
  const state = getState(now);
  if (state.remainingHypes <= 0) return { ok: false, reason: "empty", state };

  const nextState = {
    ...state,
    remainingHypes: state.remainingHypes - 1,
    dismissedBalanceCard: false,
    hypeEvents: [
      ...state.hypeEvents,
      { videoId, timestamp: now.toISOString() },
    ],
  };

  return { ok: true, state: save(nextState) };
}

export function dismissBalanceCard() {
  const state = { ...getState(), dismissedBalanceCard: true };
  return save(state);
}

export function resetPrototype(now = new Date()) {
  return save(newState(now));
}

export function hypeCountForVideo(videoId, state = getState()) {
  return state.hypeEvents.filter((event) => event.videoId === videoId).length;
}

export const storeConfig = { DEFAULT_REMAINING_HYPES, STORAGE_KEY };
