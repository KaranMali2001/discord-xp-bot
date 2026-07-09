import { env } from '@xp/core'
import { buildApp } from './app'

async function main(): Promise<void> {
  const app = await buildApp()
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' })
  app.log.info(`API listening on http://localhost:${env.API_PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
