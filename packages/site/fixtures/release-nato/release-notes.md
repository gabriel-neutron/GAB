# GAB dataset, version 1.0 of 08/11/2026.

**About this data.** A machine reads public documents and proposes each claim. Each claim cites the documents that state it, and each claim carries a label that tells who decided it.

- **Proposed — not checked:** a candidate. No rule and no person checked it. It is not evidence.
- **Accepted by rule … — no person read it:** the claim passed a named rule on its cited sources. No person read it. Nobody has measured the accuracy of the rules yet.
- **Accepted by an AI reviewer — no person read it:** an AI checked the claim. No person read it.
- **Validated manually by the operator:** the operator read the sources and accepted the claim.
- **Reference dataset … — GAB did not check it:** the claim comes from a published dataset, as GEM, that the operator approved as a whole. No person read the claim, and GAB did not check it. This is not a check by the operator.

A claim tells what its sources say. A source can be wrong. GAB gives no personal data about a person beyond what a cited source already publishes. Each row carries its label: when you copy a row, copy its label with it.

Report an error: https://example.org/report-an-error. Right of reply: mailto:reply@example.org.

## The claims

The release holds 20 distinct claims. A row of claims.csv is one citation of a claim, so a claim can have more than one row. The column value_in_excerpt says if the value of an attribute claim is found in the excerpt of its row (a text test: a short value can be found in a passage that does not state the claim): "yes", "no", "no_excerpt" or "not_tested" (a claim of a relation has no value).

## The method of geolocation of the places

1 of 3 places (33.3%) have no stated method of geolocation. Each place of the files has a method, or "not_stated", in the column geolocation_method of entities.csv and in the properties of entities.geojson.

| Method | Places | Share |
| --- | --- | --- |
| not_stated | 1 | 33.3% |
| register_address | 1 | 33.3% |
| source_coordinates | 1 | 33.3% |

## The NATO pair of the claims

3 of 20 public claims (15.0%) have a full pair: a letter for the author and a digit for the fact. Each other claim is "not rated".

| Type | Claims with a full pair | Public claims | Share |
| --- | --- | --- | --- |
| entity company | 0 | 1 | 0.0% |
| entity vessel | 1 | 5 | 20.0% |
| relation crude_flows_to | 0 | 1 | 0.0% |
| relation designated_by | 1 | 1 | 100.0% |
| relation discharges_at | 0 | 1 | 0.0% |
| relation flagged_falsely | 0 | 3 | 0.0% |
| relation flags | 0 | 1 | 0.0% |
| relation insures | 0 | 1 | 0.0% |
| relation loads_at | 0 | 2 | 0.0% |
| relation operates | 0 | 1 | 0.0% |
| relation owns | 1 | 3 | 33.3% |

