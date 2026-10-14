# Approved asset installation manifest (2026-10-14)

The project owner approved the supplied exact eight transparent PNG files. Original pixels have been preserved in an export package:
`Collector_Intelligence_Production_Brand_Assets.zip` (provided in conversation).
The app source now references paths below, but GitHub's available connector has **not uploaded the binary assets**. Until public/ entries land, the UI uses existing CI fallback. A successful code build does **not** mean the full logo is visible.

Required contents to extract into repository root:
```
public/brand/logo-symbol.png
public/brand/logo-horizontal-dark-text.png
public/brand/logo-horizontal-white.png
public/brand/logo-stacked-dark-text.png
public/brand/logo-horizontal-mono-white.png
public/brand/logo-stacked-mono-white.png
public/brand/logo-stacked-mono-black.png
public/brand/app-icon.png
public/favicon-16.png
public/favicon-32.png
public/favicon-48.png
public/apple-touch-icon-180.png
public/icon-192.png
public/icon-512.png
```

Sidebar loads symbol, login loads app icon, browser loads favicon and Apple touch icon. Other variants are for future exports and light-themed collateral.

**Acceptance gate:** The asset zip must be extracted to **public/** on main, Vercel must deploy that commit, and a signed-in user must confirm actual logo and favicon. The GitHub update-file connector supports UTF-8 files only, and the runtime has no direct GitHub network access. No claim is made that binary files have been committed. Never replace originals with guessed vector recreations.
