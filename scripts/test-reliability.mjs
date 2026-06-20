import http from "node:http";
import https from "node:https";

const baseUrl = new URL(process.env.APP_BASE_URL ?? "http://127.0.0.1:3020");
const transport = baseUrl.protocol === "https:" ? https : http;
const defaultPort = baseUrl.protocol === "https:" ? 443 : 80;
const endpoints = ["/mobile", "/dashboard", "/admin/rooms", "/admin/templates"];

function readPositiveInt(value, fallback) {
  const number = Number(value ?? fallback);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function requestOnce(path) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const request = transport.get(
      {
        host: baseUrl.hostname,
        port: Number(baseUrl.port || defaultPort),
        path,
        timeout: 8000,
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          resolve({ path, status: response.statusCode, ms: Number(process.hrtime.bigint() - started) / 1e6 });
        });
      },
    );

    request.on("timeout", () => {
      request.destroy();
      resolve({ path, status: 0, ms: 8000, timeout: true });
    });
    request.on("error", (error) => {
      resolve({ path, status: 0, ms: Number(process.hrtime.bigint() - started) / 1e6, error: error.code || error.message });
    });
  });
}

async function main() {
  const smoke = [];
  for (const endpoint of endpoints) smoke.push(await requestOnce(endpoint));
  const smokeFailures = smoke.filter((result) => result.status !== 200);

  const total = readPositiveInt(process.env.LOAD_TOTAL, 120);
  const concurrency = readPositiveInt(process.env.LOAD_CONCURRENCY, 12);
  const loadResults = [];
  let next = 0;

  async function worker() {
    while (next < total) {
      const index = next++;
      loadResults.push(await requestOnce(endpoints[index % endpoints.length]));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  const failed = loadResults.filter((result) => result.status !== 200);
  const latencies = loadResults.map((result) => result.ms).sort((a, b) => a - b);
  const percentile = (q) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))].toFixed(1);

  const summary = {
    baseUrl: baseUrl.toString(),
    smoke,
    load: {
      total,
      concurrency,
      ok: loadResults.length - failed.length,
      failed: failed.length,
      p50_ms: percentile(0.5),
      p95_ms: percentile(0.95),
      max_ms: latencies.at(-1).toFixed(1),
      sampleFailures: failed.slice(0, 5),
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  if (smokeFailures.length > 0 || failed.length > 0) process.exit(1);
}

main();
