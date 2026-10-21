// Run from the repository with: node scripts/generate-app-icons.cjs
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const sharp = createRequire(require.resolve('next/package.json'))('sharp');

const root = path.resolve(__dirname, '../apps/mobile');
const green = '#10cf1e';

async function write(relative, content) {
  const destination = path.join(root, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, content);
}

async function main() {
  const source = await fs.readFile(path.join(root, 'assets/branding/qchat-icon-source.png'));
  const outputs = new Map();
  const icons = JSON.parse(await fs.readFile(
    path.join(root, 'ios/Runner/Assets.xcassets/AppIcon.appiconset/Contents.json'), 'utf8',
  ));
  for (const icon of icons.images) {
    outputs.set(`ios/Runner/Assets.xcassets/AppIcon.appiconset/${icon.filename}`,
      Math.round(parseFloat(icon.size) * parseFloat(icon.scale)));
  }
  for (const [density, size] of Object.entries({
    mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192,
  })) {
    outputs.set(`android/app/src/main/res/mipmap-${density}/ic_launcher.png`, size);
  }
  outputs.set('assets/branding/qchat-icon.png', 1024);
  outputs.set('web/favicon.png', 32);
  for (const size of [192, 512]) {
    outputs.set(`web/icons/Icon-${size}.png`, size);
    outputs.set(`web/icons/Icon-maskable-${size}.png`, size);
  }
  for (const [file, size] of outputs) {
    // Preserve the supplied artwork. Maskable icons need extra room so
    // launchers do not clip the wordmark when applying circular masks.
    const inset = file.includes('maskable') ? Math.round(size * 0.12) : 0;
    await write(file, await sharp(source).resize(size - 2 * inset, size - 2 * inset)
      .extend({ top: inset, bottom: inset, left: inset, right: inset, background: green })
      .flatten({ background: green }).png().toBuffer());
    const metadata = await sharp(path.join(root, file)).metadata();
    if (metadata.width !== size || metadata.height !== size || metadata.hasAlpha) {
      throw new Error(`Invalid icon: ${file}`);
    }
  }
  const res = 'android/app/src/main/res';
  await write(`${res}/drawable-nodpi/ic_launcher_foreground.png`,
    await sharp(source).resize(268, 268)
      .extend({ top: 82, bottom: 82, left: 82, right: 82, background: green })
      .flatten({ background: green }).png().toBuffer());
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`;
  await write(`${res}/values/ic_launcher_colors.xml`, `<?xml version="1.0" encoding="utf-8"?>
<resources><color name="ic_launcher_background">${green}</color></resources>
`);
  await write(`${res}/mipmap-anydpi-v26/ic_launcher.xml`, adaptive);
  console.log(`Generated and validated ${outputs.size} PNG icons plus Android adaptive resources.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
