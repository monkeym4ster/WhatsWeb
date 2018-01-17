const dns = require('dns')
const geoip = require('geoip-lite')

const plugin = async (opts) => {
  const { response, url } = opts
  const result = {}
  const _response = response.res || response.response
  const { text, headers, statusCode, statusMessage } = _response

  // Status
  result.status = [statusCode, statusMessage].join(' ')
  const matched = text.match(/<title>([^<]+)<\/title>/i)
  // Redirect
  const currentUrl = response.request.url
  if (currentUrl !== url) result.redirect = currentUrl
  // Title
  if (matched && matched.length >= 2) result.title = matched[1].trim().replace(/\n/g, '\\n').replace(/\r/g, '\\r')
  // x-headers
  for (const i in headers) if (i.startsWith('x-')) result[i] = headers[i]
  return result
}

exports.register = plugin
exports.register.attributes = {
  name: 'Base Infomation'
}
