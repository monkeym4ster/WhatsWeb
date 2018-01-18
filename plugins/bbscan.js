const Url = require('url')
const net = require('net')
const path = require('path')
const fs = require('fs')
const request = require('superagent')
const globby = require('globby')
const Promise = require('bluebird')

class BBScan {
  constructor (opts) {
    const { userAgent, url } = opts
    const { host, protocol } = Url.parse(url)

    this.userAgent = userAgent
    this.url = url
    this.host = host
    this.protocol = protocol
    const timeout = 2000
  }

  async fetch (path) {
    const { host, protocol, userAgent } = this
    const url = `${protocol}//${host}${path}`
    const timeout = this.timeout
    const response = await request.head(url).timeout(timeout).set('Accept', '*/*').set('Accept-Encoding', '').set('user-agent', userAgent).ok(() => true)
    return response
  }

  async check404 () {
    const response = await this.fetch(`/WhatsWeb-404-existence-check`)
    if (response.status !== 404) return false
    return true
  }

  async loadRules () {
    const rules = this.rules = [] // 规则
    const textToFind = this.textToFind = [] // 匹配文本
    const regexToFind = this.regexToFind = [] // 欲匹配的正则
    const textToExclude = this.textToExclude = [] // 欲排除文本
    const regexToExclude = this.regexToExclude = [] // 欲排除的正则

    // 正则
    const regTag = /{tag="(.*?)"}/
    const regStatus = /{status=(\d{3})}/
    const regContentType = /{type="(.*?)"}/
    const regContentTypeNo = /{type_no="(.*?)"}/
    const regText = /{text="(.*)"}/
    const regRegexText = /{regex_text="(.*)"}/

    // 遍历规则文件
    const ruleFiles = await globby(path.join(__dirname, '../', 'rules', '*.txt'))
    // const ruleFiles = ['rules/3.phpinfo_and_test.txt']
    for (const ruleFile of ruleFiles) {
      // 读取文件内容
      const fileData = await Promise.promisify(fs.readFile)(ruleFile, 'utf8')
      const lines = fileData.split('\n')
      for (const l of lines) {
        const line = l.trim()
        // 跳过非『/』开头的行
        if (!line.startsWith('/')) continue
        // 匹配 tag
        let _ = line.match(regTag)
        const tag = _ && _.length > 1 ? _[1] : ''
        // 匹配 status
        _ = line.match(regStatus)
        const status = _ && _.length > 1 ? parseInt(_[1]) : ''
        // 匹配 content_type
        _ = line.match(regContentType)
        const contentType = _ && _.length > 1 ? _[1] : ''
        // 匹配 content_type_no
        _ = line.match(regContentTypeNo)
        const contentTypeNo = _ && _.length > 1 ? _[1] : ''
        // 匹配 root_only
        const rootOnly = line.includes('{root_only}')
        // 匹配 uri
        const uri = line.split(/\s+/)[0]
        const rule = [ uri, tag, status, contentType, contentTypeNo, rootOnly]
        // 追加至 rules
        rules.push(rule)
      }
    }

    // 白名单文件
    const whiteListFile = path.join(__dirname, '../', 'rules', 'white.list')
    const whiteListFileData = await Promise.promisify(fs.readFile)(whiteListFile, 'utf8')
    const whiteListLines = whiteListFileData.split(/\n/)
    for (const l of whiteListLines) {
      const line = l.trim()
      if (!line || line.startsWith('#')) continue
      // 匹配 text
      let _ = line.match(regText)
      const text = _ && _.length > 1 ? _[1] : ''
      if (text) {
        textToFind.push(text)
        continue
      }
      // 匹配 regex_text
      _ = line.match(regRegexText)
      const regexText = _ && _.length > 1 ? _[1] : ''
      if (regexText) {
        regexToFind.push(new RegExp(regexText, 'i'))
        continue
      }
    }

    // 黑名单文件
    const blackListFile = path.join(__dirname, '../', 'rules', 'black.list')
    const blackListFileData = await Promise.promisify(fs.readFile)(blackListFile, 'utf8')
    const blackListLines = blackListFileData.split(/\n/)
    for (const l of blackListLines) {
      const line = l.trim()
      if (!line || line.startsWith('#')) continue
      // 匹配 text
      let _ = line.match(regText)
      const text = _ && _.length > 1 ? _[1] : ''
      if (text) {
        textToExclude.push(text)
        continue
      }
      // 匹配 regex_text
      _ = line.match(regRegexText)
      const regexText = _ && _.length > 1 ? _[1] : ''
      if (regexText) {
        regexToExclude.push(regexText)
        continue
      }
    }
  }

