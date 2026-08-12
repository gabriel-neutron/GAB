# A live canvas — a library that owns an element and runs its own loop

**When this file applies.** To any folder that mounts a library which takes one DOM element, owns
everything below it, and runs its own loop. `src/features/map/` (MapLibre) and `src/features/graph/`
(Sigma) are the two that exist. A third such library is a question for the operator before it is
installed, and these rules hold for it from that day.

The framework renders one element, mounts once, and disposes at unmount. These rules are the price
of that, and each failure below is invisible in a review.

## The adapter

- **One `ref`, one imperative adapter, and every other value outside React.** No React state and no
  React render inside the tree that wraps the live element. ADR 0004 §3.
- **The rule reaches the ancestors of the canvas, and not the chrome beside it.** A camera value, a
  style, a selection or the instance in React state above the live element is the fault the ADR
  names. The rail, the row and the index are **siblings** of the canvas, and they hold ordinary
  React state: which type is open, the text in a search field, hover. The route memoises the canvas
  so that this stays true — `docs/map-surface.md` records it, under the finding about the selection
  and the address. Where a value must sit in an **ancestor** of the canvas, stop and ask the
  operator.
- **Drive the library directly.** `react-map-gl` and `@react-sigma/core` are refused: a wrapper is a
  second lifecycle over a library that already has one, and both wrappers lag the library.
  ADR 0004 §2.
- **The adapter publishes a handle, and every other component drives the library through it.** No
  second file touches the library.
- **A mount is idempotent and a cleanup is complete.** React invokes an effect twice in development.
  A second instance makes the browser drop the older WebGL context, which looks like a blank canvas
  and is not one.
- **No story mounts a live canvas.** One story is one live WebGL context, and a browser drops the
  oldest after about sixteen. `.storybook/main.ts` records it. Story the panels beside the canvas,
  and check the canvas itself in the running application.

## The traps that no type checker sees

- **A `ResizeObserver` on the container is required, and it is not an optimisation.** The library
  measures the container once, while the chrome around it is still being built. A canvas of the
  wrong size draws correctly and warns about nothing.
- **A layout property needs a loaded style.** It throws while the style loads, and a control can be
  clicked in that window. Use one queue, drained on load, for every caller.
- **`getSource` returns nothing before the style loads, and it returns it in silence.** A selection
  restored from the address is applied again once the style is loaded.
- **A component that subscribes after the map is built has already missed the restore.** Seed from
  the current selection, then subscribe.
- **A style that is rebuilt drops every source with it.** Put both grounds in the style, hide one,
  and switch with a layout property.

## Colour

- **A CSS custom property never reaches a map or a graph style parser.** The hues are copied as hex,
  and the copy is a recorded cost. `projection.ts` holds the copy for the map, with the reason.
- **The dark set is used**, because a point sits on imagery and the light set cannot be read on it.
- The theme is read from the class on `documentElement`, with an observer, and never from React.

## Data and layers

- **One data source, and one layer per type.** A panel of thirty types must not be thirty queries. A
  type is hidden with `visibility`, which needs no new data, and a hidden layer returns nothing from
  a hit test.
- **A type that is switched off drops the selection.** A selected point that is not drawn is a lie
  on the screen.
- **A point wins over a line it crosses**, and a line needs a hit box of about 5px on each side.
- **Positions are precomputed and stored, and never computed in the browser at each open.** A force
  layout is not deterministic, so the picture would change on every open. Where they are stored is
  open, and the tracker carries it.
