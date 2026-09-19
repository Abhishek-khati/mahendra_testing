import client from "prom-client";

// Create a custom Prometheus registry
export const register = new client.Registry();

// Enable standard Node.js runtime metrics (memory, CPU, event loop, GC)
client.collectDefaultMetrics({
  register,
  prefix: "chainshield_",
});

// Custom HTTP Metrics
export const httpRequestsTotal = new client.Counter({
  name: "chainshield_http_requests_total",
  help: "Total number of HTTP requests received",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [register],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: "chainshield_http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// Custom Business & Security Scan Metrics
export const scanJobsTotal = new client.Counter({
  name: "chainshield_scan_jobs_total",
  help: "Total number of security scans handled",
  labelNames: ["status", "mode"] as const, // status: queued, processing, completed, failed | mode: live, simulated
  registers: [register],
});

export const scanDurationSeconds = new client.Histogram({
  name: "chainshield_scan_duration_seconds",
  help: "Duration of security scans in seconds",
  labelNames: ["mode"] as const,
  buckets: [0.5, 1, 2.5, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

export const activeScanJobs = new client.Gauge({
  name: "chainshield_active_scan_jobs",
  help: "Current number of actively executing scan jobs",
  registers: [register],
});

// Security & Archive Extraction Metrics
export const archiveExtractionsTotal = new client.Counter({
  name: "chainshield_archive_extractions_total",
  help: "Total archive extraction attempts and security filter results",
  labelNames: ["status"] as const, // success, bomb_rejected, invalid_archive
  registers: [register],
});

// Data Retention Metrics
export const retentionPurgedTotal = new client.Counter({
  name: "chainshield_retention_purged_runs_total",
  help: "Total historical scan runs purged by data retention job",
  registers: [register],
});
