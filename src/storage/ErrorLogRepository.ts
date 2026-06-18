import type { ErrorLogEntry } from '@/types';
import type { StorageArea } from './StorageArea';

const LOGS_KEY = 'skipper:error_logs';
const MAX_LOGS = 50; // Keep the last 50 logs

export class ErrorLogRepository {
  constructor(private readonly storage: StorageArea) {}

  async getLogs(): Promise<ErrorLogEntry[]> {
    const logs = await this.storage.get<ErrorLogEntry[]>(LOGS_KEY);
    return logs ?? [];
  }

  async addLog(log: Omit<ErrorLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const currentLogs = await this.getLogs();
    const newEntry: ErrorLogEntry = {
      ...log,
      id: typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
    };
    const updatedLogs = [newEntry, ...currentLogs].slice(0, MAX_LOGS);
    await this.storage.set({ [LOGS_KEY]: updatedLogs });
  }

  async clear(): Promise<void> {
    await this.storage.remove(LOGS_KEY);
  }
}
