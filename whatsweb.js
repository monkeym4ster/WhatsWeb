#!/usr/bin/env node

const fs = require('fs')
const os = require('os')
const Path = require('path')
const Program = require('commander')
const ProgressBar = require('progress')
const chalk = require('chalk')
const Promise = require('bluebird')
const Pack = require('./package')
const WhatsWeb = require('./index')
const { ipGenerator } = require('./utils')

const main = async () => {
  const opts = Program
    .version(Pack.version)
    .usage('[options] URLs')
    .description('Identifies websites.')
    .option('-f <file>', 'Targets file path')
    .option('-c, --concurrency <num>', 'Start specified NUMBER of concurrency', Math.abs, 10)
    .option('--network <mask>', 'Scan all Target/MASK hosts')
    .option('--timeout <ms>', 'Max scan minutes for request', Math.abs, 10000)
    .option('--user-agent <string>', 'Custom User-Agent', `Mozilla/5.0 ${Pack.name}/${Pack.version}`)
    .option('-o, --output <path>', 'Output file path')
    .option('--show-error', 'Show error message', false)
    .parse(process.argv)

  const targetFile = opts.F
  const concurrency = opts.concurrency
  const network = opts.network
  const timeout = opts.timeout
  const userAgent = opts.userAgent
  const outputFile = opts.output
  const showError = opts.showError
  let targets = opts.args

  // 没带任何参数
  if (process.argv.length < 3) {
    opts.outputHelp()
    process.exit(0)
  }

  // 没指定URL列表，也没有指定目标文件
  if (!targets.length && !targetFile) throw new Error('Target is required.')

  // 从目标文件中读取URL列表
  if (targetFile) {
    const fileData = fs.readFileSync(targetFile, 'utf8').trim()
    if (!fileData.length) throw new Error('File is empty.')
    targets = fileData.split('\n')
  }

  // 根据 network 生成 IP 段
  if (network) {
    for (const target of targets) {
      try{
        const ipList = await ipGenerator(target, network)
        targets = targets.concat(ipList)
      } catch (err) {}
    }
  }

  // 数据去重
  targets = Array.from(new Set(targets))

  console.log(chalk.dim(`[*] Options: ${JSON.stringify({ outputFile, concurrency, targetFile, network, timeout, userAgent, targetCount: targets.length, showError })}`))

  // 有效数量
  let valid = 0

  // 进度条
  const bar = new ProgressBar(':valid Hits(:rate Targets/s) | :current/:total(:percent) scanned in :elapseds, :etas left', { total: targets.length })

  Promise.map(targets, (target) => {
    const whatsWeb = new WhatsWeb({ target, timeout, userAgent })
    const highlight = (str) => chalk.bold(chalk.yellow(str))
    return whatsWeb.analyse()
      .then((data) => {
        // 有效数 +1
        if(Array.isArray(data)) valid += 1
        // 进度条 +1
        bar.tick({ valid })
        // 使用了 showError 选项时，记录错误信息。
        if (!Array.isArray(data)) {
          if (showError) bar.interrupt(chalk.gray(`[-] Request ${whatsWeb.url} failed. ${data.message}`))
          return false
        }
        // 记录数据
        bar.interrupt(`[+] WhatsWeb report for ${chalk.bold(chalk.blue(whatsWeb.url))}`)

        // 记录到文件
        if (outputFile) fs.appendFileSync(outputFile, JSON.stringify({target: whatsWeb.url, plugins: data }) + os.EOL)

        // 每一个 item 是一个插件的执行结果，lines 是所有插件执行结果的汇合
        const _lines = []
        for (const item of data) {
          const { result, name } = item
          const nameStr = `[ ${chalk.bold(chalk.cyan(name))} ]`
          const _line = []
          for (const _ in result) {
            const key = _
            const value = result[_]
            // 插件执行结果拼接的字符串
            let pluginResult = ''
            // name
            pluginResult += chalk.bold(chalk.white(key)) + ': '
            // value
            const _value = Array.isArray(value) ? value.join(', ') : value
            // 对于特殊键的值，进行高亮显示
            pluginResult += ['title'].includes(key) ? highlight(_value) : _value
            _line.push(pluginResult)
          }
          const line = _line.join(', ')
          _lines.push(`${nameStr} ${line}`)
        }
        const lines = _lines.join('\n')
        bar.interrupt(`${lines}\n`)
      })
      .catch(function ignore(err) { })
  }, { concurrency })
  .then(() => process.exit(0))
}

if (process.mainModule) main().catch((e) => {
  console.error(chalk.red(`[-] Error. ${e.message}`))
  process.exit(-1)
})