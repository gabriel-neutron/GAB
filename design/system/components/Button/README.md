# Button

A flat control with square corners that commits an action; the fill is always neutral, never a data colour.

## Variants
- `gab-btn--primary`: `primary` fill, `primary-foreground` text. One per surface, for the step that commits (promote, save, export).
- `gab-btn--secondary`: `surface-secondary` fill (Factory dark filled button, #1f1d1c). Every other action.
- `gab-btn--destructive`: transparent, `destructive` text and 1px inset edge. Never a red fill.
- `gab-btn--icon`: square, 32px. Give it an `aria-label`. Never the only label of a destructive action.

## Rules
- Height `control-height` (32px), padding 0 14px, `body-sm` text at weight 400.
- Never fill a button with `signal`, `positive` or an entity hue. Colour is data, not chrome.
- A shortcut hint sits inside the button as `gab-kbd`.
- Transitions: 150ms, `cubic-bezier(0.4, 0, 0.2, 1)`, colour only. No scale, no shadow.
- Focus: 2px solid `ring`, 2px offset.
