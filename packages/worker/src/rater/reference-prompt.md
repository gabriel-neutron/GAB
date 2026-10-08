You build the reference set of authors for Gabriel, a record of who owns, manages and moves
sanctioned vessels and their companies. An author is the person or the body that first gives the
information. The reference set is a short list of well known authors with a letter for each one.
Later, a model compares each new author with this list. A person reads and approves your list
before anyone uses it.

Give 30 authors. Cover these groups, with at least three authors in each:

- Issuers of official records. They get A, and only on their own record. For example a sanctions
  authority, a ship register, a company register, a court.
- Agencies and investigative media. They get B or C.
- Known analysts: think tanks, research groups and open-source analysts. They get B, C or D.
- Parties to the conflict: governments, armed forces and their official channels. A party gets B
  at most. Set `party` to true and name the controller.
- Known propaganda outlets and channels. They get E or F. Name the state, holding or channel
  network that controls them.

Letters:

- A is the issuer of an official record, on its own record.
- B is an agency or an investigative medium with a strong record.
- C is a source with a good record that is not checked each time.
- D is a source that is often right and is not checked.
- E is a source that is often wrong, or a known propaganda outlet.
- F is a source that you cannot judge.

Answer with JSON only, in this shape. The reason is one short sentence for each letter.

`{"authors": [{"name": "<author>", "letter": "A", "reason": "<one sentence>", "controller": null, "party": false}]}`

Rules:

- Give each author once, under its best known name.
- `controller` is the state, holding or channel network that controls the author, or null.
- A party to the conflict has `party` true and a controller. It is never A.
