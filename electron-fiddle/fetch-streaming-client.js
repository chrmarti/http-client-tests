const fs = require('fs');
const path = require('path');
const { Agent } = require('undici');

const useHttp2 = true;
const useElectronFetch = true;

const HTTPS_PORT = 3443;
const HTTP2_PORT = 3444;

// Get the appropriate fetch implementation
const fetchImpl = useElectronFetch ? require('electron').net.fetch : fetch;

const port = useHttp2 ? HTTP2_PORT : HTTPS_PORT;

// Create a custom undici agent with the certificate
const agent = new Agent({
  connect: {
    ca: fs.readFileSync(path.join('/Users/chrmarti/Development/repos/http-client-tests', 'server_localhost_crt.pem'))
  },
  allowH2: useHttp2
});

console.log(`Connecting to ${useHttp2 ? 'HTTP/2' : 'HTTPS/1.1'} streaming server on https://localhost:${port} using ${useElectronFetch ? 'Electron' : 'Node.js'} fetch`);

async function streamWithFetch() {
  try {
    const fetchOptions = useElectronFetch 
      ? {} 
      : { dispatcher: agent };
    
    const response = await fetchImpl(`https://localhost:${port}`, fetchOptions);

    console.log(`Status: ${response.status}`);
    console.log('Headers:', Object.fromEntries(response.headers));
    console.log('\nStreaming response:');

    const stats = {
      useElectronFetch,
      useHttp2,
    };
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      stats[value.length] = (stats[value.length] || 0) + 1;
      // process.stdout.write(new TextDecoder().decode(value));
    }

    console.log(`Response stats: ${JSON.stringify(stats, null, 2)}`);
    console.log('\n\nStream ended.');
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
