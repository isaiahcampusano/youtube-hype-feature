import { videos, getVideo } from "./data.js";
import {
  dismissBalanceCard,
  getState,
  hypeCountForVideo,
  hypeVideo,
  reassignHype,
  resetPrototype,
  saveFeedbackResponse,
  syncBackendState,
  syncBadges,
  syncQueue,
  storeConfig,
  undoHype,
} from "./hype-store.js";
import {
  fetchBadges,
  fetchHypeQueue,
  fetchHypeState,
  formatMockPoints,
  getBackendResetLabel,
  getFallbackMockPoints,
  getMockPointsValue,
  reassignHypeOnBackend,
  resetBackendDemo,
  submitHypeToBackend,
  submitFeedbackToBackend,
  undoHypeOnBackend,
} from "./hype-backend.js";
import { FeedbackModal } from "./components/FeedbackModal.js";
import { getHypeControlState, renderHypeControl, shouldOpenFeedbackSurvey } from "./hype-ui.js";

const app = document.querySelector("#app");
const liveRegion = document.querySelector("#live-region");

let currentView = "home";
let currentVideoId = "video-001";
let activeTopic = "All";
let showHowHypeWorks = false;
let lastHypedVideoId = null;
let toastMessage = "";
let likedVideos = new Set();
let subscribedCreators = new Set();
let toastTimer;
let pendingFocusSelector = "";
let lastHypeResult = null;
let pendingReassignEventId = null;
let feedbackVideoId = null;

const icon = (name, size = 20) => {
  const icons = {
    search: '<path d="m14.5 14.5 4 4"/><circle cx="10.5" cy="10.5" r="5.8"/>',
    bell: '<path d="M18 9.8c0-3.3-2-5.8-5-6.4V2.5a1 1 0 0 0-2 0v.9c-3 .6-5 3.1-5 6.4 0 4-1.5 5.4-2 6h16c-.5-.6-2-2-2-6Z"/><path d="M9 19h6"/>',
    home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z"/><path d="M9 21v-7h6v7"/>',
    shorts: '<path d="m9 3 6 3-2 3 4 2-6 10-6-3 2-3-4-2L9 3Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    subscriptions: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="m10 9 5 3-5 3V9Z"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    like: '<path d="M7 21H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3v11ZM7 10l4-7c2-.1 3 1.1 2.5 3.1L12.5 10H19a3 3 0 0 1 2.9 3.8l-1.3 5A3 3 0 0 1 17.7 21H7"/>',
    share: '<path d="m14 5 6 6-6 6"/><path d="M20 11H9a5 5 0 0 0-5 5v3"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
    sparkle: '<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
};

function track(event, detail = {}) {
  console.info("[Hype Balance Concept]", {
    event,
    ...detail,
    timestamp: new Date().toISOString(),
  });
}

function announce(message) {
  liveRegion.textContent = "";
  window.setTimeout(() => { liveRegion.textContent = message; }, 30);
}

function showToast(message) {
  toastMessage = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastMessage = "";
    render();
  }, 2500);
  render();
}

function setPendingFocus(selector) {
  pendingFocusSelector = selector;
}

function applyPendingFocus() {
  if (!pendingFocusSelector) return;
  const target = app.querySelector(pendingFocusSelector);
  pendingFocusSelector = "";
  target?.focus();
}

function avatar(video, large = false) {
  return `<span class="avatar${large ? " avatar-large" : ""}" style="background:${video.avatarColor}" aria-hidden="true">${video.avatar}</span>`;
}

function thumbnail(video, compact = false) {
  return `<div class="${compact ? "related-thumb" : "thumbnail"} ${video.art}" aria-hidden="true"><span class="art-shape"></span><span class="duration">${video.duration}</span></div>`;
}

function remainingLabel(state, compact = false) {
  if (state.unlimitedHypes) return compact ? "∞ this weekend" : "Unlimited Hypes this weekend";
  return `${state.remainingHypes} ${state.remainingHypes === 1 ? "Hype" : "Hypes"} left`;
}

function resetLabel(state) {
  return getBackendResetLabel(state.resetTime);
}

