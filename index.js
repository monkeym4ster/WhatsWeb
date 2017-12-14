#!/usr/bin/env node
const Wappalyzer = require('wappalyzer')
const pkg = require('./package')

const args = process.argv.slice(2)

const url = args.shift() || ''

if ( !url ) {
  const helpInfo = `
  WhatsWeb ${pkg.version}

  Usage: whatsweb [url] [options]

  Options:
    --debug=0|1             Output debug messages.
    --delay=ms              Wait for ms milliseconds between requests.
    --max-depth=num         Don't analyze pages more than num levels deep.
    --max-urls=num          Exit when num URLs have been analyzed.
    --max-wait=ms           Wait no more than ms milliseconds for page resources to load.
    --recursive=0|1         Follow links on pages (crawler).
    --request-timeout=ms    Wait no more than ms millisecond for the page to load.
    --user-agent=str        Set the user agent string.`
  process.stdout.write(helpInfo)
  process.exit(0)
}

var options = {}
var arg

while ( arg = args.shift() ) {
  var matches = /--([^=]+)=(.+)/.exec(arg)

  if ( matches ) {
    var key = matches[1].replace(/-\w/g, matches => matches[1].toUpperCase())
    var value = matches[2]

    options[key] = value
  }
}

const normalUrl = /^https:?/i.test(url) ? url : `http://${url}`

const wappalyzer = new Wappalyzer(normalUrl, options)

wappalyzer.analyze()
  .then(json => {
    process.stdout.write(JSON.stringify(json, null, 4) + '\n')

    process.exit(0)
  })
  .catch(error => {
    process.stderr.write(error + '\n')

    process.exit(1)
  })
