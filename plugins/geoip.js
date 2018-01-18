const Url = require('url')
const { resolve4 } = require('../utils')

const geoip = require('geoip-lite')

const plugin = async (opts) => {
  const { url } = opts
  const { host } = Url.parse(url)
  if (!host) throw new Error('Not valid host')
  const resolve = await resolve4(host)
  const result = {}
  result.ip = resolve
  const geo = geoip.lookup(result.ip)
  // 可能查询结果为 null
  if (geo) {
    const { country, city } = geo
    result.country = [city, country].join('/')
  }
  return result
}

if (require.main === module) {
  plugin({ url: 'http://www.freebuf.com/x-404' })
    .then(res => console.log(JSON.stringify(res, null, 4)))
    .catch(err => console.log(err))
}

exports.register = plugin
exports.register.attributes = {
  name: 'Geolocation'
}