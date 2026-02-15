import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";

/**
 * Phone sign-in via Twilio Verify. Uses AUTH_TWILIO_SERVICE_SID;
 * no from number required.
 *
 * Convex env vars: AUTH_TWILIO_ACCOUNT_SID, AUTH_TWILIO_AUTH_TOKEN, AUTH_TWILIO_SERVICE_SID
 */
export function TwilioVerify() {
  return ConvexCredentials<DataModel>({
    id: "phone",
    authorize: async (params, ctx) => {
      if (params.phone === undefined || typeof params.phone !== "string") {
        throw new Error("Phone number is required");
      }
      try {
        return await ctx.runAction(internal.otp.TwilioSDK.verify, {
          phone: params.phone,
          code: params.code as string | undefined,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Sign-in failed. Try again.";
        throw new Error(message);
      }
    },
  });
}