  findText (str) {
    if (this.textToFind.includes(str)) return true
    for (const regex of this.regexToFind) {
      if (regex.test(str)) return true
    }
    return false
  }

  findExcludeText (str) {
    if (this.textToExclude.includes(str)) return true
    for (const regex of this.regexToExclude) {
      if (regex.test(str)) return true
    }
    return false
  }

  async run() {
    // 检测是否支持 404
    const has404 = await this.check404()
    if (!has404) return false //not support 404
    // 加载规则
    await this.loadRules()
    const result = await Promise.map(this.rules, async (rule) => {
      try {
        const [ uri, tag, status, contentType, contentTypeNo, rootOnly] = rule
        let path = uri
        const sub = /\d$/.test(this.host) ? this.host.split('.')[3] : this.host.split('.')[0]
        if (path.includes('{sub}')) path = path.replace(/{sub}/g, sub)
        if (path.includes('{hostname_or_folder}')) path = path.replace(/{hostname_or_folder}/g, this.host)
        if (path.includes('{hostname}')) path = path.replace(/{hostname}/g, this.host)
        const response = await this.fetch(path)
        const _response = response.res || response.response
        const { text, headers, statusCode, statusMessage } = _response
        const curContentType = headers['content-type']
        // 跳过空内容
        if (['html', 'text'].includes(curContentType) && !text.length) throw new Error('Empty content')
        // 跳过图片
        if (curContentType.includes('image/')) throw new Error('Ignore images')
        // 命中文本
        if (this.findText(text)) return path
        // 命中 json 文件，但 uri 不是以 .json 结尾
        if (curContentType.includes('application/json') && !path.endsWith('.json')) throw new Error('Invalid json file')
        // 支持 404，并且当前状态码不是 404
        if (has404 || statusCode !== 404) {
          // 和规则中的 status 不同，也不是 206
          if (statusCode !== status && statusCode !== 206) throw new Error('The status code is not the same, not 206')
          if (status => 200 && status <= 206 && statusCode === 206) return path
          if (status && statusCode !== status) throw new Error('The status code is not the same')
          if (status !== 403 && statusCode === 403) throw new Error('Status code is 403')
        }

        // 不支持 404，状态码在200-206之间，不是默认页，不存在tag标签，通过判断是不是等于 404 页面决定去留
        // if (!has404 && statusCode >= 200 && statusCode <= 206 && uri !== '/' && !tag) {
        //   const contentLen = text.length
        // }
        if (statusCode === 206 && tag === '' && !curContentType.includes('text') && !curContentType.includes('html')) path
        return path
      }catch (err) { }
    }, { concurrency: 50 }).catch(function ignore (err) { 
      // console.log(err)
    })
    return result.filter(_ => !!_)
  }
}


const plugin = async (opts) => {
  const bbScan = new BBScan(opts)
  return bbScan.run()
}

if (require.main === module) {
  plugin({ url: 'http://101.231.136.48/', userAgent: 'WhatsWeb' })
    .then(res => console.log(JSON.stringify(res, null, 4)))
    .catch(err => console.log(err))
}

exports.register = plugin
exports.register.attributes = {
  name: 'BBScan'
}