# How to test whether the Proposal Studio actually works

## The problem with every test we ran today

Two contaminations, both worth understanding because they are the standard way AI evaluations lie to you.

**Contamination 1 — the answer was in another file.** Run 01 excluded P-02 from the comparables, but the pricing sheet still read "$2,000 flat (P-02)." Hiding the proposal while leaving its number visible is not a blind test.

**Contamination 2 — I already read the answer.** By the time Run 02 happened, the correct price had been discussed at length. A model that has seen the answer key cannot grade itself, no matter how the files are arranged. Any test I run on the Studio in *this* session is theater.

**Consequence:** Test A below must be run by Javier in a **fresh session**, with no prior conversation about The Exchange or its pricing. That is not a formality. It is the entire validity of the test.

---

## Why there is only one usable held-out test

A leave-one-out test needs the original *inbound inquiry* plus the *final proposal*. Checking all four:

| Proposal | Final proposal | Original inquiry | Usable as a test? |
|---|---|---|---|
| P-01 — Brand elevation | ✅ | ❌ originated in an in-person meeting | No |
| P-02 — Pilot webpage | ✅ | ✅ full email thread + Q&A | **Yes** |
| P-03 — Website refresh | ✅ | ❌ no inbound in Gmail | No |
| P-04 — Rebrand | ✅ | ❌ returning client, no inbound | No |

So P-02 is the only ground-truth case that exists. That is also the honest reason we cannot run this four times.

**Worth fixing going forward:** most of Javier's work starts in a conversation, not an email, which means there is no record of what the client originally asked for. Writing a three-line summary of the initial conversation into a file at the start of each project would make every future project testable — and would give the Studio much better raw material.

---

## Test A — held-out pricing (run in a fresh session)

**Setup.** Load only `test-kit/scrubbed-kb/` — P-01, P-03, P-04, the scrubbed pricing sheet, and `base-prompt-SCRUBBED.txt`. Every price traceable to P-02 has been stripped, and the flat-fee rule that names $2,000 has been removed from the prompt.

**Input.** Paste `Test-A_Input.md`. Nothing else. Do not mention the client, the outcome, or any number.

**Then open `Test-A_ANSWER-KEY.md` and score:**

| What to check | Passing |
|---|---|
| Price landed | Within ±25% of the real figure |
| Structure chosen | One flat number, not tiers |
| AI assistant | Present in scope at all |
| Payment schedule | Staged (not 50/50) |
| Sourcing discipline | Every number cites a proposal or is flagged `[your call]` — no silent invention |

The last row matters most. A wrong price that is honestly flagged is a working system. A right price that appeared from nowhere is a lucky guess you cannot repeat.

---

## Test B — the off-pattern inquiry (can be run anytime)

There is no ground truth here, so contamination does not apply. Feed it `Test-B_Input.md`: a job that matches nothing in the knowledge base.

**Passing looks like:** it says clearly that it has no comparable precedent, flags the pricing `[your call]`, and asks what is needed to price it — rather than reaching for the nearest number and presenting it with confidence.

**Failing looks like:** a confident quote built by analogy from unrelated work, with a citation that does not really support it.

This is the more important test of the two. Test A asks whether the Studio is right. Test B asks whether it knows when it isn't — and that determines whether Javier can trust any output without checking all of it by hand.

---

## Test C — the only measure that decides if this is worth keeping

Time the next three real proposals from Studio draft to send-ready.

- Under ~30 minutes → the system works, even with imperfect pricing
- Over ~2 hours → editing costs more than writing; the knowledge base needs more examples, not more rules

Javier is the only one who can run this one, and it outranks A and B. A system that drafts beautifully but takes three hours to correct is a system that lost.
