export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  videoId?: string;
  videoTitle?: string;
  errorMessage: string;
  analysisMode?: string;
}
