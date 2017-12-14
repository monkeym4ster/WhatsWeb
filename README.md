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

