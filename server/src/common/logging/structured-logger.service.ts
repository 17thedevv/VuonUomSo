import { Injectable, LoggerService, LogLevel } from "@nestjs/common";

export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  context?: string;
  message: string;
  requestId?: string;
  stack?: string;
  [key: string]: unknown;
}

export function redactSensitiveData(input: string): string {
  if (!input) return input;

  return input
    // Redact Bearer authorization tokens
    .replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+/gi, "Bearer [REDACTED]")
    // Redact raw JWT tokens
    .replace(/eyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+/g, "[REDACTED_JWT]")
    // Redact database passwords in postgresql:// connection strings
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/gi, "$1***$2")
    // Redact password or secret key-value pairs
    .replace(/(["']?(?:password|secret|token|apiKey)["']?\s*[:=]\s*["'])([^"']+)(["'])/gi, "$1[REDACTED]$3");
}

@Injectable()
export class StructuredLogger implements LoggerService {
  private logLevels: LogLevel[] = ["log", "error", "warn", "debug", "verbose"];

  setLogLevels(levels: LogLevel[]): void {
    this.logLevels = levels;
  }

  log(message: any, context?: string): void {
    this.write("INFO", message, context);
  }

  error(message: any, stack?: string, context?: string): void {
    this.write("ERROR", message, context, stack);
  }

  warn(message: any, context?: string): void {
    this.write("WARN", message, context);
  }

  debug?(message: any, context?: string): void {
    this.write("DEBUG", message, context);
  }

  verbose?(message: any, context?: string): void {
    this.write("VERBOSE", message, context);
  }

  public formatEntry(level: string, message: any, context?: string, stack?: string): StructuredLogEntry {
    let requestId: string | undefined = undefined;
    let textMessage = typeof message === "string" ? message : JSON.stringify(message);

    const reqMatch = textMessage.match(/^\[([0-9a-fA-F-]{36})\]\s*(.*)$/);
    if (reqMatch) {
      requestId = reqMatch[1];
      textMessage = reqMatch[2];
    }

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: context || "Application",
      message: redactSensitiveData(textMessage),
    };

    if (requestId) {
      entry.requestId = requestId;
    }

    if (stack) {
      entry.stack = redactSensitiveData(stack);
    }

    return entry;
  }

  private write(level: string, message: any, context?: string, stack?: string): void {
    const entry = this.formatEntry(level, message, context, stack);
    const json = JSON.stringify(entry);
    if (level === "ERROR") {
      process.stderr.write(json + "\n");
    } else {
      process.stdout.write(json + "\n");
    }
  }
}
