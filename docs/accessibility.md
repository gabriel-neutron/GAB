# Accessibility checks

No automated check runs in the build. A person does the manual checklist.

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
| Keyboard only: a page or a table that scrolls takes one tab stop, with a visible focus ring | not done |
| Keyboard only: a popover and a dialog close with Escape | not done |
| Contrast of the halo and of the symbols on the map, in both themes | not done |
