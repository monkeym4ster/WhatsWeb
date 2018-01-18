const Wappalyzer = require('wappalyzer')

const plugin = async (opts) => {
  const { url, userAgent } = opts
  const result = {}
  const options = {
    debug: false, // 输出调试消息
    delay: 500, // 等待请求之间的毫秒数
    maxDepth: 3, // 不要分析比num深度更多的页面
    maxUrls: 10, // 当已经分析了num个URL时退出
    maxWait: 3000, // 等待页面资源加载时间不超过ms毫秒。
    recursive: true, // 跟随页面上的链接（爬虫）
    userAgent: userAgent, // 设置用户 UA
  }
  const wappalyzer = new Wappalyzer(url, options)
  const json = await wappalyzer.analyze()
  for (const app of json.applications) {
    const categories = app.categories.map(_ => Object.values(_))
    // 遍历所有种类，将 app 对象提交到对应的种类中
    categories.forEach(category => {
      let item = app.name
      if (app.version) item += `[${app.version}]`
      // 未有此类，新建
      if (!result[category]) return result[category] = [ item ]
      // 已有此类，追加
      result[category].push(item)
    })
  }
  return result
}

if (require.main === module) {
  plugin({ url: 'http://www.baidu.com/', userAgent: 'whatsweb' })
    .then(res => console.log(JSON.stringify(res, null, 4)))
    .catch(err => console.log(err))
}

exports.register = plugin
exports.register.attributes = {
  name: 'Wappalyzer'
}