import http from "node:http";
import https from "node:https";

const baseUrl = new URL(process.env.APP_BASE_URL ?? "http://127.0.0.1:3010");
const transport = baseUrl.protocol === "https:" ? https : http;
const defaultPort = baseUrl.protocol === "https:" ? 443 : 80;
const requiredHeaders = [
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
  "content-security-policy",
];

function request(path) {
  return new Promise((resolve) => {
    const req = transport.get(
      {
        host: baseUrl.hostname,
        port: Number(baseUrl.port || defaultPort),
        path,
        timeout: 5000,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk.slice(0, 200);
        });
        response.on("end", () => resolve({ path, status: response.statusCode, headers: response.headers, body: body.slice(0, 160) }));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ path, status: 0, timeout: true, headers: {}, body: "" });
    });
    req.on("error", (error) => resolve({ path, status: 0, error: error.code || error.message, headers: {}, body: "" }));
  });
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

async function main() {
  const checks = [];
  const failures = [];

  const mobile = await request("/mobile");
  checks.push({ name: "security_headers_mobile", status: mobile.status, headers: Object.fromEntries(requiredHeaders.map((h) => [h, mobile.headers[h] ?? null])) });
  for (const header of requiredHeaders) assert(Boolean(mobile.headers[header]), `Missing header ${header} on /mobile`, failures);
  assert(mobile.headers["x-content-type-options"] === "nosniff", "x-content-type-options must be nosniff", failures);
  assert(mobile.headers["x-frame-options"] === "DENY", "x-frame-options must be DENY", failures);

  const probes = [
    { path: "/api/uploads/%2e%2e/%2e%2e/%2e%2e/etc/passwd", allowedStatuses: [403, 404] },
    { path: "/api/uploads/../../../../etc/passwd", allowedStatuses: [403, 404] },
    { path: "/api/uploads/not-image.txt", allowedStatuses: [415] },
    { path: "/api/rooms/not-a-room/qr", allowedStatuses: [404] },
  ];

  for (const probe of probes) {
    const result = await request(probe.path);
    checks.push({ name: `probe ${probe.path}`, status: result.status, contentType: result.headers["content-type"] ?? null, body: result.body });
    assert(probe.allowedStatuses.includes(result.status), `${probe.path} returned ${result.status}`, failures);
    assert(!String(result.body).includes("root:x:"), `${probe.path} leaked /etc/passwd content`, failures);
  }

  const summary = { baseUrl: baseUrl.toString(), failures, checks };
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length > 0) process.exit(1);
}

main();
