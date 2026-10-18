# Prototype: three directions for the chain map (throwaway)

This folder is a throwaway prototype. It is a primary source for the design decision of the chain map, and it is not production code.

- A: night globe. MapLibre globe projection, a light pulse that runs along each link, and a "Play the chain" control that goes through the six stages.
- B: raised 3D arcs with particles, with three.js.
- C: a story that the reader scrolls, one chapter for each stage.

Decision (18 October 2026): the operator chose A.

The data is not in the repository. To run the prototype:

1. Write a test release with `pnpm worker release`, to a folder outside the checkout.
2. Run `node extract.cjs <release site folder>/map/index.html`. It writes `data.json` here.
3. Copy `countries.json` of the release site to `public/`. Copy the MapLibre files `maplibre-gl.mjs`, `maplibre-gl-shared.mjs` and `maplibre-gl-worker.mjs` to `public/assets/`.
4. Install `maplibre-gl`, `three`, `motion` and `vite` in a scratch folder, run `vite build`, then `vite preview`. Open `?v=a`, `?v=b` or `?v=c`.
