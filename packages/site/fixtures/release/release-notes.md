# GAB dataset, version 1.0 of 08/11/2026.

**About this data.** A machine reads public documents and proposes each claim. Each claim cites the documents that state it, and each claim carries a label that tells who decided it.

- **Proposed — not checked:** a candidate. No rule and no person checked it. It is not evidence.
- **Accepted by rule … — no person read it:** the claim passed a named rule on its cited sources. No person read it. Nobody has measured the accuracy of the rules yet.
- **Accepted by an AI reviewer — no person read it:** an AI checked the claim. No person read it.
- **Validated manually by the operator:** the operator read the sources and accepted the claim.

A claim tells what its sources say. A source can be wrong. GAB gives no personal data about a person beyond what a cited source already publishes. Each row carries its label: when you copy a row, copy its label with it.

Report an error: https://example.org/report-an-error. Right of reply: mailto:reply@example.org.

## The method of geolocation of the places

1 of 3 places (33.3%) have no stated method of geolocation. Each place of the files has a method, or "not_stated", in the column geolocation_method of entities.csv and in the properties of entities.geojson.

| Method | Places | Share |
| --- | --- | --- |
| not_stated | 1 | 33.3% |
| register_address | 1 | 33.3% |
| source_coordinates | 1 | 33.3% |

