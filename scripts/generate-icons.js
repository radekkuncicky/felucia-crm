#!/usr/bin/env node
// Generates simple solid-color PNG icons for PWA manifest
// No external dependencies required

const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

// CRC32 lookup table
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function createPNG(width, height, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB
  // compression=0, filter=0, interlace=0 already 0

  // Raw pixel data: each row = filter byte (0) + RGB per pixel
  const rowSize = 1 + width * 3
  const raw = Buffer.alloc(height * rowSize)
  for (let y = 0; y < height; y++) {
    const off = y * rowSize
    raw[off] = 0 // filter: None
    for (let x = 0; x < width; x++) {
      raw[off + 1 + x * 3] = r
      raw[off + 1 + x * 3 + 1] = g
      raw[off + 1 + x * 3 + 2] = b
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 })

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// NANTO yellow: #FFC93C = RGB(255, 201, 60)
const R = 255, G = 201, B = 60

const publicDir = path.join(__dirname, '..', 'public')

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createPNG(192, 192, R, G, B))
console.log('Created public/icon-192.png')

fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createPNG(512, 512, R, G, B))
console.log('Created public/icon-512.png')

console.log('PWA icons generated successfully!')
