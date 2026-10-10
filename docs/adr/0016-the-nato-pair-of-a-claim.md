# ADR 0016 — The NATO pair of a claim

**Status** Accepted · 10 October 2026

## Context

`decisions.md` S1 gives a NATO letter to each author and a digit to each fact, and the public does
not see them. The operator must decide soon if the public will see the pair of each claim. Before
that, the operator must know which share of the public claims has a full pair. A release must be
ready for both answers. A pair that leaves Gabriel is cited, so its meaning is costly to change
after the first publication.

## Decision

### One function gives the pair

- One function in the database gives the pair of each claim, from the act that the claim names.
- The digit is the digit of the fact of the act, as S1 and ADR 0012 compute it.
- The letter is the best letter among the known authors of the support of the fact. The support
  is the list that the rule "strong sources" reads: each act of the fact that is not rejected, has
  a passed check by a second model family, and states or enacts the fact. The rules and the pair
  read one list, so they cannot disagree on what supports a fact. No new rating rule exists.
- The two marks are judged apart, and the function only puts them side by side.
- A claim with no digit, or with no known author in its support, has no pair.
- The pair is computed on read, so it never goes stale. The function judges each fact once, also
  when many claims share it.

### Only the operator role reads it

The operator role holds the function, as it holds the letter and the digit. A machine role does
not: an AI that read the pair would read the marks that the rules decide from. The public read
role does not, because the public does not see the pair.

### The release and the coverage

- A release shows the pair only when its manifest asks (ADR 0013). Each claim row with a pair then
  gives its letter and its digit, in the claims CSV and in the JSON-LD file (ADR 0015).
- A worker command reports, for the claims of a release, the number and the share with a full
  pair, in all and by entity type and relation type. It reads the claims as the release reads
  them, and it writes nothing.

## Alternatives

- **The worst letter, or the letter of the act that set the value.** The letter would not say how
  reliable the best author of the fact is, and the digit already counts the other authors.
  Refused.
- **A key for each value of a new entity.** It changes the digit of S1 and the rules. Refused for
  now.
- **The pair for the machine roles.** It shows the marks to the AIs. Refused.

## Cost

- One author A beside many authors F shows A. The digit tells the rest.
- **The fact of a new entity is the entity, and not each of its values.** So each value that the
  act of creation set takes the pair of the creation: a value that a weak author gave takes the
  letter of a strong author that gave only another value of the same entity. The coverage report
  counts these values as claims with a full pair, so it can show a share that is too high.
- An act of the operator names no author, so its claim has no pair.
- The report computes the digit of each fact of a release. Its time on the real record is not
  measured.
