# Privacy

GTM Dark Mode works locally in your browser. It makes no network requests,
loads no remote code, and includes no analytics or tracking.

The extension inspects CSS rules, computed HubSpot theme variables, and inline
style declarations to generate a dark stylesheet. On LinkedIn it also reads computed element colors because the site uses generated
classes and cross-origin CSS. It observes changes to styles
and stylesheet nodes so newly loaded components can be themed. It does not read
record text, field values, email contents, cookies, authentication tokens, or
browser history. It does not create, edit, or delete CRM records.

It stores one setting, `mode` (`system`, `dark`, or `light`), in
`chrome.storage.local`. This setting stays in the current Chrome profile on the
current device. It is not synced through the extension or sent to a server.

## Permissions

- **storage:** saves your appearance preference and updates open tabs when it changes.
- **Content script site access:** allows JavaScript and CSS to run only on the
  explicitly listed HubSpot app hosts and LinkedIn hosts in `extension/manifest.json`, including
  matching embedded frames. Chrome may describe this as permission to read and
  change data on those hosts because modifying page appearance requires access
  to the page. No access to unrelated websites is requested.

No HubSpot or LinkedIn API key, login, or account connection is required by this extension.
