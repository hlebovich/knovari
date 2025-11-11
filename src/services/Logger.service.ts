export class LoggerService {
  private readonly prefix = "[SANITIZER]";

  log(message: string, ...data: unknown[]): void;
  log(...data: unknown[]): void;

  log(...args: unknown[]): void {
    if (typeof args[0] === "string") {
      const [message, ...data] = args;
      console.log(`${this.prefix} ${message}`, ...(data.length ? data : [""]));
    } else {
      const data = args;
      console.log(this.prefix, ...(data.length ? data : [""]));
    }
  }

  info(message: string, ...data: unknown[]): void;
  info(...data: unknown[]): void;

  info(...args: unknown[]): void {
    if (typeof args[0] === "string") {
      const [message, ...data] = args;
      console.info(`%c ${this.prefix} ${message}`, "color: blue", ...(data.length ? data : [""]));
    } else {
      const data = args;
      console.info(`%c ${this.prefix}`, "color: blue", ...(data.length ? data : [""]));
    }
  }

  warn(message: string, ...data: unknown[]): void;
  warn(...data: unknown[]): void;

  warn(...args: unknown[]): void {
    if (typeof args[0] === "string") {
      const [message, ...data] = args;
      console.warn(`${this.prefix} ${message}`, ...(data.length ? data : [""]));
    } else {
      const data = args;
      console.warn(this.prefix, ...(data.length ? data : [""]));
    }
  }

  error(message: string, ...data: unknown[]): void;
  error(...data: unknown[]): void;

  error(...args: unknown[]): void {
    if (typeof args[0] === "string") {
      const [message, ...data] = args;
      console.error(`${this.prefix} ${message}`, ...(data.length ? data : [""]));
    } else {
      const data = args;
      console.error(this.prefix, ...(data.length ? data : [""]));
    }
  }
}