function formatUndoWindow(expiresAt) {
  const milliseconds = new Date(expiresAt).getTime() - Date.now();
  if (milliseconds <= 0) return "Undo window closed";
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  return `${hours}h ${minutes}m to undo`;
}

function bottomNav() {
  const items = [
    ["home", "Home", "home"],
    ["shorts", "Shorts", "shorts"],
    ["create", "Create", "plus"],
    ["subscriptions", "Subscriptions", "subscriptions"],
    ["you", "You", "user"],
  ];
  return `<nav class="bottom-nav" aria-label="Primary navigation">${items.map(([view, label, iconName]) => `
    <button class="nav-button" data-nav="${view}" aria-current="${currentView === view ? "page" : "false"}" aria-label="${label}">
      ${icon(iconName)}<span>${label}</span>
    </button>`).join("")}</nav>`;
}

function header() {
  return `<header class="topbar">
    <div class="brand"><span class="play-mark" aria-hidden="true"></span><span>viewtube</span></div>
    <div class="topbar-actions">
      <button class="icon-button" data-toast="Search is outside this focused concept." aria-label="Search">${icon("search")}</button>
      <button class="icon-button" data-toast="Notifications are outside this focused concept." aria-label="Notifications">${icon("bell")}</button>
      <button class="icon-button" data-nav="you" aria-label="Open your profile"><span class="profile-dot">IH</span></button>
    </div>
  </header>`;
}

function videoCard(video) {
  const state = getState();
  return `<button class="video-card" data-open-video="${video.id}" aria-label="Watch ${video.title}">
    ${thumbnail(video)}
    <span class="video-card-info">
      ${avatar(video)}
      <span>
        <span class="video-title">${video.title}</span>
        <span class="meta">${video.creator} · ${video.views} · ${video.uploaded}</span>
        ${video.eligible ? `<span class="hype-tag">✦ ${remainingLabel(state, true)} · ${resetLabel(state)}</span>` : ""}
      </span>
    </span>
  </button>`;
}

function homeView() {
  const topics = ["All", "Gaming", "Music", "Design", "Fresh this week"];
  const filtered = activeTopic === "All" || activeTopic === "Fresh this week"
    ? videos
    : videos.filter((video) => video.category === activeTopic);
  return `<section class="screen">
    ${header()}
    <div class="topics" aria-label="Video topics">${topics.map((topic) => `
      <button class="chip" data-topic="${topic}" aria-pressed="${activeTopic === topic}">${topic}</button>`).join("")}
    </div>
    <div class="feed">${filtered.map(videoCard).join("")}</div>
  </section>`;
}

function balanceDots(remaining) {
  if (remaining === null) return `<div class="unlimited-mark" aria-label="Unlimited weekend Hypes">∞</div>`;
  const used = storeConfig.DEFAULT_REMAINING_HYPES - remaining;
  return `<div class="progress-dots" aria-label="${used} of ${storeConfig.DEFAULT_REMAINING_HYPES} Hypes used">${[0, 1, 2].map((index) => `<span class="progress-dot ${index < used ? "is-used" : ""}" aria-hidden="true"></span>`).join("")}</div>`;
}

function balanceCard(state) {
  const empty = !state.unlimitedHypes && state.remainingHypes === 0;
  return `<aside class="balance-card" aria-labelledby="balance-card-title">
    <div class="card-heading"><p class="eyebrow">HYPE BALANCE</p><button class="dismiss-button" data-dismiss-balance aria-label="Dismiss Hype balance card">${icon("close", 18)}</button></div>
    <h2 id="balance-card-title">${empty ? "All free Hypes used this period" : remainingLabel(state)}</h2>
    ${balanceDots(state.remainingHypes)}
    <p class="balance-reset">${resetLabel(state)}</p>
    <p class="balance-caption">${empty ? "Explore what viewers are supporting this week." : "Help another emerging creator get discovered."}</p>
    <div class="card-actions">
      <button class="primary-button" data-nav="explore">Explore hyped videos</button>
      <button class="secondary-button" data-how-hype>How Hype works</button>
    </div>
  </aside>`;
}

