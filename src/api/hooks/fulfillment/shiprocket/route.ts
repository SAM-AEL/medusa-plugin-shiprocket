import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import crypto from "crypto"
import { fail, isValidAwb, ok } from "../../../../shared/http"

// Module identifier - must match what's registered in medusa-config.ts
const SHIPROCKET_TRACKING_MODULE = "shiprocketTrackingModuleService"
export const AUTHENTICATE = false

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses crypto.timingSafeEqual to ensure comparison time is independent of input values.
 */
function constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(
        Buffer.from(a, 'utf8'),
        Buffer.from(b, 'utf8')
    )
}

interface ShiprocketWebhookScan {
    date: string
    status: string
    activity: string
    location: string
    "sr-status": string
    "sr-status-label": string
}

interface ShiprocketWebhookPayload {
    awb: string
    courier_name: string
    current_status: string
    current_status_id: number
    shipment_status: string
    shipment_status_id: number
    current_timestamp: string
    order_id: string
    sr_order_id: number
    awb_assigned_date?: string
    pickup_scheduled_date?: string
    etd?: string
    scans: ShiprocketWebhookScan[]
    is_return: 0 | 1
    channel_id?: number
    pod_status?: string
    pod?: string
}

const WEBHOOK_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000
const processedWebhookKeys = new Map<string, number>()

function cleanupProcessedWebhookKeys() {
    const now = Date.now()
    for (const [key, expiresAt] of processedWebhookKeys.entries()) {
        if (expiresAt <= now) {
            processedWebhookKeys.delete(key)
        }
    }
}

function getIdempotencyKey(payload: ShiprocketWebhookPayload): string {
    return `${payload.awb}:${payload.current_status_id || payload.current_status}:${payload.current_timestamp || "na"}`
}

/**
 * Shiprocket Webhook Endpoint
 * 
 * URL: POST /store/shiprocket/hook
 * 
 * Receives real-time shipment status updates from Shiprocket.
 * Token is validated via x-api-key header against SHIPROCKET_WEBHOOK_TOKEN env var.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
    const logger = req.scope.resolve("logger")

    try {
        // Validate webhook token
        const token = req.headers["x-api-key"] as string
        const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN

        if (!expectedToken) {
            logger.warn("Shiprocket webhook: SHIPROCKET_WEBHOOK_TOKEN not configured")
            return fail(res, 500, "WEBHOOK_NOT_CONFIGURED", "Webhook not configured")
        }

        if (!token || !constantTimeCompare(token, expectedToken)) {
            logger.warn("Shiprocket webhook: Invalid or missing token")
            return fail(res, 401, "UNAUTHORIZED", "Unauthorized")
        }

        // Parse webhook payload
        const payload = req.body as ShiprocketWebhookPayload

        if (!payload?.awb || !isValidAwb(payload.awb)) {
            logger.warn("Shiprocket webhook: Missing or invalid AWB in payload")
            return fail(res, 400, "INVALID_PAYLOAD", "Invalid payload - missing or invalid AWB")
        }

        if (!payload.current_status || !payload.shipment_status) {
            return fail(res, 400, "INVALID_PAYLOAD", "Invalid payload - missing shipment status")
        }

        cleanupProcessedWebhookKeys()
        const idemKey = getIdempotencyKey(payload)
        if (processedWebhookKeys.has(idemKey)) {
            return ok(res, {
                message: "Webhook already processed",
                awb: payload.awb,
            })
        }
        processedWebhookKeys.set(idemKey, Date.now() + WEBHOOK_IDEMPOTENCY_TTL_MS)

        if (processedWebhookKeys.size > 10000) {
            cleanupProcessedWebhookKeys()
        }

        logger.info(
            `Shiprocket webhook: Received update for AWB ${payload.awb} - ` +
            `Status: ${payload.current_status} (${payload.shipment_status_id})`
        )

        // Get tracking service
        const trackingService = req.scope.resolve<any>(SHIPROCKET_TRACKING_MODULE)

        // Parse dates from Shiprocket format
        const parseDate = (dateStr?: string): Date | undefined => {
            if (!dateStr) return undefined

            // Handle "DD MM YYYY HH:mm:ss" format
            if (dateStr.match(/^\d{2} \d{2} \d{4}/)) {
                const [d, m, y, time] = dateStr.split(" ")
                return new Date(`${y}-${m}-${d}T${time || "00:00:00"}`)
            }

            // Handle "YYYY-MM-DD HH:mm:ss" format
            return new Date(dateStr)
        }

        // Extract Medusa Order ID from "order_id-timestamp" format
        // Shiprocket order_id is usually "order_id-timestamp" to ensure uniqueness
        let medusaOrderId = payload.order_id
        if (payload.order_id && payload.order_id.includes("-")) {
            const parts = payload.order_id.split("-")
            const lastPart = parts[parts.length - 1]
            // If last part is numeric timestamp, remove it
            if (/^\d+$/.test(lastPart)) {
                parts.pop()
                medusaOrderId = parts.join("-")
            }
        }

        // Upsert tracking record
        const tracking = await trackingService.upsertByAwb({
            awb: payload.awb,
            order_id: payload.order_id,
            medusa_order_id: medusaOrderId, // Linked Medusa Order ID
            sr_order_id: payload.sr_order_id ? Number(payload.sr_order_id) : undefined,
            courier_name: payload.courier_name,
            current_status: payload.current_status,
            current_status_id: payload.current_status_id ? Number(payload.current_status_id) : undefined,
            shipment_status: payload.shipment_status,
            shipment_status_id: payload.shipment_status_id ? Number(payload.shipment_status_id) : undefined,
            current_timestamp: parseDate(payload.current_timestamp),
            etd: parseDate(payload.etd),
            awb_assigned_date: parseDate(payload.awb_assigned_date),
            pickup_scheduled_date: parseDate(payload.pickup_scheduled_date),
            scans: payload.scans || [],
            pod_status: payload.pod_status,
            pod: payload.pod,
            is_return: payload.is_return === 1,
            channel_id: payload.channel_id ? Number(payload.channel_id) : undefined,
            raw_payload: payload,
        })


        logger.info(
            `Shiprocket webhook: Tracking updated for AWB ${payload.awb} - ` +
            `Record ID: ${tracking.id}`
        )

        // Emit event for subscribers to handle
        // Emit event for subscribers to handle
        try {
            // Try v2 resolution first
            let eventBus: any = undefined;
            try {
                eventBus = req.scope.resolve("event_bus");
            } catch (e) {
                // Fallback to v1
                try {
                    eventBus = req.scope.resolve("eventBusService");
                } catch (e2) {
                    logger.warn("Shiprocket webhook: Event bus not found, skipping event emission");
                }
            }

            if (eventBus && (eventBus as any).emit) {
                await (eventBus as any).emit("shiprocket.tracking.updated", {
                    awb: payload.awb,
                    tracking_id: tracking.id,
                    current_status: payload.current_status,
                    shipment_status_id: payload.shipment_status_id,
                })
            }
        } catch (eventErr) {
            logger.warn(`Shiprocket webhook: Failed to emit event: ${(eventErr as Error).message}`)
        }


        return ok(res, {
            message: "Webhook processed",
            awb: payload.awb,
        }, 200)
    } catch (error: any) {
        logger.error(`Shiprocket webhook error: ${error.message}`, error)
        return fail(res, 500, "INTERNAL_ERROR", "Internal server error")
    }
}
