export const environment = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "https://apimedicapslms.chetancj.in",
  backupApiUrl: process.env.NEXT_PUBLIC_BACKUP_API_URL || "http://localhost:8000",
} as const;
