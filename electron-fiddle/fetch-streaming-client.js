const fs = require('fs');
const path = require('path');
const { Agent } = require('undici');
const helixFetch = require('@adobe/helix-fetch');

const useHttp2 = true;
const ttfbMeasurement = true;

const numberOfRequests = ttfbMeasurement ? 100 : 1;
const chunksPerRequest = ttfbMeasurement ? 10 : undefined;

const HTTPS_PORT = 3443;
const HTTP2_PORT = 3444;

// Get the appropriate fetch implementation
function getFetchImpl(httpClient) {
  switch (httpClient) {
    case 'electron':
      return require('electron').net.fetch;
    case 'node':
      return fetch;
    case 'helix':
      return helixFetch.fetch;
    default:
      throw new Error(`Unknown HTTP client: ${httpClient}`);
  }
}

const port = useHttp2 ? HTTP2_PORT : HTTPS_PORT;

// Create a custom undici agent with the certificate
const agent = new Agent({
  connect: {
    ca: fs.readFileSync('../server_localhost_crt.pem')
  },
  allowH2: useHttp2
});

// Create Helix fetch context with SSL certificate
const helixContext = helixFetch.context({
  ca: fs.readFileSync('../server_localhost_crt.pem'),
});

async function streamWithFetch() {
  const clients = ['electron', 'node', 'helix'];
  const results = {};

  for (const client of clients) {
    try {
      results[client] = await streamWithFetchClient(client);
    } catch (err) {
      results[client] = { error: err.message };
    }
  }

  console.log('All client results:', JSON.stringify(results, null, 2));
  return results;
}

async function streamWithFetchClient(httpClient = 'helix') {
  console.log(`Connecting to ${useHttp2 ? 'HTTP/2' : 'HTTPS/1.1'} streaming server on https://localhost:${port} using ${httpClient} fetch`);
  try {
    // Configure fetch options based on the selected HTTP client
    let fetchOptions = {};
    let currentFetchImpl = getFetchImpl(httpClient);
    
    switch (httpClient) {
      case 'electron':
        fetchOptions = {};
        break;
      case 'node':
        fetchOptions = { dispatcher: agent };
        break;
      case 'helix':
        fetchOptions = {};
        currentFetchImpl = helixContext.fetch;
        break;
    }
    
    const url = chunksPerRequest !== undefined 
      ? `https://localhost:${port}?chunks=${chunksPerRequest}`
      : `https://localhost:${port}`;

    const stats = {
      httpClient,
      useHttp2,
      chunks: {},
      ttfb: {},
    };

    for (let i = 0; i < numberOfRequests; i++) {
      const start = Date.now();
      const response = await currentFetchImpl(url, fetchOptions);

      if ((i + 1) % 100 === 0) {
        console.log(`Run ${i + 1}: Status: ${response.status}`);
        // console.log('Headers:', Object.fromEntries(response.headers));
      }

      let firstByteSeen = false;

      // Handle different response body types
      if (httpClient === 'helix') {
        // Helix fetch returns a Node.js Readable stream
        for await (const chunk of response.body) {
          stats.chunks[chunk.length] = (stats.chunks[chunk.length] || 0) + 1;
          if (!firstByteSeen) {
            const time = Date.now() - start;
            stats.ttfb[time] = (stats.ttfb[time] || 0) + 1;
            firstByteSeen = true;
          }
        }
      } else {
        // Electron and Node.js fetch return web ReadableStream
        const reader = response.body.getReader();
        
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          stats.chunks[value.length] = (stats.chunks[value.length] || 0) + 1;
          if (!firstByteSeen) {
            const time = Date.now() - start;
            stats.ttfb[time] = (stats.ttfb[time] || 0) + 1;
            firstByteSeen = true;
          }
        }
      }
    }

    console.log(`Response stats: ${JSON.stringify(stats, null, 2)}`);
    return stats;

  } catch (err) {
    const messages = collectErrorMessages(err);
    console.error('Fetch error:', messages);
    throw new Error(messages);
  }
}

function collectErrorMessages(e) {
	// Collect error messages from nested errors as seen with Node's `fetch`.
	const seen = new Set();
	function collect(e, indent) {
		if (!e || !['object', 'string'].includes(typeof e) || seen.has(e)) {
			return '';
		}
		seen.add(e);
		const message = typeof e === 'string' ? e : (e.stack || e.message || e.code || e.toString?.() || '');
		const messageStr = message?.toString?.() || '';
		return [
			messageStr ? `${messageStr.split('\n').map(line => `${indent}${line}`).join('\n')}\n` : '',
			collect(e.cause, indent + '  '),
			...(Array.isArray(e.errors) ? e.errors.map((e) => collect(e, indent + '  ')) : []),
		].join('');
	}
	return collect(e, '')
		.trim();
}

module.exports = { streamWithFetch };
