const plugin = async (opts) => {
  const { url, response } = opts
  const result = {}
  const _response = response.res || response.response
  const { text } = _response
  const matched = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}/gi)
  // Detect valid email address in the page
  if (matched && matched.length >= 2) result.email = Array.from(new Set(matched))
  // Detect any email address in a mailto: tag
  return result
}

if (require.main === module) {
  const request = require('superagent')
  const Promise = require('bluebird')
  const url = 'http://www.freebuf.com'
  request.get(url)
  .set('Accept', '*/*')
  .set('Accept-Encoding', '')
  .set('user-agent', 'WhatsWeb/0.0.1')
  .ok(() => true)
  .then(response => {
    plugin(url, response)
      .then(res => console.log(JSON.stringify(res, null, 4)))
      .catch(err => console.log(err))
  })
}

exports.register = plugin
exports.register.attributes = {
  name: 'Email'
}