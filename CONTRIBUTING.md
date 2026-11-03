# Contributing

Keep the extension focused on HubSpot appearance. Avoid new permissions and
dependencies unless a concrete compatibility issue requires them. Do not add
tracking, remote scripts, credentials, customer data, or real CRM fixtures.

Run `npm test`, `npm run check`, and `npm run package` before opening a pull request.

## Manual verification

1. Load `extension/` unpacked in Chrome and refresh HubSpot once.
2. Select System, switch the OS from light to dark and back, and confirm that
   already-open HubSpot tabs change without a reload.
3. Select Dark and Light manually. Confirm that OS changes don't override them.
   Select System again to restore automatic switching.
4. Change modes while multiple HubSpot tabs are open. Hide one and return to it.
5. Open a deals list, pipeline board, contact, company and deal record.
6. Open menus, tooltips, search results, dialogs and date pickers. Check focus
   indicators, keyboard navigation, hover states and input readability.
7. Check status badges, charts, media, email previews and printed output.
8. Confirm that toggling Light restores the original styling, and that the
   extension makes no network requests.

When filing an issue, include Chrome and extension versions, the HubSpot tool,
steps to reproduce, and a redacted screenshot if useful. Never include private
record URLs, account identifiers, email addresses, customer names or deal data.
