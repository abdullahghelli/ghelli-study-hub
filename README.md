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

- **Topic files:** add to `files`, keyed `"level/subject/board/topicNumber"`:
  ```js
  "a-level/physics/edexcel/2": {
    notes: { "Revision notes": "/files/a-level/physics/edexcel/02-mechanics-notes.pdf" },
  },
  ```
- **Past papers:** add to `papers`, keyed `"level/subject/board"`, then `"Series Year|paper|QP"`:
  ```js
  "a-level/physics/edexcel": { "June 2024|1|QP": "/files/a-level/physics/edexcel/papers/p1-qp-jun24.pdf" },
  ```
- **New subject or board:** add it under `courses`.

Anything without a link shows as "Coming soon".

## Cloudflare Pages settings

- Framework preset: None
- Build command: (leave empty)
- Build output directory: `/`

Cloudflare Pages serves `index.html` for any path that isn't a file, so clean URLs like `/a-level/physics/edexcel` work without extra config.

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Clean URLs need a server with SPA fallback; for quick checks the home page and in-site navigation work fine.
