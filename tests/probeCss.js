const http = require('http');

setTimeout(async () => {
  http.get('http://localhost:3000/css/style.css', (res) => {
    console.log('STATUS:', res.statusCode);
    console.log('CONTENT-TYPE:', res.headers['content-type']);
    let len = 0;
    res.on('data', chunk => len += chunk.length);
    res.on('end', () => {
      console.log('TOTAL BYTES:', len);
      process.exit(0);
    });
  }).on('error', (e) => {
    console.log('CONNECT ERROR:', e.message);
    process.exit(1);
  });
}, 2000);
