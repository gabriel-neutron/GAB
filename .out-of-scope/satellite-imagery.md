# Heavy satellite imagery processing

Gabriel does not process satellite imagery. It renders and composes map layers; it does
not analyse rasters.

## Why this is out of scope

The map is both an analysis surface and a presentation surface, and the analyst creates
geographic elements and composes layers inside Gabriel. That is vector work — geometries,
attributes, sources — and it fits the schema, which stores geometry alongside every other
sourced attribute.

Raster analysis is a different discipline with different tooling, different compute, and
different storage. Change detection, band maths, and imagery tiling pipelines would
dominate the system's complexity while serving one narrow slice of the workflow.

Imagery-derived findings are welcome — as documents. An analyst who identifies something
from imagery elsewhere records the finding with its source, and it enters the corpus like
any other claim.

## Prior requests

None yet — seeded from `docs/prd.md` §5 at project setup.
