---
name: research-method
description: The method of a research layer in Gabriel. What a fact is, what to source and how, what never goes into Gabriel, how to build a batch that the app accepts. Read it at the start of each research session, before the first proposal.
---

# The method of a research layer

## The goal

Gabriel is a record of facts that each cite a stored source. The rules of the database decide
each proposal from its sources. A proposal with a doubt goes to a reviewer: the operator, or an AI
reviewer in another session (the skill `review-unit`). This session never decides what it
proposed. Thus a good session proposes few facts, each one
on the subject of its layer, each one with the best source that exists, and each one ready to
promote. A proposal that the operator must reject costs more than a fact that you leave out.

The app is strict. Code refuses a batch when an excerpt is not on its page, when a type is not a
word of the vocabulary, or when a relation names an entity that does not exist. Code marks an item
as disputed when a value of the item is not in its excerpts. Then a model of another family reads
each item with its excerpts, and marks as disputed an item that they do not support. No rule
accepts a disputed fact, so read each excerpt again against its item before you send the batch.
Propose only what passes these checks with no correction.

## What a fact is

One fact is one item of a batch:

- an entity: a company, a state body, a bank, a vessel, a person, a facility, a legal act;
- an attribute of an entity: an identifier, a date, a number with its unit in the key;
- a relation between two entities, with its dates when the source gives them;
- a status: a listing in a sanctions act, with the act and the date.

A sanctions measure has one of two relation types. `designated_by` is a listing by name. For a
vessel, it is an entry on the vessel list of a regime: the OFAC SDN list, Annex XLII of Council
Regulation (EU) No 833/2014, or a UK specified ship. For any other entity, it is a listing with an
asset freeze: an entry of the OFAC SDN list, Annex I of Council Regulation (EU) No 269/2014, or a
UK asset freeze. Any other sectoral measure freezes no asset, and it is `restricted_by`: an
OFAC directive under Executive Order 13662 or 14024 (OFAC writes "identified", not "designated"),
or another annex or article of Council Regulation (EU) No 833/2014 (for example Annex III, XIV,
XLIV, XLV or XLVII, or Article 5af). One act can hold the two kinds of measure, so read the
provision and not only the act. The excerpt names the exact provision: the directive, the annex or
the article.

## What you must source

Each fact cites at least one stored document, with the page and an excerpt that states each value
of the fact: the name, each attribute value, each date, each number. Copy the excerpt word for
word from the stored text (`document_text`), not from the web page that you saw. For a PNG or
JPEG image whose OCR text misses the fact, the skill `cite-claim` says how to cite the image.

## What never goes into Gabriel

- Your reasoning, a hypothesis, a lead, a summary, a score, a rating.
- A group or a concept that is not one entity: "European countries", "Russian oil companies",
  "financial sanctions", "the shadow fleet".
- A figure that belongs to no entity of the layer: a total of trade, a share of exports, a price.
- The metadata of a source: its authors, their e-mail addresses, the publisher, the journal, the
  institute that paid for it. An author becomes an entity only when the author is the subject.
- A person, unless a sanctions act designates the person (`designated_by`), or a public filing
  names the person as a director, an owner or an officer. A sectoral measure (`restricted_by`) is
  not enough. Never an address, a telephone number or an e-mail address
  of a person.
- A fact that the record holds, or that a pending proposal holds. Check first with `search_graph`,
  `read_entity` and `list_proposals`.
- A fact outside the layer of the ticket. Write it in your notes as a lead for a later layer.

## The best source for each fact

Use the highest kind of source that holds the fact. Go down the list only when no higher source
exists.

| Kind of source | Examples | Modality |
|---|---|---|
| An official act or an official list | An EU regulation, an OFAC entry, a decree | `enacts` |
| A register record | GLEIF, Companies House, a state company register | `asserts` |
| A filing or a page of the entity itself | An annual report, the site of the company | `asserts` |
| A report of a public body, a court, a regulator | A central bank report, a court decision | `asserts` |
| An academic paper, a think tank, the press | A working paper, a news article | `asserts` or `attributes` |
| A social post, a forum, a channel | A Telegram post | `asserts` or `attributes`, or a lead only |

- `originator` is the party that first stated the fact: the issuer of the act, the register, the
  company, the authors of the paper, the channel. A platform or a host is never the originator.
- An academic paper, a news article or a post is a valid source for the facts that it states.
  When it states the fact itself, the originator is its authors (or the outlet, or the channel),
  and the modality is `asserts`. When it reports what another party says, the originator is that
  party, and the modality is `attributes`.
- When a paper or an article cites a primary source (an act, a register, a filing), fetch that
  source too and cite it in the same item.
- `alleges` is for an accusation that is not proved. `denies` is for a source that says a fact is
  not true.
- A sanctions status cites the official act or the official entry, never OpenSanctions and never a
  news article (skill `cite-claim`).

## The steps of a layer

1. Read the ticket of the layer. Write the list of the candidate nodes in a file under
   `research/out/`, one line for each node, with the reason that puts it in the layer.
2. For each node, use the skill `investigate-node`: what the record holds, what is pending, what
   is missing.
3. Find the best source of each missing fact. Store it with the skill `source-hunt`, or with a
   register lookup. Read the stored text with `document_text`.
4. Propose the facts of the node with the skill `cite-claim`, in the batches below.
5. At the end of the session, report with the skill `carto-step`, and give the list of needs.

## A batch that the app accepts

- One node in each batch: the entity, its attributes, and its relations to entities that the
  record already holds or that the same batch creates. A batch of 5 to 20 items is a good size.
  The operator decides each entity together with the relations that depend on it. A wrong entity
  takes its relations with it, so check each entity before you send the batch.
- One fact in each item. Never two facts in one item.
- An excerpt is short: the sentence or the line that states the values. Each value of the item
  must be in its excerpts, in the same form or in an equivalent form (a date, a number, a case).
- The type of an entity and of a relation is a word of `list_vocabulary`. Never make up a word.
  A ministry, an agency or a council is `state_body`. A central bank is `bank`.
- An identifier uses its key of `list_vocabulary`, for example `lei`, `registration_number`,
  `tax_id`, `imo`.
- The label is the name as the source writes it. Write the other names in the attribute `aliases`
  only when a source states them.
- When the tool refuses a batch, read the item and the reason, correct only that item, and send
  the batch again one time. When the answer marks an item as disputed, read its excerpt again. If
  the excerpt does not state the value, the fact has no source yet: leave it out next time.
- When the answer gives `checkFailure`, no model checked the batch. Its facts wait with no check,
  and no rule accepts them. If the reason names the token cap, send the same items again in
  smaller batches. For any other reason, tell the operator, and send the same batch again when
  the operator says that the checker is up: a batch sent again writes nothing twice and gets its
  check.

## Never

- Never propose a fact that you did not read in a stored document.
- Never cite a page that you saw in a browser or in a search result: store it, and cite the stored
  document.
- Never fill a batch with facts that you are not sure of. Leave the fact out, and write it as a
  gap.
- Never write in `research/out/` a private file of the operator. Write only public addresses and
  your notes.
