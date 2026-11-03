# A usable dark theme

The goal is a comfortable, readable workspace for long GTM sessions. The default
is warm charcoal and grays inspired by GTM Sage, with distinct surface levels and restrained accents.

| Role | Color |
| --- | --- |
| Page | `#262422` |
| Cards | `#2d2b28` |
| Menus and dialogs | `#33302e` |
| Inputs and navigation | `#242220` |
| Primary text | `#e3e0de` |
| Secondary text | `#b8b2ac` |
| Control boundary | `#938d85` |
| Focus indicator | `#d6b77c` |

| Decorative dividers | `#625d57` |

## Principles applied

- Use lighter surfaces for raised menus and dialogs so hierarchy stays visible
  without relying on shadows. Keep a consistent navigation surface at full height.
- Use off-white for reading text. Preserve meaningful status hues and media.
- Keep clear hover, selected, focus, checked and disabled states. The active
  HubSpot navigation item has an accent edge in addition to its background.
- Lift opaque near-black interface fills into charcoal while leaving media pixels
  and translucent overlay backdrops alone.
- Aim for at least 4.5:1 for normal text and 3:1 for meaningful control boundaries
  and focus indicators against adjacent surfaces.
- Follow system changes immediately; allow a persistent manual override.

The automated contrast tests check the curated palette's primary and secondary
text against all four surfaces, plus control boundaries and focus indicators.
These tests do not establish WCAG compliance for every page: transformed site
colors, translucent layers, custom components and native assets still require
live visual and keyboard verification.

The base background (`#262422`) and raised sidebar (`#33302e`) are grounded in
GTM Sage's rendered theme. Decorative separators are deliberately brighter than
Sage's subtle borders to improve separation in dense CRM and profile screens.

## References

- [Apple Human Interface Guidelines: Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
- [Material Design: Color roles](https://m3.material.io/styles/color/the-color-system)
- [W3C: Contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [W3C: Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
