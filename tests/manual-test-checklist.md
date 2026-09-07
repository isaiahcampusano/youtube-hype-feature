# Manual test checklist

Run the API and static client, then test in a modern browser with storage enabled.

## Balance and schedule

- [ ] Every eligible feed card shows remaining Hypes and a reset date before any Hype is used.
- [ ] The Watch Hype button and Explore summary show the same balance.
- [ ] A successful Hype updates every balance surface without a refresh.
- [ ] Three different standard-period Hypes exhaust the allowance and prevent further allocation.
- [ ] At zero balance, the Hype button is absent and a reset message is shown.
- [ ] After Hyping a video once, its action reads “Hyped ✓” and cannot be used again that period.
- [ ] The experiment notice shows the assigned group and schedule.
- [ ] With Weekend Bonus forced on a Friday–Sunday test clock, the UI shows unlimited Hypes (or 6 in `extra_3` mode).

## Queue, undo, and reassign

- [ ] A new Hype appears in Your space with creator, thumbnail, and countdown.
- [ ] Undo succeeds before 24 hours and immediately restores one Hype.
- [ ] Undo is disabled after 24 hours.
- [ ] An undone row offers Reassign; the picker lists only eligible videos.
- [ ] Reassign consumes the restored capacity and creates a new 24-hour window.
- [ ] Refresh preserves active and undone queue entries when the API is running.

## Badges and safety

- [ ] Achievements show earned or locked state with threshold explanations.
- [ ] Supporting three unique eligible videos awards Community Builder when badges are enabled.
- [ ] The prototype uses only fictional creators, generic art, and mock points.
- [ ] Reset prototype clears API and local demo history.

## Feedback

- [ ] Every successful Hype opens the optional feedback modal.
- [ ] Submitting without a reason shows an inline validation message.
- [ ] One or more reasons and optional text can be submitted.
- [ ] Skip closes the modal without changing Hype state.
- [ ] A recorded response appears in API storage when the backend is configured, and local storage otherwise.

## Accessibility and layout

- [ ] Keyboard focus reaches all actions, the reassignment dialog, and its close button.
- [ ] Status updates are announced by the live region.
- [ ] At 320px, 390px, and desktop widths there is no horizontal page overflow.
- [ ] With reduced motion enabled, transitions are suppressed.
