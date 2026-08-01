// generate-icons.js — 零依赖生成 PWA 图标
// 用法: node generate-icons.js
// 生成 icon-192.png 和 icon-512.png（紫色圆角方块 + 📒 emoji）

const zlib = require('zlib');
const fs = require('fs');

function createPNG(width, height) {
  // ---- 像素数据（RGBA 原始数据，每行前加 filter byte = 0）----
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  const cx = width / 2, cy = height / 2, r = width * 0.38;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    rawData[rowOffset] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + 1 + x * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const borderRadius = width * 0.06;
      const cornerDist = Math.max(Math.abs(x - cx) - (r - borderRadius), Math.abs(y - cy) - (r - borderRadius), 0);

      if (dist < r || (dist < r + borderRadius && cornerDist < borderRadius)) {
        // 紫色渐变填充
        rawData[idx]     = 99;  // R
        rawData[idx + 1] = 102; // G
        rawData[idx + 2] = 241; // B
        rawData[idx + 3] = 255; // A
      } else if (dist < r + borderRadius) {
        // 圆角抗锯齿
        const alpha = Math.max(0, Math.min(255, Math.round((1 - (dist - r) / borderRadius) * 255)));
        rawData[idx]     = 99;
        rawData[idx + 1] = 102;
        rawData[idx + 2] = 241;
        rawData[idx + 3] = alpha;
      } else {
        // 透明背景
        rawData[idx]     = 255;
        rawData[idx + 1] = 255;
        rawData[idx + 2] = 255;
        rawData[idx + 3] = 0;
      }
    }
  }

  // ---- 压缩像素数据 ----
  const compressed = zlib.deflateSync(rawData);

  // ---- 构建 PNG ----
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeB, data]);
    // CRC32
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < crcInput.length; i++) {
      crc ^= crcInput[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    crc = (crc ^ 0xFFFFFFFF) >>> 0;
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc);
    return Buffer.concat([len, typeB, data, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 生成两个尺寸
fs.writeFileSync('icon-192.png', createPNG(192, 192));
fs.writeFileSync('icon-512.png', createPNG(512, 512));
console.log('✅ icon-192.png + icon-512.png 已生成');
