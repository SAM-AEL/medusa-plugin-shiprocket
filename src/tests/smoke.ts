import assert from "node:assert/strict"
import { isValidAwb } from "../shared/http"
import { isRetryableShiprocketStatus } from "../providers/shiprocket/client/config"

assert.equal(isValidAwb("AWB123456"), true)
assert.equal(isValidAwb("bad"), false)
assert.equal(isRetryableShiprocketStatus(503), true)
assert.equal(isRetryableShiprocketStatus(404), false)

console.log("ms smoke test passed")
