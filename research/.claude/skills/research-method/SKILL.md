---
name: research-method
description: The method of a research layer in Gabriel. What a fact is, what to source and how, what never goes into Gabriel, how to build a batch that the app accepts, and what to do when a source is blocked. Read it at the start of each research session, before the first proposal.
---

# The method of a research layer

## The goal

Gabriel is a record of facts that each cite a stored source. The operator reads each proposal in
the review queue and promotes it or rejects it. Thus a good session proposes few facts, each one
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

## What you must source

Each fact cites at least one stored document, with the page and an excerpt that states each value
of the fact: the name, each attribute value, each date, each number. Copy the excerpt word for
word from the stored text (`document_text`), not from the web page that you saw.

## What never goes into Gabriel

- Your reasoning, a hypothesis, a lead, a summary, a score, a rating.
- A group or a concept that is not one entity: "European countries", "Russian oil companies",
  "financial sanctions", "the shadow fleet".
- A figure that belongs to no entity of the layer: a total of trade, a share of exports, a price.
- The metadata of a source: its authors, their e-mail addresses, the publisher, the journal, the
  institute that paid for it. An author becomes an entity only when the author is the subject.
- A person, unless a sanctions act designates the person, or a public filing names the person as
  a director, an owner or an officer. Never an address, a telephone number or an e-mail address
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
3. Find the best source of each missing fact. Store it (`find_document`, then `fetch_document`,
   or a register lookup). Read the stored text with `document_text`.
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

## A blocked source

A source can refuse a robot (a 403, a challenge page, an empty page), be gone (a 404), or not
answer (a timeout, often a state site that refuses foreign addresses). Try these, in this order,
and stop at the first that stores the full text:

1. `fetch_document` on the address. The tool renders a page with JavaScript when its text is
   short. Check that the stored text holds the content, and not a challenge or an empty page.
2. `archive_snapshot` on the address lists the captures of the web archive. It stores nothing.
   Call `fetch_document` on the address of the newest capture, and cite that document. An address
   with a query string has no capture.
3. Another official copy of the same text: the PDF of the publisher, the Publications Office of
   the EU for an EU act (`publications.europa.eu/resource/celex/<CELEX>`), a repository of the
   paper (EconStor, RePEc, SSRN), the page of the institution itself. Find it with `web_search`.
   It must be the same text from the same issuer.
4. The browser. Open the page in the browser of the session (Claude in Chrome, or the browser of
   the app). It runs on the operator's machine, with a home address and real cookies, so most
   filters let it pass. The browser downloads into its download folder, and `GAB_INBOX` in
   `research/.env` names that folder (or the operator sets the download folder of the browser to
   `research/inbox`).
   - Before you save, read the page. If it shows an account of the operator (a name, "signed
     in", a basket, a private message), do not save it: put the source on the list of needs.
   - A PDF: click its link, so that the browser downloads the file.
   - An HTML page: run this in the page with the JavaScript tool of the browser, with a file name
     of your choice:
     `const b = new Blob(['<!doctype html>\n' + document.documentElement.outerHTML], {type: 'text/html'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'name.html'; a.click();`
   - Never write the file yourself with a file tool, and never change it. The bytes must be what
     the browser held.
   - Call `store_saved_file` with the file name and the address of the page, and cite the
     document that it gives. Its title says "saved by the browser".
5. If nothing works, add the source to `research/out/needs.md`, and continue with the next fact.

Each line of `research/out/needs.md` gives what the operator needs to store it:

| Source | Address | Error | What to get | Where it is used |
|---|---|---|---|---|
| The title and the issuer | The address that failed | 403, 404, timeout, empty | The PDF, or the page saved from a browser | The node and the fact that wait for it |

The operator stores the file in Gabriel. In the next session, find it with `find_document`.

## Never

- Never propose a fact that you did not read in a stored document.
- Never cite a page that you saw in a browser or in a search result: store it, and cite the stored
  document.
- Never fill a batch with facts that you are not sure of. Leave the fact out, and write it as a
  gap.
- Never write in `research/out/` a private file of the operator. Write only public addresses and
  your notes.
