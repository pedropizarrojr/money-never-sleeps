# LinkedIn first-load surfaces and section contrast

November 3, 2026. CSS-only patch for the 0.5.0 theme channel.

The reported profile and notifications pages loaded in phases: text became light
while several inner surfaces stayed white or light blue. Toggling the extension
off and on restarted the bounded adapter after the page had settled, which fixed
the appearance in the user's screenshots. This is consistent with elements being
visited before their later stylesheet/class state arrived. No new scan loop,
stylesheet polling, timeout-based rescan or page reload is added by this fix.

## Changes

- Override the observed `.d7ibtc` white-surface utility directly. It is shared by
  profile details, recommendation headers, Sales Insights, the notification filter
  header, sidebar and global navigation. Static CSS covers both new insertions and
  late class/style activation without revisiting an element in JavaScript.
- Give the observed unread-row utility pair an opaque raised warm-gray background.
  Keep the blue unread indicator and the distinction between read/unread rows.
  Text descendants stay transparent rather than showing separate dark rectangles.
- Strengthen profile card outlines using the actual box-shadow mechanism. The
  observed section has no border, so changing border-color alone did not help.
- Recolor only the Sales Navigator SVG's hardcoded black wordmark path. Its blue
  compass and white icon details are preserved; no image inversion is added.

All selectors are screen-only and require the existing dark-mode root attribute.
The patch fits the shipped update validator and keeps base version 0.5.0. Changes
in LinkedIn's generated utility names may require future CSS coverage updates.

## Verification and limits

The actual profile and notifications pages were inspected through Chrome. The
selectors matched all three reported profile surfaces, 11 profile sections, one
black wordmark path and one preserved blue brand path. On notifications they
matched one header white surface, two sidebar white surfaces, 37 primary white
surfaces and seven unread rows. No profile content, notification text or private
screenshots are included in this repository.

These are DOM/selector checks, not an after-change visual test. The inspected tabs
reported System/Light. Native popup control was unavailable because the Mac was
locked, and direct extension-page navigation was blocked by browser URL policy.
Those restrictions were respected; no alternate route was used to change the mode.
Live dark-mode appearance and first-load rendering still need confirmation after
the theme update is applied. No new browser latency claim is made.

Run `npm test`, `npm run check` and `npm run theme:build` before publication. The
existing updater tests validate the modified appearance packet as well as cache
delivery, dark-only scope and inactive Light-mode behavior.

## Apply the patch

For an existing 0.5.0 installation, enable **Automatic theme updates**, select Dark
or System while the OS is dark, and click **Check for theme updates**. Otherwise it
arrives at the next eligible automatic check. No page refresh is required for the
downloaded CSS. The separate `money-never-sleeps-0.5.0-linkedin-fix.zip` includes the
same CSS for fresh/manual installs. The original 0.5.0 ZIP is retained unchanged.
