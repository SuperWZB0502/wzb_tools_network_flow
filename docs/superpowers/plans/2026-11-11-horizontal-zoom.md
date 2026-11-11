# Horizontal zoom, frozen headers and GitHub delivery

User requirements: W/S scale only horizontal timeline geometry; glyphs keep size, centered until text no longer fits, then left-align with right ellipsis. Hold W/S to accelerate from slow to fast; use mouse position as zoom anchor. Lane labels stay fixed and narrower; timeline is clipped at their divider on horizontal scroll. Initial document has one node per lane and dependencies compute → copy → communication. Lane grips use grab/grabbing cursors. After implementation, create a new GitHub repository following the referenced 5D project and deploy using GitHub Pages.

Implementation decisions:
- Project horizontal time into SVG scene geometry instead of stretching the entire SVG. Model coordinates and saved data remain unchanged.
- Fixed 112px lane label area (before ordinary whole-page zoom), with frozen root labels and clip boundary. Subprocess labels use the same fixed width.
- Preserve explicit line breaks; no automatic wrap as W/S shrink a component. Truncate at the right, preserving original text in data and tooltip.
- Mouse anchored horizontal scaling, with a gradual capped logarithmic rate while held. Inputs retain normal typing.
- Starter diagram is used when no autosave exists. Blank documents and subflows remain available, and existing user drawings are restored.
- GitHub Pages publishes dist/ via Actions; keep the reference repository unchanged. New repository will contain app source, tests, docs and open-source notices.

- [ ] Add failing layout/text/acceleration and browser regressions.
- [ ] Implement geometry-based scaling, text fitting, mouse anchoring, frozen narrow headers and clipping.
- [ ] Add default starter and hand cursors; run complete suite and inspect visual output.
- [ ] Create new GitHub repository, push verified source, enable Pages and verify the exact deployed commit.
