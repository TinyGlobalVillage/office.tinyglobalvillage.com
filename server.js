// app.js
const http = require('http');
const path = require('path');
const next = require('next');

// Ensure the “dir” is your project root (where .next and src/ live)
const projectRoot = path.resolve(__dirname);

const app = next({
  dev: false,
  dir: projectRoot, // ← point at ~/refusionist.com
});
const handle = app.getRequestHandler();

const port = parseInt(process.env.PORT, 10) || 32674;

app.prepare().then(() => {
  http
    .createServer((req, res) => {
      return handle(req, res);
    })
    .listen(port, () => {
      console.log(
        `🚀 Server ready on http://localhost:${port}`
      );
    });
});
