const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const Promise = require('bluebird')
const request = require('superagent')
const { normalUrl } = require('./utils')

class WhatsWeb {
  constructor (opts) {
    const { target, timeout, userAgent } = opts
    this.timeout = timeout || 10000
    this.url = normalUrl(target)
    this.userAgent = userAgent
    return this
  }

  async analyse () {
    try {
      const { url, timeout, userAgent } = this
      const basePath = path.resolve(__dirname)
      const pluginsDir = path.join(basePath, 'plugins')
      const files = await Promise.promisify(fs.readdir)(pluginsDir)
      const plugins = files.map( file => path.join(pluginsDir, file))
      const response = await request.get(url).timeout(timeout).set('Accept', '*/*').set('Accept-Encoding', '').set('user-agent', userAgent).ok(() => true)
      this.response = response

      const results = []
      for (const _ of plugins) {
        const plugin = require(_)
        const name = plugin.register.attributes.name
        const result = await plugin.register({ url, timeout, userAgent, response })
        // 跳过无效结果
        if (!result || !Object.keys(result).length) continue
        results.push({ name, result })
      }
      return results
    } catch (err) {
      return err
    }
  }
}

module.exports = WhatsWeb

if (require.main === module) {
  const target = process.argv[2] || 'http://www.freebuf.com'
  const whatsWeb = new WhatsWeb({ target, timeout: 5000, userAgent: 'Mozilla/5.0' })
  whatsWeb
    .analyse()
    .then(res => console.log(JSON.stringify(res, null, 4)))
    .catch(err => console.log(err))
}
