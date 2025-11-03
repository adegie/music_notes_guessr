# Music Notes Guessr

Music Notes Guessr is a browser-based trainer for sight-reading treble and bass clef notes. A note is highlighted on one of two SVG staves, and you answer by pressing the matching letter key or clicking an on-screen button. The app tracks accuracy, streaks, guesses per minute, and offers quick feedback after every guess.

## Features

- Dual staves (treble above bass) rendered with scalable SVG graphics.
- Keyboard shortcuts: press `A`&ndash;`G` to answer, plus `H` as an alias for `B` to support German note naming.
- On-screen answer buttons for touch or mouse input.
- Scoreboard with correctness, attempts, accuracy percentage, guesses per minute, and current streak.
- Adjustable same-staff probability slider to control how often consecutive notes stay on one staff.
- Optional **Advanced mode** toggle that expands the note pool up to three ledger lines above and below each staff.
- New note button to skip ahead at any time.

## Getting Started

1. Open `index.html` in your browser.
2. Watch the highlighted note on the treble or bass staff.
3. Respond with the matching letter key or tap the button on screen. Press the **New note** button to skip.
4. Enable the **Advanced mode** checkbox to include ledger line notes (three bars above/below each staff).
5. Fine-tune the “Same staff chance” slider to adjust how often consecutive notes remain on the same staff.

No build step is required—everything runs client-side from the HTML, CSS, and JS files in the repository.

## File Overview

- `index.html` – The page structure and UI layout.
- `styles.css` – Layout, responsive adjustments, and visual styling.
- `app.js` – SVG staff rendering, note selection logic, keyboard handling, scoring, and advanced-mode behavior.

## Keyboard Reference

| Key | Action                       |
| --- | ---------------------------- |
| `A`&ndash;`G` | Submit the matching note |
| `H` | Alias for `B` (German naming) |
| `N`/click **New note** | Skip to the next note |

## License

MIT License. See `LICENSE` for details.
