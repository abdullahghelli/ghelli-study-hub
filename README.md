# Ghelli Study Hub

A revision site for A Level, IGCSE and GCSE: notes, flashcards, topic questions and past papers, sorted by level, subject and exam board.

It's a plain static site with no build step. It is hosted on Cloudflare Pages.

## Structure

```
index.html          page shell
assets/data.js      all content: courses, topics, file links, past papers
assets/app.js       routing, pages and search
assets/style.css    design
files/              put PDFs here (optional; links can also point to Google Drive etc.)
```

## Adding content

Everything lives in `assets/data.js`.

The site is organised as qualification → board/option → subject → topic
(GCSE includes IGCSE boards, A Level includes IAL, IB has HL and SL).

- **Topic files:** add to `files`, keyed `"level/track/subject/topicNumber"`:
  ```js
  "a-level/edexcel-ial/physics/1": {
    notes: { "Revision notes": "/files/a-level/edexcel-ial/physics/01-mechanics-notes.pdf" },
  },
  ```
- **Past papers:** add to `papers`, keyed `"level/track/subject"`, then `"Series Year|paper|QP"`:
  ```js
  "gcse/cambridge-igcse/physics": { "May/Jun 2024|2|QP": "/files/gcse/cambridge-igcse/physics/papers/p2-qp-mj24.pdf" },
  ```
- **New subject or board:** add it under the right level's `tracks` in `levels`.

Anything without a link shows as "Coming soon".

## Cloudflare Pages settings

- Framework preset: None
- Build command: (leave empty)
- Build output directory: `/`

Cloudflare Pages serves `index.html` for any path that isn't a file, so clean URLs like `/gcse/cambridge-igcse/physics` work without extra config.

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Clean URLs need a server with SPA fallback; for quick checks the home page and in-site navigation work fine.
