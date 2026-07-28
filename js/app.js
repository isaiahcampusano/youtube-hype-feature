import { videos, getVideo } from "./data.js";
import {
  dismissBalanceCard,
  getState,
  hypeCountForVideo,
  hypeVideo,
  resetPrototype,
  storeConfig,
} from "./hype-store.js";
import {
  formatMockPoints,
  getBackendResetLabel,
  getFallbackMockPoints,
  getMockPointsValue,
  submitHypeToBackend,
} from "./hype-backend.js";

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
  return `<button class="video-card" data-open-video="${video.id}" aria-label="Watch ${video.title}">
    ${thumbnail(video)}
    <span class="video-card-info">
      ${avatar(video)}
      <span>
        <span class="video-title">${video.title}</span>
        <span class="meta">${video.creator} · ${video.views} · ${video.uploaded}</span>
        ${video.eligible ? '<span class="hype-tag">✦ Hype eligible</span>' : ""}
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
    ${bottomNav()}
  </section>`;
}

function balanceDots(remaining) {
  const used = storeConfig.DEFAULT_REMAINING_HYPES - remaining;
  return `<div class="progress-dots" aria-label="${used} of ${storeConfig.DEFAULT_REMAINING_HYPES} Hypes used">${[0, 1, 2].map((index) => `<span class="progress-dot ${index < used ? "is-used" : ""}" aria-hidden="true"></span>`).join("")}</div>`;
}

