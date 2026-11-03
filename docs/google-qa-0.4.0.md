# Google Workspace 0.4.0 verification

Date: November 3, 2026. This is a candid record of what was and was not tested.

## Live browser inspection

Opened Google Drive Home, an existing Google Doc, an existing Google Sheet and
Google Calendar week view in the connected Chrome Inworld profile. Inspected
the rendered DOM and computed colors without modifying file contents or account
appearance settings. No private document text, file identifiers or screenshots
are included in this repository.

- Drive defines Material 3 theme variables on `body`, rather than the HTML root.
  The stylesheet therefore overrides both root and body, including RGB variants.
- Calendar uses the same Material variables plus a few Calendar-specific neutral
  surface/scrollbar tokens. Event fill/text and inline calendar colors are left
  to the application.
- Docs uses `.kix-canvas-tile-content` canvases inside `.kix-page-paginated`, with
  separate HTML toolbars. The File menu's `.docs-menubar .goog-control` label has
  an explicit dark foreground. Added a specific foreground rule after observing
  that inherited toolbar text alone would not cover it.
- Sheets uses `.grid-container` with canvas, separate row/column-header backgrounds,
  and overlays. Filtering the complete grid avoids mismatched light headers.
  Added light source colors for active cell editors *inside* the filtered grid
  to prevent dark styles being inverted a second time. Formula-bar controls
  outside that grid use the normal dark control colors.

## Verification limits

The Google support version was **not installed or visually verified after being
applied to the live apps** in this session. The browser security policy blocks
the Chrome extension manager. Raw DevTools access was declined, preventing a
temporary live CSS preview. An independent synthetic-browser preview was also
blocked by the saved DevTools permission; a local HTTP test server could not bind
under the shell sandbox. These are limits, not successful browser tests.

No claim is made that the Google theme meets a 100–200 ms loading budget.
There are no Google scanning engines, periodic timers or scroll listeners, but
CSS matching and canvas filter compositing still consume browser resources.
Large documents/sheets need a real Chrome comparison. The canvas option allows
that compositing filter to be removed without disabling the interface theme.

## Automated checks

- OS light/dark changes and manual overrides on all four Google routes.
- No scanning engine, timers, element queries or computed-style APIs are supplied
  to the Google controller test; appearance changes still work.
- Existing saved mode migrates without a reset. Canvas and mode settings cannot
  overwrite newer independent changes during a slow initial storage read.
- Google access is limited to Drive, Calendar and Docs/Sheets paths. The Google
  bundle contains only the palette helpers, appearance controller and static CSS.
- Neutral/selected-surface text contrast, syntax, resources and network-free
  source checks. Existing HubSpot and LinkedIn regression tests remain included.
- CSS guards check balanced blocks/strings, screen media, appearance scope and
  absence of external resources. They do not replace a browser CSS parser.

An independent synthetic component fixture is provided at
`tests/google-fixture.html`. From the repository, run `npm run preview`, open
`http://127.0.0.1:8765/tests/google-fixture.html`, and exercise each app, mode,
document-color switch and menu. **Check current view** reports computed-style
checks. This fixture was created but could not be browser-run in this session.

## Completing live verification

Replace the contents of the existing unpacked extension folder with 0.4.0, reload
it in Chrome's extension manager, accept the additional Google site access, and
refresh the four apps once. Then perform the Google checks in CONTRIBUTING.md.
An enabled/disabled Chrome trace is required before reporting added latency.

Google's own native-theme references:

- https://support.google.com/drive/answer/9962935?co=GENIE.Platform%3DDesktop&hl=en
- https://support.google.com/calendar/answer/15240542?hl=en
