export function getHypeControlState(video, state, hypeCount) {
  if (!video.eligible) return { kind: "ineligible", label: "Not eligible" };
  if (!state.unlimitedHypes && state.remainingHypes === 0) {
    return { kind: "quota_exhausted", label: "No Hypes left" };
  }
  if (hypeCount > 0) return { kind: "already_hyped", label: "Hyped ✓" };
  return { kind: "available", label: "Hype" };
}

export function shouldOpenFeedbackSurvey(result) {
  return Boolean(result?.ok);
}

export function renderHypeControl({ control, video, remainingText, resetText, iconMarkup }) {
  if (control.kind === "quota_exhausted") {
    return `<div class="quota-exhausted" role="status"><strong>No Hypes left</strong><small>${resetText}</small></div>`;
  }
  const disabled = control.kind === "available" ? "" : "disabled";
  const hypedClass = control.kind === "already_hyped" ? " is-hyped" : "";
  return `<button class="action-button hype-button${hypedClass}" data-hype="${video.id}" ${disabled} aria-label="${control.label} ${video.title}; ${remainingText}">${iconMarkup}<span>${control.label}<small>${remainingText}</small></span></button>`;
}
