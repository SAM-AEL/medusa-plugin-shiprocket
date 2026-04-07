import type { MedusaContainer } from "@medusajs/framework/types"

const SHIPROCKET_TRACKING_MODULE = "shiprocketTrackingModuleService"

export default async function cleanupShiprocketWebhookPayloadsJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const trackingService = container.resolve<any>(SHIPROCKET_TRACKING_MODULE)
  const retentionDays = Math.max(1, Number(process.env.SHIPROCKET_WEBHOOK_PAYLOAD_RETENTION_DAYS || 30))
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  try {
    const [records] = await trackingService.listAndCountShiprocketTrackings(
      { created_at: { $lt: cutoff } },
      { take: 500, order: { created_at: "ASC" } }
    )

    const updates = (records || [])
      .filter((item: Record<string, unknown>) => !!item.raw_payload)
      .map((item: Record<string, unknown>) => ({
        id: item.id,
        raw_payload: null,
      }))

    if (!updates.length) {
      return
    }

    await trackingService.updateShiprocketTrackings(updates)
    logger.info(`[Shiprocket] Cleanup job cleared raw_payload for ${updates.length} records older than ${retentionDays} days`)
  } catch (error: any) {
    logger.error(`[Shiprocket] Cleanup webhook payload job failed: ${error.message}`)
  }
}

export const config = {
  name: "cleanup-shiprocket-webhook-payloads",
  schedule: "30 3 * * *",
}
