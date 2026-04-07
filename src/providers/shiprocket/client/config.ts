export const SHIPROCKET_DEFAULT_TIMEOUT_MS = Number(process.env.SHIPROCKET_API_TIMEOUT_MS || 15000)

export function isRetryableShiprocketStatus(status: number): boolean {
  return [408, 425, 429, 500, 502, 503, 504].includes(status)
}
