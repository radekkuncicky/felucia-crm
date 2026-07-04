import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

export async function mergePdfs(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length === 0) throw new Error('No PDFs to merge')
  if (buffers.length === 1) return buffers[0]

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanto-pdf-'))
  const inputPaths: string[] = []
  const outputPath = path.join(tmpDir, 'merged.pdf')

  try {
    for (let i = 0; i < buffers.length; i++) {
      const p = path.join(tmpDir, `${i}.pdf`)
      fs.writeFileSync(p, buffers[i])
      inputPaths.push(p)
    }
    await execFileAsync('pdfunite', [...inputPaths, outputPath])
    return fs.readFileSync(outputPath)
  } finally {
    for (const p of inputPaths) { try { fs.unlinkSync(p) } catch { /* ignore */ } }
    try { fs.unlinkSync(outputPath) } catch { /* ignore */ }
    try { fs.rmdirSync(tmpDir) } catch { /* ignore */ }
  }
}
