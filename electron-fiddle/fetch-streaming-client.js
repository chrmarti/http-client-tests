const fs = require('fs');
const path = require('path');
const { Agent } = require('undici');

const useHttp2 = true;
const useElectronFetch = true;
const ttfbMeasurement = false;

const numberOfRequests = ttfbMeasurement ? 1000 : 1;
const chunksPerRequest = ttfbMeasurement ? 10 : undefined;

const HTTPS_PORT = 3443;
const HTTP2_PORT = 3444;

// Get the appropriate fetch implementation
const fetchImpl = useElectronFetch ? require('electron').net.fetch : fetch;

const port = useHttp2 ? HTTP2_PORT : HTTPS_PORT;

// Create a custom undici agent with the certificate
const agent = new Agent({
  connect: {
    ca: fs.readFileSync('../server_localhost_crt.pem')
  },
  allowH2: useHttp2
});

console.log(`Connecting to ${useHttp2 ? 'HTTP/2' : 'HTTPS/1.1'} streaming server on https://localhost:${port} using ${useElectronFetch ? 'Electron' : 'Node.js'} fetch`);

async function streamWithFetch() {
  try {
    const fetchOptions = useElectronFetch 
      ? {} 
      : { dispatcher: agent };
    
    const url = chunksPerRequest !== undefined 
      ? `https://localhost:${port}?chunks=${chunksPerRequest}`
      : `https://localhost:${port}`;

    const stats = {
      useElectronFetch,
      useHttp2,
      chunks: {},
      ttfb: {},
    };

    for (let i = 0; i < numberOfRequests; i++) {
      const start = Date.now();
      const response = await fetchImpl(url, fetchOptions);

      if ((i + 1) % 100 === 0) {
        console.log(`Run ${i + 1}: Status: ${response.status}`);
        // console.log('Headers:', Object.fromEntries(response.headers));
      }

      const reader = response.body.getReader();

      let firstByteSeen = false;
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
