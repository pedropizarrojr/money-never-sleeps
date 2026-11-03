# Install Money Never Sleeps

1. Download the extension ZIP from the repository, then unzip it to a permanent folder.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** in the upper right.
4. Click **Load unpacked** and select the unzipped folder containing `manifest.json`.
5. Refresh any HubSpot, LinkedIn, Drive, Docs, Sheets and Calendar tabs that were already open when you installed it.
6. Pin **Money Never Sleeps** from Chrome's Extensions menu if you want quick access.

**System** is selected by default. Once loaded, an open supported tab follows changes
to Chrome's reported system color preference, including scheduled appearance
changes. No refresh is needed when your system changes appearance.

Choose **Dark** or **Light** in the extension popup to override automatic switching.
Choose **System** again to resume it. Preferences apply to all open supported tabs in
the same Chrome profile and stay on this device.

If you downloaded the full source repository instead of the extension ZIP, select
the repository's `extension` folder when clicking **Load unpacked**.

## Update or remove

Replace the extension files with the newer version, click its reload button on
`chrome://extensions`, then refresh supported apps. To uninstall, click **Remove** on that
page. Keep the folder in place while the unpacked extension is installed.

## Upgrading from an earlier version

Replace the contents of the same installed folder with the unzipped 0.5.0 files,
then reload the extension in `chrome://extensions`. Your saved appearance setting
is preserved when the installed folder stays the same. Chrome may ask you to
approve the added Google Drive, Docs/Sheets and Calendar site access if upgrading
from an older release. Version 0.5.0 also adds raw.githubusercontent.com access for
the theme updater. Its worker only downloads this project's public theme file.
Review that access, then refresh supported tabs once after updating.

The extension now appears as **Money Never Sleeps** in Chrome.

After reloading or updating an unpacked extension, refresh existing supported
tabs once. An old tab can retain the previous content script and stop receiving
the newly loaded extension's settings changes. This is an update step, not an
automatic reload during ordinary use.

## Automatic theme updates

After installing 0.5.0, colors and CSS fixes can update automatically. A visible
dark page checks the GitHub theme channel at most once per day across the profile.
Hidden pages pause checks. Light mode stops update work. The current theme renders
immediately from bundled or cached rules; GitHub is never on the page-load path.

The popup's **Automatic theme updates** switch disables checks and restores the
bundled theme. **Check for theme updates** requests an immediate check while dark
mode is on, at most once per minute. No site is automatically reloaded. Failed or
invalid downloads preserve the last working theme.

Full extension updates are still manual. Updating JavaScript, permissions, site
access, the document-start fallback or the updater itself requires replacing the
installed files and reloading the extension as above. New theme rules are scoped
to the extension version they were built for. An incompatible channel is skipped,
and the popup indicates which extension version it needs.

## Google document colors

**Dark document pages** is on by default. It darkens Docs page canvases and Sheets
grids for reading without changing the saved file. Images, charts and colored
cells in those canvases can look different. Turn this setting off to view their
original colors while keeping menus and toolbars dark. If a very large sheet
scrolls slowly, turning it off also removes the grid's visual filter.

Gmail, Slides, Forms, Meet, embedded external viewers and Google sign-in pages
are outside this release's coverage.

## Troubleshooting

- Disable other theme extensions for the same site to avoid competing styles.
- If System mode does not follow macOS, check that Chrome itself isn't forcing a
  different color preference. The extension follows `prefers-color-scheme` as
  reported by Chrome.
- Light mode immediately removes the generated dark stylesheet.
- This initial release may need fixes for individual HubSpot tools. When reporting
  an issue, include the tool name and Chrome version. Remove customer information
  and private URLs from any screenshots.
