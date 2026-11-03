# A usable dark theme

The goal is a comfortable, readable workspace for long GTM sessions. The default
is charcoal and slate, with distinct surface levels and restrained accents.

| Role | Color |
| --- | --- |
| Page | `#202631` |
| Cards | `#283240` |
| Menus and dialogs | `#344153` |
| Inputs and navigation | `#252e3b` |
| Primary text | `#dce4ef` |
| Secondary text | `#abb8c9` |
| Control boundary | `#8796aa` |
| Focus indicator | `#93c5fd` |

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

## References

- [Apple Human Interface Guidelines: Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
- [Material Design: Color roles](https://m3.material.io/styles/color/the-color-system)
- [W3C: Contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [W3C: Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
