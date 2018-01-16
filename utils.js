const ip = require('ip')
const dns = require('dns')
const Url = require('url')

const resolve4 = exports.resolve4 = (domain) => {
  return new Promise((resolve, reject) => {
    // IPV4，直接返回 IP 地址
    if (ip.isV4Format(domain)) return resolve(domain)
    // 发送 DNS 查询请求
    dns.resolve4(domain, (err, res) => {
      // DNS 解析出错
      if (err) return reject(err)
      // 仅返回有效结果
      if (res && res.length) return resolve(res[0])
      reject(new Error('Not valid data'))
    })
  })
}

const normalUrl = exports.normalUrl = url =>  {
  if (!url) throw new Error(`Invalid url ${url}`)
  return /^https?:/.test(url) ? url : `http://${url}`
}

const ipGenerator = exports.ipGenerator = async (target, network) => {
  const url = normalUrl(target)
  const { host } = Url.parse(url)
  if (!host) throw new Error('Invalid host')
  const resolve = await resolve4(host)
  const cidr = ip.cidrSubnet(`${resolve}/${network}`)
  const { firstAddress, lastAddress } = cidr
  const start = ip.toLong(firstAddress)
  const stop = ip.toLong(lastAddress)
  const ipList = []
  for (let i = start; i <= stop; i++) {
    ipList.push(ip.fromLong(i))
  }
  return ipList
}
