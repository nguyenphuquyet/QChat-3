// Run from the repository with: node scripts/generate-app-icons.cjs
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const sharp = createRequire(require.resolve('next/package.json'))('sharp');

const root = path.resolve(__dirname, '../apps/mobile');
const green = '#10cf1e';
// PNG is lossless, so spend the time: effort 10 shrinks the 1024 px render from
// 1.4 MB to 350 kB with the same pixels.
const png = { compressionLevel: 9, effort: 10 };

async function write(relative, content) {
  const destination = path.join(root, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, content);
}

// The artwork carries its own gradient, so a flat fill colour would ring the
// safe-zone margin with a visible seam. Sample the four corners instead and
// stretch them across a backplate the artwork sits on.
async function gradientPlate(source) {
  const { data, info } = await sharp(source).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const patch = 8;
  const sample = (left, top) => {
    const sum = [0, 0, 0];
    for (let y = top; y < top + patch; y += 1) {
      for (let x = left; x < left + patch; x += 1) {
        const index = (y * info.width + x) * info.channels;
        sum[0] += data[index];
        sum[1] += data[index + 1];
        sum[2] += data[index + 2];
      }
    }
    return sum.map((value) => Math.round(value / (patch * patch)));
  };
  const corners = [
    sample(0, 0),
    sample(info.width - patch, 0),
    sample(0, info.height - patch),
    sample(info.width - patch, info.height - patch),
  ];
  const quad = Buffer.alloc(2 * 2 * 3);
  corners.forEach((color, index) => {
    quad[index * 3] = color[0];
    quad[(index * 3) + 1] = color[1];
    quad[(index * 3) + 2] = color[2];
  });
  return sharp(quad, { raw: { width: 2, height: 2, channels: 3 } })
    .resize(1024, 1024, { kernel: 'cubic' })
    .png()
    .toBuffer();
}

// `size` square icon: the artwork centred in a safe zone, or edge to edge when
// `inset` is 0, over the gradient backplate.
async function composeIcon(plate, source, size, inset) {
  const inner = size - 2 * inset;
  const artwork = await sharp(source).flatten({ background: green })
    .resize(inner, inner).png().toBuffer();
  const background = await sharp(plate).resize(size, size).png().toBuffer();
  return sharp(background)
    .composite([{ input: artwork, left: inset, top: inset }])
    .removeAlpha()
    .png(png)
    .toBuffer();
}

async function main() {
  const source = await fs.readFile(path.join(root, 'assets/branding/qchat-icon-source.png'));
  const plate = await gradientPlate(source);
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
    await write(file, await composeIcon(plate, source, size, inset));
    const metadata = await sharp(path.join(root, file)).metadata();
    if (metadata.width !== size || metadata.height !== size || metadata.hasAlpha) {
      throw new Error(`Invalid icon: ${file}`);
    }
  }
  const res = 'android/app/src/main/res';
  await write(`${res}/drawable-nodpi/ic_launcher_foreground.png`,
    await composeIcon(plate, source, 432, 82));
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
