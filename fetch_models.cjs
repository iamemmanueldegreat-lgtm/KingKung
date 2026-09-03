const https = require('https');
https.get('https://openrouter.ai/api/v1/models', (res) => {
  let data = '';
  res.on('data', (d) => data += d);
  res.on('end', () => {
    const models = JSON.parse(data).data;
    const free = models.filter(m => m.id.includes('free')).map(m => m.id);
    console.log(free.slice(0, 60).join('\n'));
  });
});