function howHypeWorks() {
  if (!showHowHypeWorks) return "";
  return `<section class="how-it-works" aria-labelledby="how-hype-title">
    <div class="card-heading"><strong id="how-hype-title">How Hype works</strong><button class="dismiss-button" data-close-how-hype aria-label="Close Hype information">${icon("close", 18)}</button></div>
    <div class="info-points"><span aria-hidden="true">✦</span><span>Use up to three free Hypes each week on eligible emerging creators.</span></div>
    <div class="info-points"><span aria-hidden="true">↻</span><span>Your counter always shows the exact local reset date.</span></div>
    <div class="info-points"><span aria-hidden="true">↶</span><span>Eligible experiment groups can undo a Hype for 24 hours and reassign it.</span></div>
  </section>`;
}

function hypeFeedbackCard(video, state) {
  if (!lastHypeResult) return "";

  const { backendState, fallbackState, usedBackend } = lastHypeResult;
  const historyItems = (backendState?.hypeHistory || fallbackState?.hypeEvents || []).slice(-4);
  const history = historyItems.map((entry) => ({
    videoId: entry.videoId || entry.video_id || "unknown",
    timestamp: entry.timestamp || entry.createdAt || null,
  }));
  const pointsTotal = usedBackend
    ? (backendState?.mockPointsTotal ?? 0)
    : getFallbackMockPoints(history);
  const remaining = usedBackend
    ? backendState?.remainingHypes ?? state.remainingHypes
    : state.remainingHypes;
  const currentVideoPoints = getMockPointsValue(video.id);
  const resetTiming = usedBackend
    ? getBackendResetLabel(backendState?.resetTime)
    : resetLabel(state);

  return `<section class="hype-feedback-card" aria-label="Hype confirmation">
    <div class="card-heading"><strong>Mock Hype sent</strong></div>
    <p class="balance-caption">This prototype uses clearly labeled mock points and does not connect to real YouTube points.</p>
    <div class="feedback-grid">
      <div><strong>${remaining === null ? "∞" : remaining}</strong><span>remaining Hypes</span></div>
      <div><strong>${formatMockPoints(currentVideoPoints)}</strong><span>current video mock points</span></div>
      <div><strong>${formatMockPoints(pointsTotal)}</strong><span>mock points you contributed</span></div>
    </div>
    <div class="feedback-history">
      <h3>Recent mock Hype history</h3>
      <ul>${history.length ? history.map((entry) => `<li>${entry.videoId} · ${entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : "this week"}</li>`).join("") : `<li>No past Hypes yet this week.</li>`}</ul>
    </div>
    <p class="balance-reset">${resetTiming}</p>
  </section>`;
}

function relatedCard(video) {
  return `<button class="related-card" data-open-video="${video.id}" aria-label="Watch ${video.title}">
    ${thumbnail(video, true)}
    <span class="related-copy"><span class="related-title">${video.title}</span><span class="rank-meta">${video.creator}<br>${video.views} · ${video.uploaded}</span></span>
  </button>`;
}

