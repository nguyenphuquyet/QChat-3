# QChat app icon

`qchat-icon-source.png` is the user-supplied artwork, preserved unchanged.
`qchat-icon.png` is the opaque 1024 × 1024 export.

Run `node scripts/generate-app-icons.cjs` from the repository root to regenerate
the iOS asset catalog images, Android launcher icons, adaptive icon resources,
and web icons. The script uses Sharp from the existing Next.js dependencies.

iOS and legacy icons retain the complete square artwork. Android adaptive and
web maskable variants add green margins to protect the logo and wordmark from
launcher masks. Platform launchers apply their own corner shapes.
