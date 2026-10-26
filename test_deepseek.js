const http = require('http');

const data = JSON.stringify({
  messages: [{ role: 'user', content: 'Reply with exactly: NVIDIA_OK' }],
  model: 'deepseek-ai/deepseek-v4.1-flash',
  temperature: 0,
  max_tokens: 64,
  stream: true
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    process.stdout.write(chunk);
  });
  
  res.on('end', () => {
    console.log('\n--- Request complete ---');
  });
});

req.on('error', (error) => {
  console.error(`Error: ${error.message}`);
});

req.write(data);
req.end();
