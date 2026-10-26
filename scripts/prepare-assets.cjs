const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
async function bitmap(svg, file, width, height) {
  const rgb = await sharp(Buffer.from(svg)).flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer();
  const rowSize = (width * 3 + 3) & ~3;
  const output = Buffer.alloc(54 + rowSize * height);
  output.write('BM'); output.writeUInt32LE(output.length, 2); output.writeUInt32LE(54, 10); output.writeUInt32LE(40, 14);
  output.writeInt32LE(width, 18); output.writeInt32LE(height, 22); output.writeUInt16LE(1, 26); output.writeUInt16LE(24, 28); output.writeUInt32LE(rowSize * height, 34);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const a = (y * width + x) * 3, b = 54 + (height - y - 1) * rowSize + x * 3; output[b] = rgb[a + 2]; output[b + 1] = rgb[a + 1]; output[b + 2] = rgb[a]; }
  await fs.writeFile(file, output);
}
async function main() {
  const resources = path.join(root, 'resources');
  const svg = await fs.readFile(path.join(resources, 'icon.svg'), 'utf8');
  const sizes = [16, 20, 24, 32, 48, 64, 128, 256];
  const images = await Promise.all(sizes.map(size => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()));
  const header = Buffer.alloc(6 + sizes.length * 16); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  for (let i = 0; i < sizes.length; i++) { const start = 6 + i * 16; header[start] = sizes[i] % 256; header[start + 1] = sizes[i] % 256; header.writeUInt16LE(1, start + 4); header.writeUInt16LE(32, start + 6); header.writeUInt32LE(images[i].length, start + 8); header.writeUInt32LE(offset, start + 12); offset += images[i].length; }
  await fs.writeFile(path.join(resources, 'icon.ico'), Buffer.concat([header, ...images]));
  await fs.writeFile(path.join(resources, 'icon.png'), images.at(-1));
  const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await bitmap(`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57"><rect width="150" height="57" fill="white"/><image href="${image}" x="8" y="11" width="35" height="35"/><text x="51" y="28" font-family="Segoe UI,Arial" font-size="14" font-weight="700" fill="#272132">HEIC2JPG</text><text x="51" y="41" font-family="Segoe UI,Arial" font-size="9" fill="#777080">by KULAM</text></svg>`, path.join(resources, 'installer-header.bmp'), 150, 57);
  await bitmap(`<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314"><rect width="164" height="314" fill="#14151b"/><circle cx="25" cy="74" r="115" fill="#a58af8" opacity=".06"/><image href="${image}" x="28" y="43" width="64" height="64"/><text x="25" y="145" font-family="Segoe UI,Arial" font-size="21" font-weight="700" fill="#f2edf9">HEIC2JPG</text><text x="25" y="171" font-family="Segoe UI,Arial" font-size="11" fill="#b9b0cc">Convert from Explorer.</text><text x="25" y="188" font-family="Segoe UI,Arial" font-size="11" fill="#b9b0cc">Keep your workflow.</text><text x="25" y="278" font-family="Segoe UI,Arial" font-size="10" fill="#bba4f5">KULAM</text></svg>`, path.join(resources, 'installer-sidebar.bmp'), 164, 314);
  console.log('Generated matching multi-resolution icons and installer artwork.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
