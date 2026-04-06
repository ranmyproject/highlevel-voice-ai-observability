type LogLevel = "info" | "warn" | "error" | "debug";

function formatMessage(level: LogLevel, context: string, message: string, meta?: object): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

export const logger = {
  info(context: string, message: string, meta?: object): void {
    console.log(formatMessage("info", context, message, meta));
  },
  warn(context: string, message: string, meta?: object): void {
    console.warn(formatMessage("warn", context, message, meta));
  },
  error(context: string, message: string, meta?: object): void {
    console.error(formatMessage("error", context, message, meta));
  },
  debug(context: string, message: string, meta?: object): void {
    if (process.env.NODE_ENV !== "production") {
      console.debug(formatMessage("debug", context, message, meta));
    }
  }
};
