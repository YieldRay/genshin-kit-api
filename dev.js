//! This script is only for local development
const http = require("http");
const handler = require("./vercel");
const PORT = process.env.PORT ?? 8080;
console.log(`http://localhost:${PORT}`);
http.createServer(handler).listen(PORT);
