export const environment = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "https://apimedicapslms.chetancj.in",
  backupApiUrl: process.env.NEXT_PUBLIC_BACKUP_API_URL || "",
} as const;
