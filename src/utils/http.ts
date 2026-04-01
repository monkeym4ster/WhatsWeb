export interface RequestOptions {
  timeout: number;
  userAgent: string;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text: string;
  url: string;
}

async function doFetch(
  url: string,
  method: string,
  options: RequestOptions,
): Promise<HttpResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout);

  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "*/*",
        "Accept-Encoding": "",
        "User-Agent": options.userAgent,
      },
    });

    const headersRecord: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headersRecord[key.toLowerCase()] = value;
    });

    const text = method === "HEAD" ? "" : await res.text();

    return {
      status: res.status,
      statusText: res.statusText,
      headers: headersRecord,
      text,
      url: res.url,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function httpGet(url: string, options: RequestOptions): Promise<HttpResponse> {
  return doFetch(url, "GET", options);
}

export async function httpHead(url: string, options: RequestOptions): Promise<HttpResponse> {
  return doFetch(url, "HEAD", options);
}
