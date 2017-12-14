# WhatsWeb
Uncovers the technologies used on websites.

## Installation

``` bash
$ npm i -g whatsweb
# Or
$ yarn global add whatsweb
```


## Usage

``` bash
$ whatsweb [url] [options]
```

### Options

```
  --debug=0|1             Output debug messages.
  --delay=ms              Wait for ms milliseconds between requests.
  --max-depth=num         Don't analyze pages more than num levels deep.
  --max-urls=num          Exit when num URLs have been analyzed.
  --max-wait=ms           Wait no more than ms milliseconds for page resources to load.
  --recursive=0|1         Follow links on pages (crawler).
  --request-timeout=ms    Wait no more than ms millisecond for the page to load.
  --user-agent=str        Set the user agent string.
```

### Example

``` bash
$ whatsweb http://www.baidu.com --debug=1
[wappalyzer debug] [driver] [crawl] Time lapsed: 0s / 0s
[wappalyzer debug] [driver] [fetch] Time lapsed: 0s / 0s
[wappalyzer debug] [driver] depth: 1; delay: 0ms; url: http://www.baidu.com/
[wappalyzer debug] [driver] [browser.visit start] Time lapsed: 0s / 0.01s
[wappalyzer debug] [driver] [browser.visit end] Time lapsed: 1.89s / 1.9s
[wappalyzer debug] [driver] [browser.wait end] Time lapsed: 0.62s / 2.52s
[wappalyzer debug] [core] 3 apps detected: HeadJS, SWFObject, jQuery on http://www.baidu.com/
[wappalyzer debug] [driver] [displayApps] Time lapsed: 0.21s / 2.72s
[wappalyzer debug] [driver] [done] Time lapsed: 0s / 2.72s
[
    {
        "name": "HeadJS",
        "confidence": "50",
        "version": "",
        "icon": "HeadJS.png",
        "website": "http://headjs.com",
        "categories": [
            {
                "12": "JavaScript Frameworks"
            }
        ]
    },
    {
        "name": "SWFObject",
        "confidence": "100",
        "version": "",
        "icon": "SWFObject.png",
        "website": "http://github.com/swfobject/swfobject",
        "categories": [
            {
                "19": "Miscellaneous"
            }
        ]
    },
    {
        "name": "jQuery",
        "confidence": "100",
        "version": "1.10.2",
        "icon": "jQuery.svg",
        "website": "http://jquery.com",
        "categories": [
            {
                "12": "JavaScript Frameworks"
            }
        ]
    }
]
```
