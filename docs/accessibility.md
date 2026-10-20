# Accessibility checks

Two parts: an automated check that runs in the build, and a manual checklist that a person does.

## The automated check

Each story of a page or of a part is a test. The Storybook accessibility add-on runs the axe rules
on the story after it plays. A fault fails the test. The check runs two times: once in the light
theme and once in the dark theme, so the contrast of the text, the links and the symbols is
measured in both. The rule for the size of a touch target is in the same run.

Run both passes with the `test:a11y` and `test:a11y:dark` scripts. The `no-stack` job of the
gates workflow runs them on each pull request.

The check cannot read a canvas. The map and the graph draw their symbols and halos in WebGL, so
axe sees no text there. A person checks them with the list below.

### Known faults

A story that has a known fault which is not fixed yet is set to `todo` in its own `parameters.a11y`
with a reason beside it. A `todo` story still reports the fault and does not fail the build. Remove
the line when the fault is fixed.

## The manual checklist

A person does it, with a real screen reader and a real keyboard. An agent cannot. Write the date,
the person, the browser, the screen reader and the result after each line. A line without a date
means the check is not done.

| Check | Result |
|---|---|
| Screen reader reads the map: the legend, the rail, a selected symbol | not done |
| Screen reader reads the graph: the legend, the list, a selected node | not done |
| Zoom 200 percent: no text is cut, no control is out of reach, the page does not scroll in two directions | not done |
| Zoom 400 percent: the same, at a width of 320 px | not done |
| Keyboard only: every control is reachable, the focus is visible, the focus moves into a panel that opens and back when it closes | not done |
| Keyboard only: a popover and a dialog close with Escape | not done |
| Contrast of the halo and of the symbols on the map, in both themes | not done |
