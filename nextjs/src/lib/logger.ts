/**
 * VeilForms - Edge-Compatible Structured Logging
 * Simple logger that works in both Node.js and Edge Runtime
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  context?: string;
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const enableLogs = !isTest || process.env.ENABLE_TEST_LOGS === 'true';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL as LogLevel] ?? (isProduction ? 1 : 0);

function formatMessage(level: LogLevel, context: string | undefined, message: string, data?: object): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? `[${context}]` : '';
  const dataStr = data && Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
  return `${timestamp} ${level.toUpperCase()} ${contextStr} ${message}${dataStr}`;
}

function shouldLog(level: LogLevel): boolean {
  return enableLogs && LOG_LEVELS[level] >= currentLevel;
}

class Logger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  child(ctx: LogContext): Logger {
    return new Logger(ctx.context || this.context);
  }

  debug(dataOrMessage: object | string, message?: string): void {
    if (!shouldLog('debug')) return;
    const { msg, data } = this.parseArgs(dataOrMessage, message);
    console.debug(formatMessage('debug', this.context, msg, data));
  }

  info(dataOrMessage: object | string, message?: string): void {
    if (!shouldLog('info')) return;
    const { msg, data } = this.parseArgs(dataOrMessage, message);
    console.info(formatMessage('info', this.context, msg, data));
  }

  warn(dataOrMessage: object | string, message?: string): void {
    if (!shouldLog('warn')) return;
    const { msg, data } = this.parseArgs(dataOrMessage, message);
    console.warn(formatMessage('warn', this.context, msg, data));
  }

  error(dataOrMessage: object | string, message?: string): void {
    if (!shouldLog('error')) return;
    const { msg, data } = this.parseArgs(dataOrMessage, message);
    console.error(formatMessage('error', this.context, msg, data));
  }

  private parseArgs(dataOrMessage: object | string, message?: string): { msg: string; data?: object } {
    if (typeof dataOrMessage === 'string') {
      return { msg: dataOrMessage };
    }
    return { msg: message || '', data: dataOrMessage };
  }
}

export const logger = new Logger();

/**
 * Create a child logger with a specific context
 */
export const createLogger = (context: string) => new Logger(context);

// Pre-configured loggers for common contexts
export const authLogger = createLogger('auth');
export const storageLogger = createLogger('storage');
export const apiLogger = createLogger('api');
export const webhookLogger = createLogger('webhook');
export const billingLogger = createLogger('billing');
