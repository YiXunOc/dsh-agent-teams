import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { constants, zstdCompress, zstdDecompress } from 'node:zlib'

import { repairAgentTeamsSource, repairFile, scanZstdFrames } from './session-source-repair.mjs'

const compress = promisify(zstdCompress)
const decompress = promisify(zstdDecompress)

test('repairs only historical AgentTeams command message sources', () => {
  const source = {
    type: 'user/message', seq: 7,
    data: { source: { kind: 'agent-teams-command', goal: 'ship it', profile: 'delivery' } },
  }
  const result = repairAgentTeamsSource(source)
  assert.deepEqual(result.value, {
    type: 'user/message', seq: 7,
    data: { source: { kind: 'plugin', plugin: '@nanmicoder/dsh-agent-teams', form: 'instructions' } },
  })
  assert.equal(result.repaired, true)
})

test('preserves unrelated rows byte-semantically', () => {
  const source = { type: 'user/message', seq: 8, data: { source: { kind: 'user' } } }
  const result = repairAgentTeamsSource(source)
  assert.equal(result.value, source)
  assert.equal(result.repaired, false)
})

test('does not rewrite nested or non-message AgentTeams source objects', () => {
  const source = {
    type: 'session/title', seq: 9,
    data: { source: { kind: 'agent-teams-command', goal: 'not a message source' } },
  }
  const result = repairAgentTeamsSource(source)
  assert.equal(result.value, source)
  assert.equal(result.repaired, false)
})

test('preserves the DSH concatenated-frame container and untouched frame bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-teams-session-repair-'))
  try {
    const input = join(root, 'session.jsonl.zstd')
    const output = join(root, 'repaired.jsonl.zstd')
    const options = { params: { [constants.ZSTD_c_checksumFlag]: 1 } }
    const rows = [
      { type: 'session', version: 0, id: 'fixture', createdAt: 1 },
      { type: 'user/message', seq: 0, data: { source: { kind: 'user' } } },
      { type: 'user/message', seq: 1, data: { source: { kind: 'agent-teams-command', goal: 'ship' } } },
    ]
    const sourceFrames = await Promise.all(rows.map(row => compress(`${JSON.stringify(row)}\n`, options)))
    const source = Buffer.concat(sourceFrames)
    await writeFile(input, source)
    const expectedSha256 = createHash('sha256').update(source).digest('hex')
    const report = await repairFile({ input, output, expectedSha256 })
    const repaired = await readFile(output)
    const ranges = scanZstdFrames(repaired)
    assert.equal(report.frameCount, 3)
    assert.equal(report.rewrittenFrames, 1)
    assert.equal(ranges.length, 3)
    assert.deepEqual(repaired.subarray(ranges[0].start, ranges[0].end), sourceFrames[0])
    assert.deepEqual(repaired.subarray(ranges[1].start, ranges[1].end), sourceFrames[1])
    const finalRow = JSON.parse((await decompress(repaired.subarray(ranges[2].start, ranges[2].end))).toString('utf8'))
    assert.deepEqual(finalRow.data.source, {
      kind: 'plugin', plugin: '@nanmicoder/dsh-agent-teams', form: 'instructions',
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
