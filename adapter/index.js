/* eslint-disable require-jsdoc */
import adapter, { bindGlobal } from 'cloudflare-worker-adapter'
import { MemoryCache } from 'cloudflare-worker-adapter/cache/memory.js'
import fs from 'fs'
import HttpsProxyAgent from 'https-proxy-agent'
import fetch from 'node-fetch'

const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))

let cache = new MemoryCache()
switch (config?.database?.type) {
  case 'local': {
    const { LocalCache } = await import('cloudflare-worker-adapter/cache/local.js')
    cache = new LocalCache(config.database.uri)
    break
  }
  case 'sqlite': {
    const { SqliteCache } = await import('cloudflare-worker-adapter/cache/sqlite.js')
    cache = new SqliteCache(config.database.uri)
    break
  }
  case 'redis': {
    const { RedisCache } = await import('cloudflare-worker-adapter/cache/redis.js')
    cache = new RedisCache(config.database.uri)
    break
  }
  default:
    break
}

console.log(`DATABASE: ${config?.database?.type} is ready`)

const proxy = config.https_proxy || process.env.https_proxy || process.env.HTTPS_PROXY
if (proxy) {
  console.log(`HTTPS proxy: ${proxy}`)
  const agent = new HttpsProxyAgent(proxy)
  const proxyFetch = async (url, init) => {
    return fetch(url, { agent, ...init })
  }
  bindGlobal({
    fetch: proxyFetch,
  })
}

try {
  const buildInfo = JSON.parse(fs.readFileSync('../dist/buildinfo.json', 'utf-8'))
  process.env.BUILD_TIMESTAMP = buildInfo.timestamp
  process.env.BUILD_VERSION = buildInfo.sha
  console.log(buildInfo)
} catch (e) {
  console.log(e)
}

const { default: worker } = await import('../main.js')
adapter.startServer(
  config.port || 8787,
  config.host || '0.0.0.0',
  config.toml,
  { DATABASE: cache },
  { server: config.server },
  worker.fetch,
)
