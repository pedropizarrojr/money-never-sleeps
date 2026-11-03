# Performance redesign: 0.3.4

The previous LinkedIn adapter could repeatedly scan a large document, disable all
of its stylesheets, interleave computed-style reads with attribute writes, and
rewrite a growing stylesheet for each batch. Even a removal could cause a fresh
whole-document scan. The extension did not call page reload, but this work could
block the main thread and navigation.

## New behavior

- CSS supplies the initial common-component theme.
- Only newly inserted elements are considered for computed-color enhancement.
- Lazy TreeWalker traversal avoids collecting the entire document into arrays.
- Work yields through animation frames, with a target 3 ms slice and at most
  40 visited elements per frame.
- A 100 ms cumulative work budget stops further enhancement on that document.
  It is not reset on visibility changes or SPA route changes.
- Identical declarations share one CSS rule. Existing rules are retained;
  adding a card does not rebuild the stylesheet.
- All color reads finish before rule/attribute writes. The theme is never
  globally disabled to measure an element.
- Removed elements and class/layout/stylesheet changes do not restart scans.
- Weak element bookkeeping and a 256-rule limit per root bound retained state.
- Chat's known open shadow root receives static styling even after the budget.
- No scroll, mousemove or hover listeners, page reloads, network or new permissions.

HubSpot retains cached source-rule/token transformation. Its refreshes now yield
to an animation frame and are coalesced at least 100 ms apart. Image loads,
layout-only inline changes and unchanged colors no longer schedule rebuilds.
This is a throttle, not a 100 ms total-work cap for HubSpot.

## Reproducible operation benchmark

Use `npm run benchmark`. Optionally pass the previous `linkedin.js` path directly
to `node scripts/benchmark.cjs PATH` to compare the same fixture. Results below
use 2,000 synthetic elements with identical colors, plus the HTML root.

| Operation | 0.3.3 | 0.3.4 |
| --- | ---: | ---: |
| Initial computed-style reads | 2,001 | 2,001 |
| Reads after a DOM write in the same batch | 1,993 | 0 |
| CSS bytes written during initial work | 2,257,941 | 1,177 |
| New card: computed-style reads | 1 | 1 |
| New card: CSS bytes rewritten | 411,161 | 0 |
| Remove one element: computed-style reads | 2,001 | 0 |
| Remove one element: CSS bytes rewritten | 410,961 | 0 |

These are mock-DOM operation counts, not Chrome load-time measurements. They
exclude real CSS matching, layout, paint, network and site application work.
The per-frame and document-budget tests use a deterministic simulated clock.
They verify scheduling and cutoff behavior, not a hardware timing guarantee.

## Verification and limits

41 automated tests pass, including phase separation, shared rules, incremental
updates, removal/stylesheet churn, budget cutoff, late chat styling, HubSpot
image/layout-event suppression, cancellation and system appearance propagation.
Syntax/manifest and packaging checks pass.

The existing LinkedIn tab timed out during attempted inspection; HubSpot was
reachable. The installed unpacked extension must be updated/reloaded before a
controlled Chrome comparison can validate the user's target of 100–200 ms added
navigation latency. That target has not yet been verified. Do not infer it from
unit-test runtime or the 100 ms enhancement-task budget.

The bounded design trades unrestricted recoloring for responsiveness. Unusual
late-loaded components can require an explicit CSS rule after the budget is used.
The curated text/control contrast tests do not establish site-wide accessibility.
