const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export function FeedbackModal(video) {
  if (!video) return "";
  const options = [
    "Loved the content",
    "Supporting a small creator",
    "Quality was exceptional",
    "Other",
  ];
  return `<div class="modal-backdrop feedback-backdrop" role="presentation">
    <section class="feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title" aria-describedby="feedback-description">
      <div class="card-heading">
        <div><p class="eyebrow">OPTIONAL FEEDBACK</p><h2 id="feedback-title">Why did you Hype this video?</h2></div>
        <button class="dismiss-button" data-dismiss-feedback aria-label="Skip feedback">×</button>
      </div>
      <p id="feedback-description" class="support-copy">Your answer helps improve Hype. Select one or more reasons for “${escapeHtml(video.title)}.”</p>
      <form data-feedback-form data-video-id="${escapeHtml(video.id)}">
        <fieldset class="feedback-options"><legend class="sr-only">Reasons for your Hype</legend>
          ${options.map((option) => `<label><input type="checkbox" name="reason" value="${option}"><span>${option}</span></label>`).join("")}
        </fieldset>
        <label class="feedback-notes"><span>Anything else? <small>Optional</small></span><textarea name="additionalFeedback" maxlength="500" rows="3" placeholder="Share more context"></textarea></label>
        <p class="feedback-error" data-feedback-error role="alert" hidden>Select at least one reason.</p>
        <div class="feedback-actions"><button type="button" class="secondary-button" data-dismiss-feedback>Skip</button><button type="submit" class="primary-button">Submit feedback</button></div>
      </form>
    </section>
  </div>`;
}
