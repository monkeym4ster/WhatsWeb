# WhatsWeb

Identifies websites.

## Installation

``` bash
$ npm i -g whatsweb
# Or
$ yarn global add whatsweb
```

## Usage

``` bash
$ whatsweb URLs [options]
```

### Options

```
    -V, --version            output the version number
    -f <file>                Targets file path
    -c, --concurrency <num>  Start specified NUMBER of concurrency (default: 10)
    --network <mask>         Scan all Target/MASK hosts
    --timeout <ms>           Max scan minutes for request (default: 10000)
    --user-agent <string>    Custom User-Agent (default: Mozilla/5.0 whatsweb/0.1.0)
    -o, --output <path>      Output file path
    --show-error             Show error message
    -h, --help               output usage information
```

### Example

[![example](https://asciinema.org/a/QlO4vqhnPEF0Hwf5zqCFjKgT2.png)](https://asciinema.org/a/QlO4vqhnPEF0Hwf5zqCFjKgT2)