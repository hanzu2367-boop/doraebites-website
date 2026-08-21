const { Jimp } = require('jimp');
const sharp = require('sharp');

// ---------- Utility: Flood fill background removal ----------
async function removeBackgroundFromEdges(inputPath, outputPath, tolerance = 40, bgCheck = (r,g,b) => r > 245 && g > 245 && b > 245) {
  const image = await Jimp.read(inputPath);
  const { width, height } = image.bitmap;

  const visited = new Uint8Array(width * height);
  const queue = [];
  const getIdx = (x, y) => y * width + x;
  const inBounds = (x, y) => x >= 0 && x < width && y >= 0 && y < height;

  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const idx = getIdx(x, y);
      if (!visited[idx]) {
        const r = image.bitmap.data[idx * 4];
        const g = image.bitmap.data[idx * 4 + 1];
        const b = image.bitmap.data[idx * 4 + 2];
        if (bgCheck(r, g, b)) { visited[idx] = 1; queue.push([x, y]); }
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const idx = getIdx(x, y);
      if (!visited[idx]) {
        const r = image.bitmap.data[idx * 4];
        const g = image.bitmap.data[idx * 4 + 1];
        const b = image.bitmap.data[idx * 4 + 2];
        if (bgCheck(r, g, b)) { visited[idx] = 1; queue.push([x, y]); }
      }
    }
  }

  while (queue.length) {
    const [cx, cy] = queue.pop();
    const pixelIdx = getIdx(cx, cy);
    const dataIdx = pixelIdx * 4;
    const r = image.bitmap.data[dataIdx];
    const g = image.bitmap.data[dataIdx + 1];
    const b = image.bitmap.data[dataIdx + 2];
    if (!bgCheck(r, g, b)) continue;
    image.bitmap.data[dataIdx + 3] = 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      const nIdx = getIdx(nx, ny);
      if (!visited[nIdx]) {
        visited[nIdx] = 1;
        const nr = image.bitmap.data[nIdx * 4];
        const ng = image.bitmap.data[nIdx * 4 + 1];
        const nb = image.bitmap.data[nIdx * 4 + 2];
        if (bgCheck(nr, ng, nb) || (Math.abs(nr - r) < tolerance && Math.abs(ng - g) < tolerance && Math.abs(nb - b) < tolerance)) {
          queue.push([nx, ny]);
        }
      }
    }
  }

  // Halo cleanup
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = getIdx(x, y);
      const dataIdx = idx * 4;
      if (image.bitmap.data[dataIdx + 3] === 0) continue;
      const r = image.bitmap.data[dataIdx];
      const g = image.bitmap.data[dataIdx + 1];
      const b = image.bitmap.data[dataIdx + 2];
      if (!(r > 235 && g > 235 && b > 235)) continue;
      let transparentNeighbors = 0, totalNeighbors = 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        totalNeighbors++;
        if (image.bitmap.data[getIdx(nx, ny) * 4 + 3] === 0) transparentNeighbors++;
      }
      if (totalNeighbors > 0 && transparentNeighbors / totalNeighbors > 0.5) {
        image.bitmap.data[dataIdx + 3] = 0;
      }
    }
  }

  // Trim transparent borders
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = getIdx(x, y);
      if (image.bitmap.data[idx * 4 + 3] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX > minX && maxY > minY) {
    image.crop({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
  }
  await image.write(outputPath);
  console.log('Processed:', outputPath);
}

async function main() {
  // 1. Convert dorayaki webp to png for Japanese Cake
  await sharp('dorayaki-red-bean-pancakes-1.webp')
    .rotate() // fix orientation
    .resize(600, 600, { fit: 'inside' })
    .png()
    .toFile('public/cake-japanese.png');
  console.log('Converted: public/cake-japanese.png');

  // 2. Process lemonade image - remove background
  await removeBackgroundFromEdges(
    'images (1).jpg',
    'public/drink-lemonade.png',
    40,
    (r, g, b) => r > 245 && g > 245 && b > 245
  );

  console.log('All done!');
}

async function convertWebpToPng(inputPath, outputPath) {
  await sharp(inputPath).png().toFile(outputPath);
  console.log('Converted:', outputPath);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});