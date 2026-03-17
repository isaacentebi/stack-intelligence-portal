# Slide Components

Each slide lives as a React component with its data in `lib/data/slides/*`.

Planned naming:
- `01-title.tsx`
- `02-allocation.tsx`
- `...`
- `61-underwrite.tsx`

Migration rule:
1. Preserve text and chart behavior first.
2. Extract reusable styles second.
3. Replace ad hoc chart configs with chart wrappers last.
4. Do not use `.module.css` for slide styling in this repo.
5. Put slide CSS in `app/globals.css` using unique prefixed classes.
