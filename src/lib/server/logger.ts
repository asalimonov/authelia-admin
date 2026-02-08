/**
 * Minimal logging module for Authelia Admin
 *
 * Log levels: DEBUG, INFO, WARN, ERROR
 * Default level: WARN
 *
 * Configuration:
 * - Environment variable: AAD_LOGLEVEL
 * - Config file: logging_level field in config.yml
 */

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
	[LogLevel.DEBUG]: 'DEBUG',
	[LogLevel.INFO]: 'INFO',
	[LogLevel.WARN]: 'WARN',
	[LogLevel.ERROR]: 'ERROR'
};

// Default logging level
const DEFAULT_LOG_LEVEL = LogLevel.WARN;

// Module-level state
let currentLogLevel: LogLevel = DEFAULT_LOG_LEVEL;
let isInitialized = false;

/**
 * Parse log level string to enum value
 */
function parseLogLevel(level: string | undefined): LogLevel {
	if (!level) {
		return DEFAULT_LOG_LEVEL;
	}

	switch (level.toUpperCase()) {
		case 'DEBUG':
			return LogLevel.DEBUG;
		case 'INFO':
			return LogLevel.INFO;
		case 'WARN':
		case 'WARNING':
			return LogLevel.WARN;
		case 'ERROR':
			return LogLevel.ERROR;
		default:
			return DEFAULT_LOG_LEVEL;
	}
}

/**
 * Initialize logging level from environment variable.
 * Config file level is set separately via setLogLevel().
 */
function initFromEnvironment(): void {
	if (isInitialized) {
		return;
	}

	const envLevel = process.env.AAD_LOGLEVEL;
	if (envLevel) {
		currentLogLevel = parseLogLevel(envLevel);
	}

	isInitialized = true;
}

/**
 * Set log level programmatically (e.g., from config file).
 * Environment variable takes precedence if set.
 */
export function setLogLevel(level: string | LogLevel): void {
	// Environment variable takes precedence
	if (process.env.AAD_LOGLEVEL) {
		currentLogLevel = parseLogLevel(process.env.AAD_LOGLEVEL);
		return;
	}

	if (typeof level === 'string') {
		currentLogLevel = parseLogLevel(level);
	} else {
		currentLogLevel = level;
	}
}

/**
 * Get current log level
 */
export function getLogLevel(): LogLevel {
	initFromEnvironment();
	return currentLogLevel;
}

/**
 * Get current log level as string
 */
export function getLogLevelName(): string {
	return LOG_LEVEL_NAMES[getLogLevel()];
}

/**
 * Format log message with timestamp, level, and component
 */
function formatMessage(level: LogLevel, component: string, message: string): string {
	const timestamp = new Date().toISOString();
	const levelName = LOG_LEVEL_NAMES[level];
	return `${timestamp} [${levelName}] [${component}] ${message}`;
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
	initFromEnvironment();
	return level >= currentLogLevel;
}

/**
 * Create a logger instance for a specific component
 */
export function createLogger(component: string) {
	return {
		debug(message: string, ...args: unknown[]): void {
			if (shouldLog(LogLevel.DEBUG)) {
				console.debug(formatMessage(LogLevel.DEBUG, component, message), ...args);
			}
		},

		info(message: string, ...args: unknown[]): void {
			if (shouldLog(LogLevel.INFO)) {
				console.info(formatMessage(LogLevel.INFO, component, message), ...args);
			}
		},

		warn(message: string, ...args: unknown[]): void {
			if (shouldLog(LogLevel.WARN)) {
				console.warn(formatMessage(LogLevel.WARN, component, message), ...args);
			}
		},

		error(message: string, ...args: unknown[]): void {
			if (shouldLog(LogLevel.ERROR)) {
				console.error(formatMessage(LogLevel.ERROR, component, message), ...args);
			}
		}
	};
}

/**
 * Reset logger state (for testing)
 */
export function resetLogger(): void {
	currentLogLevel = DEFAULT_LOG_LEVEL;
	isInitialized = false;
}

export type Logger = ReturnType<typeof createLogger>;
