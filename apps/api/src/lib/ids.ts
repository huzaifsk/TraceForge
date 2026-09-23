import { randomBytes } from "node:crypto"

const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz"
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

/**
 * Uniformly random string over `alphabet`. Uses rejection sampling so no
 * character is more likely than another (plain `byte % n` would be biased).
 */
function randomString(alphabet: string, length: number): string {
  const limit = 256 - (256 % alphabet.length)
  let out = ""
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= limit) continue
      out += alphabet[byte % alphabet.length]
      if (out.length === length) break
    }
  }
  return out
}

/** Public project id, e.g. `pw_k3j9x0q2m7ab`. Matches `projectIdSchema`. */
export const generateProjectId = () => `pw_${randomString(BASE36, 12)}`

/** Public ingestion key (~190 bits of entropy), e.g. `pk_Xy3…`. */
export const generatePublicKey = () => `pk_${randomString(BASE62, 32)}`
