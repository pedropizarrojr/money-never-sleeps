# Privacy

Money Never Sleeps works locally in your browser. It makes no network requests,
loads no remote code, and includes no analytics or tracking.

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

It stores `mode` (`system`, `dark`, or `light`) and `darkGoogleCanvas` (a boolean), in
`chrome.storage.local`. This setting stays in the current Chrome profile on the
current device. It is not synced through the extension or sent to a server.

## Permissions

- **storage:** saves your appearance preference and updates open tabs when it changes.
- **Content script site access:** allows JavaScript and CSS to run only on the
  explicitly listed HubSpot app hosts, LinkedIn hosts, drive.google.com,
  calendar.google.com and the /document/ and /spreadsheets/ paths on docs.google.com
  in `extension/manifest.json`, including
  matching embedded frames and related blank/blob/data frames created by LinkedIn. Chrome may describe this as permission to read and
  change data on those hosts because modifying page appearance requires access
  to the page. No access to unrelated websites is requested.

Google scripts run only in top-level matching pages. No access to Google sign-in,
Gmail, unrelated Google products or embedded third-party content is requested.

No API key, login, or account connection is required by this extension.
