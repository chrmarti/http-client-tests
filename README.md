# Test Fetch Streaming

First time: Create a certificate and add it to the OS keychain/trust store (for Electron's fetch):
```sh
openssl req -x509 -newkey rsa:4096 -keyout server_localhost_key.pem -out server_localhost_crt.pem -days 365 -nodes -subj /CN=localhost -addext "subjectAltName=DNS:localhost"
```

Run server:
```sh
node http-streaming-server.js
```

Run Electron Fiddle from `electron-fiddle` folder. Change `useElectronFetch` and `useHttp2` flags in `fetch-streaming-client.js` to run different setups.
