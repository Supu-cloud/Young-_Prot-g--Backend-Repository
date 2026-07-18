const ts = () => new Date().toISOString();

export const logger = {
  info:    (msg: string) => console.log(`[INFO]  ${ts()} — ${msg}`),
  error:   (msg: string, err?: unknown) => console.error(`[ERROR] ${ts()} — ${msg}`, err ?? ''),
  warn:    (msg: string) => console.warn(`[WARN]  ${ts()} — ${msg}`),
  success: (msg: string) => console.log(`[OK]    ${ts()} — ${msg}`),
};