function watchView() {
  const video = getVideo(currentVideoId) || videos[0];
  const state = getState();
  const hypeCount = hypeCountForVideo(video.id, state);
  const isLiked = likedVideos.has(video.id);
  const isSubscribed = subscribedCreators.has(video.creator);
  const showBalance = lastHypedVideoId === video.id && !state.dismissedBalanceCard;
  // A dismissed card stays compactly represented when the viewer returns to a video
  // they have hyped, including after a refresh, while the full card stays session-led.
  const compactBalance = state.dismissedBalanceCard && hypeCount > 0;
  const hypeControl = getHypeControlState(video, state, hypeCount);
  const related = videos.filter((item) => item.id !== video.id).slice(0, 3);
  return `<section class="screen">
    <header class="topbar watch-topbar"><button class="back-button" data-back aria-label="Back to Home">${icon("back")}</button><div class="brand"><span>Now watching</span></div><div class="topbar-actions"><button class="icon-button" data-toast="More options are outside this focused concept." aria-label="More video options">•••</button></div></header>
    <div class="watch-content">
      <div class="player ${video.art}" aria-label="Mock video player for ${video.title}"><span class="art-shape"></span><span class="player-play" aria-hidden="true"></span></div>
      <h1 class="watch-title">${video.title}</h1>
      <p class="watch-meta">${video.views} · ${video.uploaded}${video.eligible ? " · Hype eligible" : ""}</p>
      <div class="creator-row">
        <div class="creator-identity">${avatar(video)}<span><span class="creator-name">${video.creator}</span><span class="creator-subs">${video.subscribers}</span></span></div>
        <button class="subscribe-button" data-subscribe="${video.creator}" aria-pressed="${isSubscribed}">${isSubscribed ? "Subscribed" : "Subscribe"}</button>
      </div>
      <div class="watch-action-row" aria-label="Video actions">
        <button class="action-button" data-like="${video.id}" aria-pressed="${isLiked}">${icon("like", 18)}<span>${isLiked ? "Liked" : "Like"}</span></button>
        ${renderHypeControl({ control: hypeControl, video, remainingText: remainingLabel(state, true), resetText: resetLabel(state), iconMarkup: icon("sparkle", 18) })}
        <button class="action-button" data-toast="Share is intentionally not connected in this concept.">${icon("share", 18)}<span>Share</span></button>
        <button class="action-button" data-toast="Downloads are intentionally not connected in this concept.">${icon("download", 18)}<span>Download</span></button>
      </div>
      ${compactBalance ? `<div class="compact-balance">${icon("sparkle", 17)}<span>${remainingLabel(state)} · ${resetLabel(state)}</span></div>` : ""}
      ${showBalance ? balanceCard(state) : ""}
      ${hypeFeedbackCard(video, state)}
      ${howHypeWorks()}
      <section class="description-box"><p>${video.description}</p><p class="micro-copy">${video.eligible ? "Eligible creators can receive Hype points from viewers." : "This video is outside the eligibility range in this concept."}</p></section>
      <h2 class="section-heading">Up next</h2>
      <div class="related-list">${related.map(relatedCard).join("")}</div>
    </div>
  </section>`;
}

function exploreView() {
  const state = getState();
  const categories = ["All", "Gaming", "Music"];
  const exploreVideos = videos.filter((video) => video.eligible && (activeTopic === "All" || activeTopic === "Fresh this week" || video.category === activeTopic));
  return `<section class="screen">
    <header class="explore-header"><button class="back-button" data-back aria-label="Back to Home">${icon("back")}</button><h1>✦ Hype</h1><span class="icon-button" aria-hidden="true"></span></header>
    <div class="explore-content">
      <section class="explore-summary" aria-label="Hype balance"><div class="balance-summary"><div><div class="balance-title-row">${icon("sparkle", 18)}<strong>${remainingLabel(state)}</strong></div><p class="balance-caption">${resetLabel(state)}</p></div><span class="balance-pill ${state.remainingHypes === 0 ? "is-empty" : ""}">${state.unlimitedHypes ? "∞" : `${state.remainingHypes}/3`}</span></div></section>
      <div class="topics" aria-label="Hype categories">${categories.map((category) => `<button class="chip" data-topic="${category}" aria-pressed="${activeTopic === category}">${category}</button>`).join("")}</div>
      ${exploreVideos.length ? `<div class="explore-list">${exploreVideos.map((video, index) => `<button class="ranked-card" data-open-video="${video.id}" aria-label="Open ranked video ${index + 1}: ${video.title}"><span class="rank-number">${index + 1}</span>${thumbnail(video, true)}<span class="related-copy"><span class="related-title">${video.title}</span><span class="rank-meta">${video.creator}<br>${video.hypePoints}</span></span></button>`).join("")}</div>` : `<div class="empty-state"><span class="empty-spark">✦</span><h2>No videos in this category</h2><p class="empty-copy">Try another Hype category.</p></div>`}
    </div>
  </section>`;
}

