#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { open, readFile, rename, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { constants, zstdCompress, zstdDecompress } from 'node:zlib'
import { promisify } from 'node:util'

const ZSTD_MAGIC = 0xFD2FB528
const compressFrame = promisify(zstdCompress)
const decompressFrame = promisify(zstdDecompress)
const CHECKSUM_OPTIONS = { params: { [constants.ZSTD_c_checksumFlag]: 1 } }

export const AGENT_TEAMS_CONTEXT_SOURCE = Object.freeze({
  kind: 'plugin',
  plugin: '@nanmicoder/dsh-agent-teams',
  form: 'instructions',
})

export function repairAgentTeamsSource(value) {
  if (value?.type !== 'user/message'
    || value.data?.source?.kind !== 'agent-teams-command') return { value, repaired: false }
  return {
    value: { ...value, data: { ...value.data, source: AGENT_TEAMS_CONTEXT_SOURCE } },
    repaired: true,
  }
}

async function sha256(path) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

/** Locate complete frames in the DSH concatenated-Zstandard container. */
export function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4 || buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
      throw new Error(`invalid or incomplete Zstandard frame at byte ${offset}`)
    }
    offset += 4
    if (offset === buffer.length) throw new Error(`incomplete Zstandard frame at byte ${start}`)
    const descriptor = buffer.readUInt8(offset++)
    if ((descriptor & 0x18) !== 0) throw new Error(`reserved Zstandard frame-header bit at byte ${offset - 1}`)
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const checksum = (descriptor & 0x04) !== 0
    const dictionaryFlag = descriptor & 0x03
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) throw new Error(`incomplete Zstandard frame header at byte ${start}`)
    offset += remainingHeaderBytes
    for (;;) {
      if (buffer.length - offset < 3) throw new Error(`incomplete Zstandard block header at byte ${start}`)
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 0x03
      const blockSize = blockHeader >>> 3
      if (blockType === 0x03) throw new Error(`reserved Zstandard block type at byte ${offset - 3}`)
      const payloadBytes = blockType === 0x01 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) throw new Error(`incomplete Zstandard block at byte ${start}`)
      offset += payloadBytes
      if (lastBlock) break
    }
    if (checksum) {
      if (buffer.length - offset < 4) throw new Error(`incomplete Zstandard checksum at byte ${start}`)
      offset += 4
    }
    frames.push({ start, end: offset })
  }
  return frames
}

export async function repairFile({ input, output, expectedSha256 }) {
  const source = resolve(input)
  const target = resolve(output)
  if (source === target) throw new Error('refusing to overwrite the source artifact')
  if (existsSync(target)) throw new Error(`refusing to overwrite existing output: ${target}`)
  const actualSha256 = await sha256(source)
  if (actualSha256 !== expectedSha256.toLowerCase()) {
    throw new Error(`source SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha256}`)
  }
  const temporary = `${target}.partial-${process.pid}`
  const sourceBytes = await readFile(source)
  const frames = scanZstdFrames(sourceBytes)
  if (frames.length === 0) throw new Error('empty Zstandard session artifact')
  const outputHandle = await open(temporary, 'wx')
  let physicalLines = 0
  let repairedCount = 0
  const repairedSeqs = []
  let rewrittenFrames = 0
  try {
    for (const [frameIndex, frame] of frames.entries()) {
      const encoded = sourceBytes.subarray(frame.start, frame.end)
      const plaintext = await decompressFrame(encoded)
      if (plaintext.length === 0 || plaintext.at(-1) !== 0x0A) {
        throw new Error(`Zstandard frame ${frameIndex} does not end at a JSONL record boundary`)
      }
      const lines = plaintext.toString('utf8').slice(0, -1).split('\n')
      if (frameIndex === 0 && lines.length !== 1) {
        throw new Error('first Zstandard frame is not exactly one header line')
      }
      let changed = false
      const outputLines = lines.map(line => {
        physicalLines += 1
        const parsed = JSON.parse(line)
        const repaired = repairAgentTeamsSource(parsed)
        if (repaired.repaired) {
          changed = true
          repairedCount += 1
          repairedSeqs.push(parsed.seq)
        }
        return repaired.repaired ? JSON.stringify(repaired.value) : line
      })
      if (!changed) await outputHandle.write(encoded)
      else {
        rewrittenFrames += 1
        await outputHandle.write(await compressFrame(`${outputLines.join('\n')}\n`, CHECKSUM_OPTIONS))
      }
    }
    await outputHandle.sync()
    await outputHandle.close()
    if (repairedCount === 0) throw new Error('no historical agent-teams-command message sources found')
    await rename(temporary, target)
    return {
      input: source,
      output: target,
      inputSha256: actualSha256,
      outputSha256: await sha256(target),
      physicalLines,
      frameCount: frames.length,
      rewrittenFrames,
      repairedCount,
      repairedSeqs,
    }
  } catch (error) {
    await outputHandle.close().catch(() => undefined)
    await rm(temporary, { force: true })
    throw error
  }
}

function usage() {
  return 'Usage: node scripts/session-source-repair.mjs --input <session.jsonl.zstd> --output <new.zstd> --sha256 <expected>'
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const args = new Map()
  for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1])
  const input = args.get('--input')
  const output = args.get('--output')
  const expectedSha256 = args.get('--sha256')
  if (input === undefined || output === undefined || expectedSha256 === undefined) throw new Error(usage())
  console.log(JSON.stringify(await repairFile({ input, output, expectedSha256 }), null, 2))
}
