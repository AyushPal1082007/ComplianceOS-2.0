export function safeHttpLogPath(req) {
  return (req.originalUrl || req.url || '').split('?')[0];
}

export default safeHttpLogPath;