function hypeQueue(state) {
  const items = [...state.hypeEvents].reverse();
  return `<section class="you-panel queue-panel"><div class="panel-title-row"><div><p class="eyebrow">HYPE QUEUE</p><h2>Your recent Hypes</h2></div><span class="queue-count">${items.filter((item) => item.isActive).length}</span></div>
    ${items.length ? `<div class="queue-list">${items.map((event) => {
      const video = getVideo(event.videoId) || videos[0];
      const canUndo = event.isActive && new Date(event.undoExpiresAt) > new Date() && state.experiment.undoEnabled;
      return `<article class="queue-item">${thumbnail(video, true)}<div class="queue-copy"><strong>${video.title}</strong><span>${video.creator}</span><small>${event.isActive ? formatUndoWindow(event.undoExpiresAt) : "Undone · ready to reassign"}</small></div>
        ${event.isActive ? `<button class="queue-action" data-undo-hype="${event.eventId}" ${canUndo ? "" : "disabled"}>Undo</button>` : `<button class="queue-action" data-open-reassign="${event.eventId}">Reassign</button>`}
      </article>`;
    }).join("")}</div>` : `<p class="support-copy">Hyped videos will appear here with their 24-hour undo window.</p>`}
  </section>`;
}

function achievements(state) {
  const catalog = [
    ["trendspotter", "Trendspotter", "Back a video that reaches the leaderboard"],
    ["community-builder", "Community Builder", "Support 3 different creators"],
    ["supporter", "Supporter", "Use 10 Hypes"],
  ];
  const earned = new Map(state.badges.map((badge) => [badge.slug, badge]));
  return `<section class="you-panel"><p class="eyebrow">ACHIEVEMENTS${state.experiment.badgesEnabled ? "" : " · PREVIEW"}</p><h2>Your badges</h2><div class="badge-grid">${catalog.map(([slug, name, description]) => `<div class="badge ${earned.has(slug) ? "is-earned" : ""}" title="${description}"><span class="badge-icon">${earned.has(slug) ? "✦" : "◇"}</span><strong>${name}</strong><small>${earned.has(slug) ? "Earned" : description}</small></div>`).join("")}</div></section>`;
}

function reassignDialog() {
  if (!pendingReassignEventId) return "";
  const state = getState();
  const eligibleVideos = videos.filter((video) => video.eligible && !state.hypeEvents.some((event) => event.videoId === video.id));
  return `<div class="modal-backdrop" role="presentation"><section class="reassign-modal" role="dialog" aria-modal="true" aria-labelledby="reassign-title"><div class="card-heading"><h2 id="reassign-title">Choose a new video</h2><button class="dismiss-button" data-close-reassign aria-label="Close">${icon("close", 18)}</button></div><p class="support-copy">Your returned Hype will be applied immediately.</p><div class="reassign-list">${eligibleVideos.length ? eligibleVideos.map((video) => `<button data-reassign-video="${video.id}">${avatar(video)}<span><strong>${video.title}</strong><small>${video.creator}</small></span></button>`).join("") : `<p class="support-copy">You have already hyped every eligible video in this period.</p>`}</div></section></div>`;
}

function youView() {
  const state = getState();
  const used = state.hypeEvents.filter((event) => event.isActive).length;
  return `<section class="screen">
    ${header()}
    <div class="you-content">
      <section class="you-hero"><span class="profile-dot">IH</span><h1>Your space</h1><p class="support-copy">A local prototype for more intentional creator support.</p></section>
      <aside class="experiment-banner"><span>Experiment group</span><strong>${state.experiment.group.replaceAll("_", " ")}</strong><small>${state.experiment.quotaSchedule === "weekend_bonus" ? "Weekend Bonus active · Friday reset" : "Standard Monday reset"}${state.experiment.undoEnabled ? " · 24-hour undo" : ""}</small></aside>
      <section class="you-panel"><h2>Current Hype balance</h2><p class="support-copy">You have used <strong>${used}</strong> Hypes. <strong>${remainingLabel(state)}</strong>. ${resetLabel(state)}.</p>${balanceDots(state.remainingHypes)}</section>
      ${hypeQueue(state)}
      ${achievements(state)}
      <section class="you-panel"><h2>Demo controls</h2><p class="support-copy">Reset local Hype history and restore the weekly balance to three.</p><button class="danger-button" data-reset>Reset prototype</button></section>
      <p class="disclaimer">Unofficial product concept. All creators, videos, and Hype activity are fictional mock data.</p>
    </div>
    ${reassignDialog()}
  </section>`;
}

function render() {
  const views = { home: homeView, watch: watchView, explore: exploreView, you: youView };
  app.innerHTML = `<div class="app-layout"><div class="app-scroller">${views[currentView]()}</div>${bottomNav()}</div>${FeedbackModal(getVideo(feedbackVideoId))}${toastMessage ? `<div class="toast" role="status">${toastMessage}</div>` : ""}`;
  applyPendingFocus();
}