function balanceCard(state) {
  const empty = state.remainingHypes === 0;
  return `<aside class="balance-card" aria-labelledby="balance-card-title">
    <div class="card-heading"><p class="eyebrow">HYPE BALANCE</p><button class="dismiss-button" data-dismiss-balance aria-label="Dismiss Hype balance card">${icon("close", 18)}</button></div>
    <h2 id="balance-card-title">${empty ? "All free Hypes used this week" : `${state.remainingHypes} ${state.remainingHypes === 1 ? "Hype" : "Hypes"} left this week`}</h2>
    ${balanceDots(state.remainingHypes)}
    <p class="balance-reset">Your free Hypes reset Monday at 12:00 a.m.</p>
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
    <div class="info-points"><span aria-hidden="true">↻</span><span>Your allowance resets every Monday at 12:00 a.m. local time.</span></div>
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
    : "Monday at 12:00 a.m. local time";

  return `<section class="hype-feedback-card" aria-label="Hype confirmation">
    <div class="card-heading"><strong>Mock Hype sent</strong></div>
    <p class="balance-caption">This prototype uses clearly labeled mock points and does not connect to real YouTube points.</p>
    <div class="feedback-grid">
      <div><strong>${remaining}</strong><span>remaining weekly Hypes</span></div>
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
  const eligibleLabel = !video.eligible
    ? "Not eligible"
    : state.remainingHypes === 0
      ? "No Hypes left"
      : hypeCount > 0 ? "Hype again" : "Hype";
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
        <button class="action-button" data-toast="Share is intentionally not connected in this concept.">${icon("share", 18)}<span>Share</span></button>
        <button class="action-button" data-toast="Downloads are intentionally not connected in this concept.">${icon("download", 18)}<span>Download</span></button>
        <button class="action-button hype-button" data-hype="${video.id}" ${!video.eligible || state.remainingHypes === 0 ? "disabled" : ""} aria-label="${eligibleLabel} ${video.title}">${icon("sparkle", 18)}<span>${eligibleLabel}</span></button>
      </div>
      ${compactBalance ? `<div class="compact-balance">${icon("sparkle", 17)}<span>${state.remainingHypes} ${state.remainingHypes === 1 ? "Hype" : "Hypes"} left this week · resets Monday</span></div>` : ""}
      ${showBalance ? balanceCard(state) : ""}
      ${hypeFeedbackCard(video, state)}
      ${howHypeWorks()}
      <section class="description-box"><p>${video.description}</p><p class="micro-copy">${video.eligible ? "Eligible creators can receive Hype points from viewers." : "This video is outside the eligibility range in this concept."}</p></section>
      <h2 class="section-heading">Up next</h2>
      <div class="related-list">${related.map(relatedCard).join("")}</div>
    </div>
    ${bottomNav()}
  </section>`;
}

function exploreView() {
  const state = getState();
  const categories = ["All", "Gaming", "Music"];
  const exploreVideos = videos.filter((video) => video.eligible && (activeTopic === "All" || activeTopic === "Fresh this week" || video.category === activeTopic));
  return `<section class="screen">
    <header class="explore-header"><button class="back-button" data-back aria-label="Back to Home">${icon("back")}</button><h1>✦ Hype</h1><span class="icon-button" aria-hidden="true"></span></header>
    <div class="explore-content">
      <section class="explore-summary" aria-label="Weekly Hype balance"><div class="balance-summary"><div><div class="balance-title-row">${icon("sparkle", 18)}<strong>${state.remainingHypes} ${state.remainingHypes === 1 ? "Hype" : "Hypes"} left</strong></div><p class="balance-caption">Resets Monday at 12:00 a.m.</p></div><span class="balance-pill ${state.remainingHypes === 0 ? "is-empty" : ""}">${state.remainingHypes}/3</span></div></section>
      <div class="topics" aria-label="Hype categories">${categories.map((category) => `<button class="chip" data-topic="${category}" aria-pressed="${activeTopic === category}">${category}</button>`).join("")}</div>
      ${exploreVideos.length ? `<div class="explore-list">${exploreVideos.map((video, index) => `<button class="ranked-card" data-open-video="${video.id}" aria-label="Open ranked video ${index + 1}: ${video.title}"><span class="rank-number">${index + 1}</span>${thumbnail(video, true)}<span class="related-copy"><span class="related-title">${video.title}</span><span class="rank-meta">${video.creator}<br>${video.hypePoints}</span></span></button>`).join("")}</div>` : `<div class="empty-state"><span class="empty-spark">✦</span><h2>No videos in this category</h2><p class="empty-copy">Try another Hype category.</p></div>`}
    </div>
    ${bottomNav()}
  </section>`;
}

function youView() {
  const state = getState();
  const used = storeConfig.DEFAULT_REMAINING_HYPES - state.remainingHypes;
  return `<section class="screen">
    ${header()}
    <div class="you-content">
      <section class="you-hero"><span class="profile-dot">IH</span><h1>Your space</h1><p class="support-copy">A local prototype for more intentional creator support.</p></section>
      <section class="you-panel"><h2>This week's Hypes</h2><p class="support-copy">You have used <strong>${used}</strong> of 3 free Hypes. Your balance resets Monday at 12:00 a.m.</p>${balanceDots(state.remainingHypes)}</section>
      <section class="you-panel"><h2>Demo controls</h2><p class="support-copy">Reset local Hype history and restore the weekly balance to three.</p><button class="danger-button" data-reset>Reset prototype</button></section>
      <p class="disclaimer">Unofficial product concept. All creators, videos, and Hype activity are fictional mock data.</p>
    </div>
    ${bottomNav()}
  </section>`;
}

function render() {
  const views = { home: homeView, watch: watchView, explore: exploreView, you: youView };
  app.innerHTML = `${views[currentView]()}${toastMessage ? `<div class="toast" role="status">${toastMessage}</div>` : ""}`;
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

    const backendResult = await submitHypeToBackend(video.id);
    let result;
    if (backendResult.ok) {
      const backendState = backendResult.data;
      result = { ok: true, state: { remainingHypes: backendState.remainingHypes }, backendState };
      lastHypeResult = {
        usedBackend: true,
        backendState: {
          ...backendState,
          mockPointsTotal: getFallbackMockPoints(backendState.hypeHistory || []),
          resetTime: new Date().toISOString(),
        },
      };
    } else {
      result = hypeVideo(video.id);
      if (!result.ok) {
        track("hype_blocked_zero_balance", { videoId: video.id });
        announce("All free Hypes have been used this week. They reset Monday at 12:00 a.m.");
        return showToast("All free Hypes have been used this week.");
      }
      lastHypeResult = {
        usedBackend: false,
        fallbackState: { hypeEvents: result.state.hypeEvents },
      };
    }
    lastHypedVideoId = video.id;
    const { remainingHypes } = result.state;
    track("hype_succeeded", { videoId: video.id, remainingHypes });
    track("balance_card_viewed", { videoId: video.id, remainingHypes });
    announce(`${remainingHypes} ${remainingHypes === 1 ? "Hype" : "Hypes"} left this week. Your free Hypes reset Monday at 12:00 a.m.`);
    render();
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
    lastHypedVideoId = null;
    track("prototype_reset");
    announce("Prototype reset. You now have three free Hypes this week.");
    showToast("Prototype reset — 3 Hypes restored.");
  }
});

render();
