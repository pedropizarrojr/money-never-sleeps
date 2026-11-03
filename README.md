# Money Never Sleeps

A small, open-source Chrome extension for working in HubSpot, LinkedIn, Google Drive,
Google Docs, Google Sheets and Google Calendar after hours.
It follows your system appearance in real time, with manual Dark and Light overrides.

- **System by default:** already-open supported tabs switch when your device changes appearance.
- **One preference across tabs:** changes in the popup apply throughout the current profile.
- **Dynamic theming:** adapts HubSpot design tokens and styles, plus LinkedIn feed, profile and messaging surfaces.
- **Warm gray across apps:** Google uses static CSS, with no page scans, polling or scroll handlers.
- **Document controls:** optional filters darken Docs pages and Sheets grids without editing file contents. Turn off **Dark document pages** when checking original image, chart or cell colors.
- **Media stays intact outside the editor canvas:** HubSpot, LinkedIn and Drive images are not inverted. Navigation icons inherit readable text colors.
- **Automatic visual fixes:** downloaded appearance rules are cached locally. Checks run only in dark mode and can be disabled.
- **No tracking or account connection:** no page data is sent to GitHub. No downloaded JavaScript or backend is needed.
- **MIT licensed:** use it, improve it, and share it.

An independent community project. Not affiliated with or endorsed by HubSpot, LinkedIn or Google.

## Install