function navigate(view) {
  if (["shorts", "create", "subscriptions"].includes(view)) {
    showToast(`${view[0].toUpperCase() + view.slice(1)} is outside this focused concept.`);
    return;
  }
  if (view === "home") activeTopic = "All";
  currentView = view;
  showHowHypeWorks = false;
  setPendingFocus(view === "watch" ? ".back-button" : "h1, .brand");
  if (view === "explore") track("hype_explore_opened", { remainingHypes: getState().remainingHypes });
  render();
}

app.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;

  if (button.dataset.nav) return navigate(button.dataset.nav);
  if (button.dataset.topic) {
    activeTopic = button.dataset.topic;
    render();
    return;
  }
  if (button.dataset.openVideo) {
    currentVideoId = button.dataset.openVideo;
    currentView = "watch";
    lastHypedVideoId = null;
    showHowHypeWorks = false;
    track("video_opened", { videoId: currentVideoId });
    setPendingFocus(".back-button");
    render();
    return;
  }
  if (button.dataset.back !== undefined) return navigate("home");
  if (button.dataset.toast) return showToast(button.dataset.toast);
  if (button.dataset.like) {
    const id = button.dataset.like;
    likedVideos.has(id) ? likedVideos.delete(id) : likedVideos.add(id);
    render();
    return;
  }
  if (button.dataset.subscribe) {
    const creator = button.dataset.subscribe;
    subscribedCreators.has(creator) ? subscribedCreators.delete(creator) : subscribedCreators.add(creator);
    render();
    return;
  }
  if (button.dataset.hype) {
    const video = getVideo(button.dataset.hype);
    const beforeState = getState();
    track("hype_clicked", { videoId: video.id, remainingHypes: beforeState.remainingHypes });
    if (!video.eligible) return showToast("This video is not eligible for Hype in this concept.");
    if (beforeState.hypeEvents.some((item) => item.videoId === video.id)) {
      track("hype_blocked_duplicate", { videoId: video.id });
      announce("You already hyped this video in the current period.");
      return showToast("You already hyped this video.");
    }

    const backendResult = await submitHypeToBackend(video.id);
    let result;
    if (backendResult.ok) {
      const backendState = backendResult.data;
      const syncedState = syncBackendState(backendState);
      result = { ok: true, state: syncedState, backendState };
      lastHypeResult = {
        usedBackend: true,
        backendState: {
          ...backendState,
          mockPointsTotal: getFallbackMockPoints(backendState.hypeHistory || []),
          resetTime: backendState.resetTime,
        },
      };
    } else if (backendResult.unavailable) {
      result = hypeVideo(video.id);
      if (!result.ok) {
        if (result.reason === "already_hyped") {
          track("hype_blocked_duplicate", { videoId: video.id });
          announce("You already hyped this video in the current period.");
          return showToast("You already hyped this video.");
        }
        track("hype_blocked_zero_balance", { videoId: video.id });
        announce(`All free Hypes have been used. ${resetLabel(beforeState)}.`);
        return showToast("All free Hypes have been used for this period.");
      }
      lastHypeResult = {
        usedBackend: false,
        fallbackState: { hypeEvents: result.state.hypeEvents },
      };
    } else {
      if (backendResult.code === "already_hyped") {
        announce("You already hyped this video in the current period.");
        return showToast("You already hyped this video.");
      }
      announce(backendResult.error.message);
      return showToast(backendResult.error.message);
    }
    lastHypedVideoId = video.id;
    const { remainingHypes } = result.state;
    track("hype_succeeded", { videoId: video.id, remainingHypes });
    track("balance_card_viewed", { videoId: video.id, remainingHypes });
    announce(`${remainingHypes === null ? "Unlimited Hypes" : `${remainingHypes} Hypes left`}. ${resetLabel(result.state)}.`);
    if (shouldOpenFeedbackSurvey(result)) {
      feedbackVideoId = video.id;
      setPendingFocus('[data-feedback-form] input[name="reason"]');
    }
    render();
    return;
  }
  if (button.dataset.dismissFeedback !== undefined) {
    feedbackVideoId = null;
    announce("Feedback skipped.");
    render();
    return;
  }
  if (button.dataset.undoHype) {
    const eventId = button.dataset.undoHype;
    const backendResult = /^\d+$/.test(eventId) ? await undoHypeOnBackend(eventId) : { ok: false, unavailable: true };
    const localResult = backendResult.unavailable ? undoHype(eventId) : { ok: false };
    if (!backendResult.ok && !localResult.ok) return showToast(backendResult.error?.message || "This Hype can no longer be undone.");
    track("hype_undone", { eventId });
    announce("Hype undone. One Hype is available to reassign.");
    showToast("Hype returned — choose Reassign when ready.");
    return;
  }
  if (button.dataset.openReassign) {
    pendingReassignEventId = button.dataset.openReassign;
    render();
    return;
  }
  if (button.dataset.closeReassign !== undefined) {
    pendingReassignEventId = null;
    render();
    return;
  }
  if (button.dataset.reassignVideo) {
    const eventId = pendingReassignEventId;
    const videoId = button.dataset.reassignVideo;
    const backendResult = /^\d+$/.test(String(eventId)) ? await reassignHypeOnBackend(eventId, videoId) : { ok: false, unavailable: true };
    const localResult = backendResult.unavailable ? reassignHype(eventId, videoId) : { ok: false };
    if (backendResult.ok) syncBackendState(backendResult.data);
    if (!backendResult.ok && !localResult.ok) return showToast(backendResult.error?.message || "That Hype could not be reassigned.");
    pendingReassignEventId = null;
    track("hype_reassigned", { eventId, videoId });
    announce("Hype reassigned successfully.");
    showToast("Hype reassigned.");
    return;
  }
  if (button.dataset.dismissBalance !== undefined) {
    dismissBalanceCard();
    track("balance_card_dismissed", { videoId: currentVideoId });
    announce("Hype balance card dismissed. Your remaining balance is still shown by the Hype control.");
    render();
    return;
  }
  if (button.dataset.howHype !== undefined) {
    showHowHypeWorks = true;
    setPendingFocus("[data-close-how-hype]");
    render();
    return;
  }
  if (button.dataset.closeHowHype !== undefined) {
    showHowHypeWorks = false;
    setPendingFocus("[data-how-hype]");
    render();
    return;
  }
  if (button.dataset.reset !== undefined) {
    const confirmed = window.confirm("Reset this prototype? This restores three free Hypes and clears local Hype history.");
    if (!confirmed) return;
    resetPrototype();
    await resetBackendDemo();
    lastHypedVideoId = null;
    feedbackVideoId = null;
    track("prototype_reset");
    announce("Prototype reset. You now have three free Hypes this week.");
    showToast("Prototype reset — 3 Hypes restored.");
  }
});

