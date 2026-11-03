# Automatic appearance updates

Version 0.5.0 adds an updater inside the extension. It updates supported CSS rules,
not the installed extension package. No desktop application is required.

## Publish a visual fix

1. Change `extension/theme.css`, `hubspot.css`, `linkedin.css` or `google.css` on a branch.
2. Run `npm test`, `npm run check` and `npm run theme:build`.
3. Merge the change into `main`. The **Publish automatic theme updates** workflow
   runs the same checks and builds declarative appearance data from those files.
4. The workflow commits only `updates/latest.json` to the separate `theme-updates`
   branch. That branch contains no workflow, so publication does not trigger a loop.
5. Installed 0.5.0 clients fetch that fixed file during their next eligible check.
   A push publishes a new theme; it does not instantly push into Chrome.

The publisher uses the repository's `GITHUB_TOKEN` with `contents: write` in that
job. It needs no third-party service, API secret or billing account. Repository
rules must permit that workflow to create/update the `theme-updates` branch. A
manual `workflow_dispatch` is also available. Older runs skip publication if
`main` has advanced. Publish permissions are not granted to PR workflows.

## What updates automatically

The builder extracts flat `@media screen` rules from the four page stylesheets.
Each selector must start with `html[data-hsdm-theme="dark"]`. Allowed declarations
cover color, neutral surfaces, borders, outlines, shadows, opacity, fixed visual
filters and known color-token prefixes. Every downloaded packet is checked by the
same packaged validator in the worker and in the page before it becomes CSS.

There are limits on packet bytes, rule counts, selectors and declarations. CSS
escapes, imports, resource URLs, dynamic values, `:has()`, arbitrary at-rules and
layout properties are rejected. No downloaded JavaScript is interpreted. Invalid
changes fail the publisher checks rather than expanding updater capabilities.
Changing the allowed schema or adding another property requires a packaged update.

The following do not update automatically: JS engine behavior, theme values
embedded in JS, permissions, supported website hosts, popup styling, pre-paint
fallback CSS, new updater features and the extension version. These require a
normal manual unpacked-extension update. The first 0.5.0 installation is also manual.

## Loading and scheduling

The normal packaged theme starts independently of the updater. Only after the
saved appearance setting confirms dark mode does the updater read its local cache.
The cached rules apply asynchronously in one owned stylesheet per document or known
LinkedIn chat shadow root. There are no update observers, page scans, scroll handlers,
page reloads, alarms or intervals.

Each visible dark top-level page can schedule one timeout. Hidden pages clear it;
iframes use cached styles without scheduling requests. One event-driven service
worker deduplicates requests across tabs and persists the daily deadline. The worker
has no startup request and sleeps when not handling a message. Each download times
out after five seconds, omits credentials/referrers and rejects redirects. Failed
requests can retry after six hours. Manual popup checks have a one-minute minimum.

Light mode removes downloaded styles, cancels update timeouts, detaches updater
storage listeners and cancels an in-flight request. The small existing appearance
listeners remain so System can turn dark mode back on. This does not mean literally
zero extension parsing/startup cost. There is no measured browser-latency guarantee.

## Compatibility and fallback

A packet identifies its schema, exact base extension version, increasing revision
(publication timestamp in milliseconds) and appearance rules for the three adapters.
Only compatible packets replace the cache. Older revisions cannot replace newer
ones. Network and validation failures retain the last working cache. Turning updates
off removes it from the page and uses the bundled theme. Cached data remains local.

To roll back a visual regression, revert the CSS commit and let the publisher
create a new, higher revision containing the previous rules. Do not lower the revision.
When publishing a new full extension version, the channel is rebuilt for that version;
older installations keep their last compatible cached rules until manually upgraded.

## Verification

Automated checks cover the real CSS-to-data builder, dark-only scoping, resource and
layout rejection, body-size limits, shared downloads, persisted throttling, malformed
and incompatible packets, cancellation, cache races, shadow roots and Light-mode
cleanup. They use synthetic DOM/network harnesses and do not measure Chrome load or
scroll latency. Live installation and end-to-end validation in Chrome remain a
separate check; no private CRM, document or messaging screenshots are published.

## Distribution and terms

This feature does not make a developer-mode extension a Chrome Web Store package,
and does not resolve the supported websites' terms restrictions. In particular,
[LinkedIn's agreement, section 8.2(15)](https://na.linkedin.com/legal/user-agreement)
restricts modifying the service's appearance. No Web Store submission is made here.
Chrome's [remote-code documentation](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)
distinguishes CSS/JSON data from executable code. Its
[distribution documentation](https://developer.chrome.com/docs/extensions/how-to/distribute)
describes the supported full-package update mechanisms. See [Privacy](../PRIVACY.md)
for the fixed GitHub endpoint, local storage and request metadata disclosure.
