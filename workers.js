addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
      const url = new URL(request.url);
      console.log('Request URL:', url.href);

      // ������ʸ�Ŀ¼������HTML
      if (url.pathname === "/") {
          return new Response(getRootHtml(), {
              headers: {
                  'Content-Type': 'text/html; charset=utf-8'
              }
          });
      }

      // �������е���վ
      const whitelist = ['example.com', 'another-example.com'];

      // ���Ŀ�� URL �Ƿ��ڰ�������
      let actualUrlStr = decodeURIComponent(url.pathname.replace("/", ""));
      actualUrlStr = ensureProtocol(actualUrlStr, url.protocol);
      const targetUrl = new URL(actualUrlStr);

      if (!whitelist.includes(targetUrl.hostname)) {
          return new Response('This site is not allowed.', {
              status: 403,
              statusText: 'Forbidden',
              headers: {
                  'Content-Type': 'text/plain; charset=utf-8'
              }
          });
      }

      // ������ѯ����
      actualUrlStr += url.search;

      // ������ Headers �����ų��� 'cf-' ��ͷ������ͷ
      const newHeaders = filterHeaders(request.headers, name => !name.startsWith('cf-'));

      // ����һ���µ������Է���Ŀ�� URL
      const modifiedRequest = new Request(actualUrlStr, {
          headers: newHeaders,
          method: request.method,
          body: request.body,
          redirect: 'manual'
      });

      // �����Ŀ�� URL ������
      const response = await fetch(modifiedRequest);
      let body = response.body;

      // �����ض���
      if ([301, 302, 303, 307, 308].includes(response.status)) {
          body = response.body;
          // �����µ� Response �������޸� Location ͷ��
          return handleRedirect(response, body);
      } else if (response.headers.get("Content-Type")?.includes("text/html")) {
          body = await handleHtmlContent(response, url.protocol, url.host, actualUrlStr);
      }

      // �����޸ĺ����Ӧ����
      const modifiedResponse = new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
      });

      // ��ӽ��û����ͷ��
      setNoCacheHeaders(modifiedResponse.headers);

      // ��� CORS ͷ��������������
      setCorsHeaders(modifiedResponse.headers);

      return modifiedResponse;
  } catch (error) {
      console.error('Error:', error);
      return new Response('Internal Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
          headers: {
              'Content-Type': 'text/plain; charset=utf-8'
          }
      });
  }
}

// ȷ�� URL ����Э��
function ensureProtocol(url, defaultProtocol) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : defaultProtocol + "//" + url;
}

// �����ض���
function handleRedirect(response, body) {
  const location = new URL(response.headers.get('location'));
  const modifiedLocation = `/${encodeURIComponent(location.toString())}`;
  return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
          ...response.headers,
          'Location': modifiedLocation
      }
  });
}

// ���� HTML �����е����·��
async function handleHtmlContent(response, protocol, host, actualUrlStr) {
  const originalText = await response.text();
  const regex = new RegExp('((href|src|action)=["\'])/(?!/)', 'g');
  let modifiedText = replaceRelativePaths(originalText, protocol, host, new URL(actualUrlStr).origin);

  return modifiedText;
}

// �滻 HTML �����е����·��
function replaceRelativePaths(text, protocol, host, origin) {
  const regex = new RegExp('((href|src|action)=["\'])/(?!/)', 'g');
  return text.replace(regex, `$1${protocol}//${host}/${origin}/`);
}

// ���� JSON ��ʽ����Ӧ
function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
      status: status,
      headers: {
          'Content-Type': 'application/json; charset=utf-8'
      }
  });
}

// ��������ͷ
function filterHeaders(headers, filterFunc) {
  return new Headers([...headers].filter(([name]) => filterFunc(name)));
}

// ���ý��û����ͷ��
function setNoCacheHeaders(headers) {
  headers.set('Cache-Control', 'no-store');
}

// ���� CORS ͷ��
function setCorsHeaders(headers) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  headers.set('Access-Control-Allow-Headers', '*');
}

// ���ظ�Ŀ¼�� HTML
function getRootHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Cloudflare Workers Proxy</title>
</head>
<body>
  <h1>��ӭʹ�� Cloudflare Workers Proxy</h1>
  <!-- ��������������ҳ���������� -->
</body>
</html>`;
}
