# Lineage of the Boy Scout Rule

Primary-source trail from the scouting movement to the software practice.
Cite these when someone asks "whose rule is this, actually?"

## Baden-Powell (1941)

Robert Baden-Powell, founder of the Scout Movement, died on 8 January 1941.
A farewell letter was found among his papers after his death — sealed in an
envelope inscribed "to the Boy Scouts", inside another marked "In the event
of my death" that he habitually carried while travelling. The operative
sentence:

> "Try and leave this world a little better than you found it, and when
> your turn comes to die you can die happy in the feeling that at any rate
> you have not wasted your time but have done your best."

Signed "Your friend, Baden-Powell of Gilwell."

- Full public-domain text: <https://en.wikisource.org/wiki/Last_message_to_scouts>
- Scouting-organization transcription:
  <https://scouts.com.au/about/what-is-scouting/history/bps-last-message/>
  (minor punctuation variance between transcriptions; substantively identical)

## Robert C. Martin — Clean Code, Chapter 1 (2008)

The first codification in software. From the publisher's official excerpt
(InformIT):

- "It's not enough to write the code well. The code has to be kept clean
  over time."
- The adage appears as "**Leave the campground cleaner than you found
  it**", attributed to the Boy Scouts of America. The word "Always" does
  **not** appear in the Clean Code text — cite the "Always…" variant to the
  2010 essay below.
- The core claim: "If we all checked-in our code a little cleaner than when
  we checked it out, the code simply could not rot."
- Suggested scale — deliberately tiny: change one variable name for the
  better, split one big function into two, eliminate one small duplication,
  clean up one compound conditional. (Note how naturally these examples sit
  inside this skill's three gates, and how far they are from a refactor.)
- Closing: "Can you imagine working on a project where the code simply got
  better as time passed?"

Source: <https://www.informit.com/articles/article.aspx?p=1235624&seqNum=6>

## Robert C. Martin — "The Boy Scout Rule" essay (2010)

Chapter 8 of *97 Things Every Programmer Should Know* (O'Reilly, 2010, ed.
Kevlin Henney) — the expanded standalone version, and the actual home of
the popular wording:

> "THE BOY SCOUTS HAVE A RULE: 'Always leave the campground cleaner than
> you found it.'"

Source: <https://www.oreilly.com/library/view/97-things-every/9780596809515/ch08.html>

### What *not* to cite

Two commonly repeated attributions did not check out under research and
should not appear in this repo's artifacts:

- An "it's not your mother's responsibility" passage — not present in the
  InformIT excerpt of Clean Code Ch. 1; almost certainly apocryphal.
- A Paul Irish / jQuery style-guide origin for "leave the codebase better
  than you found it" — jQuery's style guide contains no such passage.
  The phrase is real but diffuse across OSS contributing guides.

## Terminology drift

- **Scouting America rebrand (2025).** The Boy Scouts of America announced
  a rebrand to *Scouting America* effective 8 February 2025 (its 115th
  anniversary); the legal corporate name remains "Boy Scouts of America"
  (the change is a DBA). The software-term rename, by contrast, is organic,
  not mandated: no major style guide requires it.
- **"Scout Rule"** — e.g. Ben Halpern, "The Boy Scout Rule is Now the Scout
  Rule" (dev.to, after the 2017 admission of girls): when the organization's
  name changed in common usage, so could the rule's.
  <https://dev.to/ben/the-boy-scout-rule-is-now-the-scout-rule-420g>
- **"Campsite rule"** — used interchangeably; also borrowed for engineering
  management contexts (Jade Rubick, "The Campsite Rule":
  <https://www.rubick.com/campsite-rule/>).
- Current usage still overwhelmingly says "Boy Scout Rule" (e.g. DevIQ's
  principles catalog: <https://deviq.com/principles/boy-scout-rule/>).

**Pedantry guard:** the Scout *motto* is "Be Prepared" — the campground
line is a guideline, not the motto. Don't conflate them in prose.

This skill keeps the historical name for searchability and aliases the rest.
