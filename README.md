# Money Never Sleeps

A small, open-source Chrome extension for working in HubSpot and LinkedIn after hours.
It follows your system appearance in real time, with manual Dark and Light overrides.

- **System by default:** already-open HubSpot and LinkedIn tabs switch when your device changes appearance.
- **One preference across tabs:** changes in the popup apply throughout the current profile.
- **Dynamic theming:** adapts HubSpot design tokens and styles, plus LinkedIn feed, profile and messaging surfaces.
- **No page inversion:** recolors CSS instead of filtering the whole page. Image files and artwork stay intact; navigation icons inherit readable text colors.
- **Local only:** no network requests, tracking, remote code, account connection or backend.
- **MIT licensed:** use it, improve it, and share it.

An independent community project. Not affiliated with or endorsed by HubSpot.

## Install

[Download the extension ZIP](https://github.com/pedropizarrojr/hubspot-dark-mode/raw/refs/heads/main/downloads/money-never-sleeps-0.2.1.zip)
and unzip it. In Chrome, open
`chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and
select the folder containing `manifest.json`. Refresh existing HubSpot and LinkedIn tabs once.

If installing from the source repository, load the **`extension`** folder.
There is no build step or dependency installation required.

See [INSTALL.md](INSTALL.md) for updates and troubleshooting, and
[PRIVACY.md](PRIVACY.md) for permissions and data handling.

## Appearance

| Mode | Behavior |
| --- | --- |
| System | Tracks Chrome's reported system preference, including automatic changes |
| Dark | Keeps the extension's dark theme enabled on both sites |
| Light | Removes the extension's dark theme and restores each site's original appearance |

The extension listens to `matchMedia('(prefers-color-scheme: dark)')` change
events in each matched tab/frame. A local storage change listener propagates
manual overrides. Resuming a hidden tab or restoring a page also rechecks the
current preference.

## How it works

Manifest V3 injects the CSS and scripts at `document_start`. The CSS provides an
early dark background and component fallbacks. The theme engine reads accessible
CSS rules and generates dark overrides under `html[data-hsdm-theme="dark"]`.
It also reads computed `--t-*` and `--trellis-*` tokens, including tokens from
cross-origin stylesheets that CSSOM cannot expose directly. Original stylesheets
and style attributes remain intact; Light mode removes the generated sheet.

A stylesheet observer handles newly loaded styles. While dark mode is active in
a visible page, a 1.5-second check detects CSS-in-JS `insertRule()` additions that
do not generate DOM mutations. Unchanged stylesheet transformations are cached.
All overrides are screen-only so printing uses the original page styles.

The manifest lists only HubSpot app hosts and LinkedIn. Additional regional hosts can be added
explicitly as needed. Embedded third-party tools on other origins are outside
the extension's access.

## LinkedIn support

The same System, Dark and Light setting controls both sites. LinkedIn's current
feed uses generated classes and cross-origin CSS, so a separate adapter reads
computed colors and applies scoped overrides in batches of up to 250 elements
per animation frame. It handles newly inserted feed cards, navigation and
messaging surfaces without relying on generated class names or reading content.
Existing dark surfaces remain dark. Switching to Light removes the extension's
overrides; LinkedIn's own saved appearance preference still applies.

LinkedIn also has a [native system appearance setting](https://www.linkedin.com/help/linkedin/answer/a524473/switch-between-dark-and-light-mode).
This extension provides a shared control for LinkedIn and HubSpot.

## Dark theme design

The default uses charcoal and slate, lighter raised surfaces, off-white text and
visible focus indicators. Curated text and control colors have automated contrast
checks. See [DESIGN.md](DESIGN.md) for the palette, rationale and primary references.

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

Requires Node.js 20+ for checks and Python 3 for packaging. There are no runtime
or development package dependencies.

```sh
npm test
npm run check
npm run package
```

The ZIP is written to `dist/money-never-sleeps-0.2.1.zip`, with `manifest.json` at
its root. Packaging uses fixed timestamps for reproducible output.

For a synthetic browser fixture, run `npm run preview` locally and visit
`http://127.0.0.1:8765/tests/fixture.html`. It uses mock storage and synthetic data;
the fixture is never packaged with the extension.

## Initial release coverage and limits

The HubSpot engine targets shared components, including CRM lists and records,
cards, tables, form controls, menus and dialogs. HubSpot tools and accounts can
use different design-system versions. This is an initial release, not a claim
that every HubSpot screen has been verified.

- CSS-in-JS rules inserted into an existing sheet can take up to 1.5 seconds to adapt.
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

## License

[MIT](LICENSE). Copyright 2026 Pedro Pizarro.
