# Privacy

Money Never Sleeps themes pages locally. It includes no analytics, tracking or
remotely downloaded JavaScript. Automatic theme updates are enabled by default
and can be turned off in the popup.

While a visible supported page is in dark mode, the updater checks a fixed public
file in this project's GitHub repository at most once every 24 hours. Failed checks
can retry after six hours. The popup also has a rate-limited manual check button.
Checks stop in Light mode, when System follows a light OS, or when updates are off.
Hidden pages do not schedule checks. Downloads never block page rendering.

The update request downloads appearance data from
`https://raw.githubusercontent.com/pedropizarrojr/money-never-sleeps/theme-updates/updates/latest.json`.
It sends no page URL, page contents, cookies, credentials, saved preference or
unique extension-generated identifier. GitHub receives normal connection information,
including the client's IP address and browser/network request metadata, under
[GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).
Requests omit credentials and referrers and do not follow redirects.

The updater accepts only bounded, dark-scoped appearance rules. It rejects scripts,
external images/fonts/imports, layout properties and incompatible extension versions.
It does not install extension code, change permissions or reload pages. Turning
updates off removes downloaded rules and restores the bundled theme. Failed checks
keep the last working cache.

The extension inspects CSS rules, computed HubSpot theme variables, and inline
style declarations to generate a dark stylesheet. On LinkedIn it also reads computed element colors because the site uses generated
classes and cross-origin CSS. Open shadow roots used by LinkedIn messaging are
themed locally using separate stylesheets and observers; message contents are not read. It observes changes to styles
and stylesheet nodes so newly loaded components can be themed. It does not read
record text, document contents, cell values, email contents, cookies, authentication tokens, or
browser history. It does not create, edit, or delete CRM records.

Google Drive, Docs, Sheets and Calendar use a static stylesheet. The Google
adapter does not inspect stylesheets, traverse page elements or read canvas
pixels. Optional visual filters affect only rendered Docs pages and Sheets
grids. No document, cell, formatting or Calendar account setting is changed.

It stores `mode` (`system`, `dark`, or `light`), `darkGoogleCanvas` and
`autoThemeUpdates` (booleans), `themeCache` (validated appearance rules), and
`themeUpdateState` (check timestamps, status and revision) in `chrome.storage.local`.
These settings stay in the current Chrome profile on the
current device. It is not synced through the extension or sent to a server.

## Permissions

- **storage:** saves your appearance preference and updates open tabs when it changes.
- **raw.githubusercontent.com host access:** lets the updater's event-driven worker
  download the public theme file above. Chrome grants this permission for the host,
  not a single repository path. The worker hardcodes one URL and accepts no request
  URL from pages. No content script runs on GitHub.
- **Content script site access:** allows JavaScript and CSS to run only on the
  explicitly listed HubSpot app hosts, LinkedIn hosts, drive.google.com,
  calendar.google.com and the /document/ and /spreadsheets/ paths on docs.google.com
  in `extension/manifest.json`, including
  matching embedded frames and related blank/blob/data frames created by LinkedIn. Chrome may describe this as permission to read and
  change data on those hosts because modifying page appearance requires access
  to the page. The only additional host access is the GitHub update host above.

Google scripts run only in top-level matching pages. No access to Google sign-in,
Gmail, unrelated Google products or embedded third-party content is requested.

No API key, login, or account connection is required by this extension.
