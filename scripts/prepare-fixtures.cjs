const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const directory = path.join(__dirname, '../tests/fixtures');
  await fs.mkdir(directory, { recursive: true });
  const fixture = path.join(directory, 'example.heic');
  try { await fs.access(fixture); }
  catch {
    const response = await fetch('https://raw.githubusercontent.com/strukturag/libheif/master/examples/example.heic');
    if (!response.ok) throw new Error(`Fixture download failed: ${response.status}`);
    await fs.writeFile(fixture, Buffer.from(await response.arrayBuffer()));
  }
  const resources = path.join(__dirname, '../resources');
  await fs.mkdir(resources, { recursive: true });
  const svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg"><rect width="256" height="256" rx="58" fill="#a58af8"/><path d="M72 50h74l38 38v112H72z" fill="none" stroke="#241a3b" stroke-width="12" stroke-linejoin="round"/><path d="M144 50v42h40" fill="none" stroke="#241a3b" stroke-width="12"/><path d="M94 155h66m-20-20 20 20-20 20" fill="none" stroke="#241a3b" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  await fs.writeFile(path.join(resources, 'icon.png'), png);
  await fs.writeFile(path.join(resources, 'icon.svg'), svg);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header[6] = 0; header[7] = 0; header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  await fs.writeFile(path.join(resources, 'icon.ico'), Buffer.concat([header, png]));
  console.log('Real HEIC fixture and app icons are ready.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
