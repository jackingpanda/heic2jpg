import { parentPort } from 'node:worker_threads'
import { convertPhoto } from './converter'
import type { WorkerJob } from '../../shared/types'

parentPort?.on('message', async (job: WorkerJob) => {
  try {
    const result = await convertPhoto(job, (stage, scratch) => parentPort?.postMessage({ stage, scratch }))
    parentPort?.postMessage({ result })
  } catch (error) { parentPort?.postMessage({ error: (error as Error).message }) }
})