[Download the extension ZIP](https://github.com/pedropizarrojr/money-never-sleeps/raw/refs/heads/main/downloads/money-never-sleeps-0.5.0-linkedin-fix.zip)
and unzip it. In Chrome, open
`chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and
select the folder containing `manifest.json`. Refresh existing supported tabs once.

If installing from the source repository, load the **`extension`** folder.
There is no build step or dependency installation required.

See [INSTALL.md](INSTALL.md) for updates and troubleshooting, and
[PRIVACY.md](PRIVACY.md) for permissions and data handling.

## Appearance

| Mode | Behavior |
| --- | --- |
| System | Tracks Chrome's reported system preference, including automatic changes |
| Dark | Keeps the extension's dark theme enabled on supported apps |
| Light | Removes the extension's dark theme and restores each site's original appearance |

The extension listens to `matchMedia('(prefers-color-scheme: dark)')` change
events in each matched tab/frame. A local storage change listener propagates
manual overrides. Resuming a hidden tab or restoring a page also rechecks the
current preference.

In Light mode, or System while the OS is light, the theme engines are stopped:
no engine observers, polling timers, queued animation frames or stylesheet
generation remain active. A saved Light override is read before an engine can
start. Returning to a light tab does not run cleanup scans. Manual overrides
detach the OS-change listener; System retains it so it can turn dark mode on
when needed. Small startup/script/CSS parsing costs and idle appearance listeners
remain, so this is not a claim of literally zero browser overhead.

## How it works

### Automatic theme updates

Install 0.5.0 once to enable automatic colors and CSS fixes. The extension checks
this repository's validated theme channel daily while a supported page is visible
and dark. It applies cached rules without waiting for GitHub, shares downloads
across tabs, and stops update timers and downloads in light mode. No page reloads
or desktop helper are used. The popup has an off switch and a manual check button.

JavaScript, permissions, new site access and pre-paint fallback changes still need
a manual extension update. Only the supported appearance rules from the CSS files
update automatically. See [automatic update publishing and limits](docs/automatic-updates.md)
and [privacy](PRIVACY.md) for the GitHub request and local cache details.

### Page styling

Manifest V3 injects the CSS and scripts at `document_start`. The CSS provides an
early dark background and component fallbacks. The theme engine reads accessible
CSS rules and generates dark overrides under `html[data-hsdm-theme="dark"]`.
It also reads computed `--t-*` and `--trellis-*` tokens, including tokens from
cross-origin stylesheets that CSSOM cannot expose directly. Original stylesheets
and style attributes remain intact; Light mode removes the generated sheet.

A stylesheet observer handles newly loaded styles. While dark mode is active in
a visible page, a lightweight 250 ms rule-count check detects CSS-in-JS `insertRule()` additions that
do not generate DOM mutations. HubSpot work is coalesced to animation frames,
with at least 100 ms between refreshes. Image loads and unchanged inline colors
do not trigger refreshes. Unchanged stylesheet transformations are cached.
All overrides are screen-only so printing uses the original page styles.

The manifest lists HubSpot app hosts, LinkedIn, Drive, Calendar, and the Docs/Sheets
paths on docs.google.com. It does not request all-google.com access. LinkedIn-origin fallback
also covers related about:blank, blob and data frames created by LinkedIn, such as
embedded ad panels. In dark mode, the iframe element also receives `color-scheme: dark`,
so Chrome reports the correct appearance to the frame's System mode listener.
Additional regional hosts can be added
explicitly as needed. Open shadow-root messaging widgets receive their own stylesheets and observers.
Embedded third-party tools on other origins are outside
the extension's access.

## Google Workspace support

Drive, Docs, Sheets and Calendar share the extension's System/Dark/Light preference.
Google gets a dedicated static stylesheet and the small appearance controller,
without loading either HubSpot's or LinkedIn's scanning engine. CSS covers new
components as they appear. No stylesheet observers, polling, color reads or
scroll handlers run on Google. A one-time bootstrap observer is used only if
Chrome starts the content script before the HTML root exists.

Drive and Calendar use Google's Material color variables with warm gray overrides,
including RGB variants for hover/alpha styles. Docs and Sheets also receive
targeted toolbar, menu, dialog, sidebar, formula-bar and tab styles.

Docs and Sheets paint their content into canvases. **Dark document pages** is on
by default and applies a filter only to Docs page tiles and Sheets grids. Text,
images, chart colors and colored cells inside those canvases can look different.
Uncheck it to preserve the source colors while retaining dark toolbars. The
extension never changes a document's page color, formatting, cell values or
saved contents, and its rules are screen-only. Filters add browser compositing
work; real load/scroll overhead has not yet been measured. There is no verified
100–200 ms latency claim.

Drive and Calendar also offer native dark modes. This extension adds the shared
warm gray treatment without changing those account settings. Gmail, Slides,
Forms, Meet, embedded third-party viewers and Google sign-in pages are outside
this release's coverage. See [Google browser QA and limits](docs/google-qa-0.4.0.md).

## LinkedIn support

The shared System, Dark and Light setting controls LinkedIn. CSS supplies the
baseline for common surfaces, text, controls, ads and messaging. A bounded adapter
can enhance newly inserted elements once. It reads colors in a batch, then assigns
shared style rules, without disabling the theme or rebuilding the whole stylesheet.

LinkedIn enhancement uses lazy traversal, at most 40 visited elements per animation
frame, a target 3 ms work slice and a 100 ms cumulative work budget per document.
After the budget, CSS and the known chat-widget fallback remain active. There are
no scroll, mouse-move or hover listeners, no stylesheet polling and no automatic
page reloads. Class changes, removals and stylesheet churn do not restart scans.
Manual Light removes the overrides; the site's own appearance preference still applies.

These budgets bound the enhancement task, not end-to-end browser latency. A single
browser style operation can exceed a slice, and browser CSS matching/painting costs
are separate. Unusual late components may need explicit CSS coverage rather than
unlimited recoloring. See [performance notes](docs/performance-0.3.4.md).
LinkedIn also has a [native system appearance setting](https://www.linkedin.com/help/linkedin/answer/a524473/switch-between-dark-and-light-mode).
This extension provides a shared control for LinkedIn and HubSpot.

## Dark theme design

The default uses warm charcoal and layered grays, lighter raised surfaces, off-white text and
visible focus indicators. Curated text and control colors have automated contrast
checks. See [DESIGN.md](DESIGN.md) for the palette, rationale and primary references.

## Version 0.5.0

The current download includes the [LinkedIn first-load and contrast fix](docs/linkedin-first-load-fix.md).
Existing 0.5.0 installations can receive it through **Check for theme updates**
while dark mode and automatic theme updates are enabled. The extension base
version stays 0.5.0 because this patch changes supported CSS only.

- Added cached, automatic theme-rule updates from the project's fixed GitHub channel.
- Added a popup off switch, check button and theme/extension version status.
- Restricted remote data to screen-only, dark-scoped appearance rules. No downloaded JavaScript, resource URLs or layout changes.
- Stopped update work in light mode, paused hidden-page scheduling and limited downloads to one daily check across tabs.
- Added a GitHub Actions publisher for validated CSS updates, plus failure, cancellation, scope and cache regression tests.

## Version 0.4.1

- Wait for the saved mode before starting theme work, including Light on a dark OS.
- Make engine start/stop operations transition-only and remove light-mode refresh calls.
- Avoid repeated HubSpot cleanup queries and release generated CSS caches on stop.
- Verify timer/observer/frame cancellation and zero engine work during repeated idle/light events.
- Fix the bright formula-bar wrapper found during live Sheets inspection.

See [installed-version QA and performance limits](docs/qa-0.4.1/README.md).

## Version 0.4.0

- Added Drive, Docs, Sheets and Calendar to the same plugin and appearance control.
- Used static CSS and explicit Google site access without a scanning engine.
- Added a persistent switch for dark document canvases versus original source colors.
- Refined Docs menu-label contrast and avoided double inversion of Sheets cell editors.
- Added Google appearance, migration/race and contrast regression checks.

## Version 0.3.4

- Replaced LinkedIn's repeated document scans and per-element CSS rebuilding with bounded, incremental enhancement.
- Grouped identical colors into shared rules and separated style reads from DOM writes.
- Stopped rescanning for removals, hover/layout changes and stylesheet churn.
- Added CSS-first fallbacks and retained automatic System/Dark/Light behavior.
- Made HubSpot ignore image loads and layout-only updates; coalesced real work outside page microtasks.
- Added performance regression tests and a reproducible operation benchmark.

## Version 0.3.3

- Rescan LinkedIn after late stylesheets and CSS-in-JS rules arrive.
- Restore theme markers if page hydration removes them, without an observer loop.
- Improve filter-label and messaging-action icon contrast.
- Fix HubSpot pseudo-element selectors, including white loading shimmer.
- Match HubSpot popover pointers to the raised warm-gray surface.

See [live QA notes](docs/qa-0.3.3/README.md) for browser observations and verification limits.

## Version 0.3.2

- Fixed LinkedIn ad frames detecting System mode as light while the page is dark.
- Overrode LinkedIn's light iframe color scheme so frame media queries follow the dark parent.
- Preserved ad images and logos, with no inversion or additional permissions.

## Version 0.3.1

- Added early HubSpot table styling to prevent white loading rows.
- Moved the first LinkedIn styling batch into the current pre-paint microtask.
- Deduplicated nested DOM scans and prioritized newly inserted content.
- Replaced unconditional stylesheet refreshes with lightweight rule-count checks.
- Styled LinkedIn-created blank/blob ad frames without requesting unrelated hosts.
- Made messaging header controls and close icons explicitly white.

## Version 0.3.0

- Matched the warm-gray direction of GTM Sage.
- Fixed LinkedIn messaging in open shadow roots, including late-loaded chats.
- Strengthened separators, card outlines and profile-photo boundaries.
- Added the laser-eye headshot icon.

## Version 0.2.1

- Renamed the extension to **Money Never Sleeps**.
- Dark mode for your GTM stack.

## Version 0.2.0

- Added LinkedIn support under the same appearance control.
- Replaced near-black defaults with a softer, layered charcoal/slate palette.
- Unified the full HubSpot sidebar background, including empty space.
- Added explicit navigation hover and active states.
- Darkened neutral gradient fades and bright shadows without recoloring image files.
- Expanded the extension from a HubSpot tool into a GTM tool.

## Development

Requires Chrome 119+, Node.js 20+ for checks and Python 3 for packaging. There are no runtime
or development package dependencies.

```sh
npm test
npm run check
npm run package
```

The ZIP is written to `dist/money-never-sleeps-0.5.0.zip`, with `manifest.json` at
its root. Packaging uses fixed timestamps for reproducible output.

For a synthetic browser fixture, run `npm run preview` locally and visit
`http://127.0.0.1:8765/tests/fixture.html`. It uses mock storage and synthetic data;
the fixture is never packaged with the extension.

## Initial release coverage and limits

The HubSpot engine targets shared components, including CRM lists and records,
cards, tables, form controls, menus and dialogs. HubSpot tools and accounts can
use different design-system versions. This is an initial release, not a claim
that every HubSpot screen has been verified.

- CSS-in-JS rules inserted into an existing sheet can take up to 250 ms to adapt; common HubSpot tables have static early styling.
- Inaccessible external CSS uses shared token overrides and component fallbacks.
- Inline declarations marked `!important`, closed shadow roots, pseudo-elements,
  canvas charts and third-party frames may need additional handling.
- SVG fills and chart palette tokens are intentionally preserved. Check chart
  labels and unusual branded surfaces in the tools you use.
- HubSpot may change its styles. Report affected components so fixes can be added.
- Browser-managed preference overrides can differ from the OS setting.
- A brief initial adjustment may occur while the saved manual setting loads.

See [CONTRIBUTING.md](CONTRIBUTING.md) for a manual verification checklist.

LinkedIn coverage still needs live visual verification across all account layouts.
Early CSS and pre-paint scheduling reduce light flashes; browser navigation
backgrounds, inaccessible external frames and image pixels can still be light.

## License

[MIT](LICENSE). Copyright 2026 Pedro Pizarro.
