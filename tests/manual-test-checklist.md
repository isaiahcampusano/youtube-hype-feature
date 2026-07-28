# Manual test checklist

Run these checks in a modern browser with site storage enabled.

- [ ] First visit starts with 3 Hypes.
- [ ] Hype an eligible video: 3 becomes 2 and the Balance Card appears.
- [ ] Hype the same eligible video again: 2 becomes 1.
- [ ] Hype another eligible video: 1 becomes 0.
- [ ] A fourth Hype is blocked and the action is disabled.
- [ ] Refresh after using a Hype; the balance and per-video Hype state persist.
- [ ] Dismiss the Balance Card; a compact balance label remains when returning to that hyped video.
- [ ] Open the Hype Explore view; its balance matches the Watch view.
- [ ] Open the ineligible camera video; it cannot be hyped.
- [ ] Use You → Reset prototype; cancel once, then confirm and verify 3 Hypes are restored.
- [ ] Test keyboard navigation and visible focus states.
- [ ] Enable reduced motion and confirm card animation is suppressed.
- [ ] Test at 320 px, 390 px, and desktop widths; confirm no horizontal overflow.
