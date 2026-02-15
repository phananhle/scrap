/**
 * Request logging middleware. Logs method, path, status, duration, and optional body/query.
 * Use after express.json() so req.body is available.
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  const method = req.method;
  const path = req.originalUrl || req.url;
  const hasBody = method !== 'GET' && req.body != null && Object.keys(req.body).length > 0;
  const hasQuery = req.query != null && Object.keys(req.query).length > 0;

  const logLine = () => {
    const durationMs = Date.now() - start;
    const status = res.statusCode;
    const statusColor = status >= 500 ? 31 : status >= 400 ? 33 : 32; // red / yellow / green
    const parts = [
      new Date().toISOString(),
      method.padEnd(6),
      path,
      `\x1b[${statusColor}m${status}\x1b[0m`,
      `${durationMs}ms`,
    ];
    if (hasQuery) parts.push(`query=${JSON.stringify(req.query)}`);
    if (hasBody) parts.push(`body=${JSON.stringify(req.body)}`);
    console.log(parts.join(' '));
    // Explicit log for GCal events so mobile getGcalEvents calls are easy to verify
    if (path.startsWith('/gcal/events') || path === '/gcal/events') {
      console.log('[requestLogger] GCal events request', { method, path, query: req.query, status: res.statusCode, durationMs });
    }
  };

  res.on('finish', logLine);
  res.on('close', () => {
    if (!res.writableEnded) logLine();
  });
  next();
}
