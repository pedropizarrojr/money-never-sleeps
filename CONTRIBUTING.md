# Contributing

Keep the extension focused on HubSpot, LinkedIn, Drive, Docs, Sheets and Calendar appearance. Avoid new permissions and
dependencies unless a concrete compatibility issue requires them. Do not add
tracking, remote scripts, credentials, customer data, or real CRM fixtures.

Run `npm test`, `npm run check`, `npm run theme:build` and `npm run package` before opening a pull request.
See [automatic theme publishing](docs/automatic-updates.md) before changing page CSS.

## Manual verification

1. Load `extension/` unpacked in Chrome and refresh supported apps once.
2. Select System, switch the OS from light to dark and back, and confirm that
   already-open supported tabs change without a reload.
3. Select Dark and Light manually. Confirm that OS changes don't override them.
   Select System again to restore automatic switching.
4. Change modes while multiple HubSpot and LinkedIn tabs are open. Hide one and return to it.
5. Open a deals list, pipeline board, contact, company and deal record.
6. Open menus, tooltips, search results, dialogs and date pickers. Check focus
   indicators, keyboard navigation, hover states and input readability.
7. Check LinkedIn feed, profiles, search, messaging overlays and Sales Navigator.
8. Check the full height of the HubSpot sidebar, including the empty lower region,
   hover and selected states, and expanded navigation.
9. Check status badges, charts, media, email previews and printed output.
10. Confirm that toggling Light restores the original styling, and that the
   extension makes no network requests in Light mode. In Dark mode only the fixed,
   throttled GitHub appearance-data request is expected when updates are enabled.
11. Check Drive Home, My Drive, grid/list layouts, search and menus; Calendar week,
    month, event popovers and settings. Calendar event colors should keep their identity.
12. Check Docs and Sheets menus, toolbars, tabs, side panels and formula editing.
    Toggle **Dark document pages** in both modes, verify chart/image colors in
    original-color mode, then check print preview uses original formatting.
13. Compare loading and scrolling with the extension enabled and disabled. Do not
    infer browser latency from the unit-test runtime. Google must not start a
    scanning engine or per-scroll JavaScript handler. Its updater may have one
    daily timeout in a visible dark tab; Light mode must have no updater timer.
14. With synthetic data, test a compatible new theme revision, an incompatible
    version, offline/invalid downloads, the update off switch, and a mode switch
    during a pending check. Confirm cached rules update without any page reload.

When filing an issue, include Chrome and extension versions, the HubSpot tool,
steps to reproduce, and a redacted screenshot if useful. Never include private
record URLs, account identifiers, email addresses, customer names or deal data.
