# Install GTM Dark Mode

1. Download the extension ZIP from the repository, then unzip it to a permanent folder.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** in the upper right.
4. Click **Load unpacked** and select the unzipped folder containing `manifest.json`.
5. Refresh any HubSpot and LinkedIn tabs that were already open when you installed it.
6. Pin **GTM Dark Mode** from Chrome's Extensions menu if you want quick access.

**System** is selected by default. Once loaded, an open supported tab follows changes
to Chrome's reported system color preference, including scheduled appearance
changes. No refresh is needed when your system changes appearance.

Choose **Dark** or **Light** in the extension popup to override automatic switching.
Choose **System** again to resume it. Preferences apply to all open HubSpot and LinkedIn tabs in
the same Chrome profile and stay on this device.

If you downloaded the full source repository instead of the extension ZIP, select
the repository's `extension` folder when clicking **Load unpacked**.

## Update or remove

Replace the extension files with the newer version, click its reload button on
`chrome://extensions`, then refresh HubSpot and LinkedIn. To uninstall, click **Remove** on that
page. Keep the folder in place while the unpacked extension is installed.

## Upgrading from 0.1.0

Replace the contents of the same installed folder with the unzipped 0.2.0 files,
then reload the extension in `chrome://extensions`. Your saved appearance setting
is preserved when the installed folder stays the same. Chrome may ask you to
approve the newly added LinkedIn site access. Refresh both sites after updating.

The working extension name is now **GTM Dark Mode**. The final name is still open.

## Troubleshooting

- Disable other theme extensions for the same site to avoid competing styles.
- If System mode does not follow macOS, check that Chrome itself isn't forcing a
  different color preference. The extension follows `prefers-color-scheme` as
  reported by Chrome.
- Light mode immediately removes the generated dark stylesheet.
- This initial release may need fixes for individual HubSpot tools. When reporting
  an issue, include the tool name and Chrome version. Remove customer information
  and private URLs from any screenshots.