app.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-feedback-form]");
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  const reasons = data.getAll("reason");
  const error = form.querySelector("[data-feedback-error]");
  if (!reasons.length) {
    error.hidden = false;
    form.querySelector('input[name="reason"]')?.focus();
    return;
  }
  const videoId = form.dataset.videoId;
  const additionalFeedback = String(data.get("additionalFeedback") || "");
  const backendResult = await submitFeedbackToBackend(videoId, reasons, additionalFeedback);
  saveFeedbackResponse({ videoId, reasons, additionalFeedback });
  feedbackVideoId = null;
  track("feedback_submitted", { videoId, reasons, storedOnBackend: backendResult.ok });
  announce("Thank you. Your feedback was recorded.");
  showToast("Thanks for the feedback.");
});

render();

async function hydrateFromBackend() {
  const [stateResult, badgeResult, queueResult] = await Promise.all([fetchHypeState(), fetchBadges(), fetchHypeQueue()]);
  if (stateResult.ok) syncBackendState(stateResult.data);
  if (queueResult.ok) syncQueue(queueResult.data.items);
  if (badgeResult.ok) syncBadges(badgeResult.data.items);
  render();
}

hydrateFromBackend();
window.setInterval(() => {
  if (currentView === "you" && getState().hypeEvents.some((event) => event.isActive)) render();
}, 60000);
