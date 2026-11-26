# QChat app icon

`qchat-icon-source.png` is the user-supplied artwork, preserved unchanged.
`qchat-icon.png` is the opaque 1024 × 1024 export.

Run `node scripts/generate-app-icons.cjs` from the repository root to regenerate
the iOS asset catalog images, Android launcher icons, adaptive icon resources,
and web icons. The script uses Sharp from the existing Next.js dependencies.

iOS and legacy icons retain the complete square artwork. Android adaptive and
web maskable variants centre the artwork in a safe zone; because the artwork
carries its own gradient, the margin around it is filled from the colours
sampled at its four corners rather than one flat green, so no seam rings the
icon. Platform launchers apply their own corner shapes.

Every PNG is written losslessly with the highest zlib effort, which keeps the
1024 px export near 350 kB.
