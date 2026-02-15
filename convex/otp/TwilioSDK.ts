"use node";

import { createAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import twilio from "twilio";
import { internalAction } from "../_generated/server";

function twilioClient() {
  if (process.env.AUTH_TWILIO_ACCOUNT_SID === undefined) {
    throw new Error("Environment variable AUTH_TWILIO_ACCOUNT_SID is missing");
  }
  if (process.env.AUTH_TWILIO_AUTH_TOKEN === undefined) {
    throw new Error("Environment variable AUTH_TWILIO_AUTH_TOKEN is missing");
  }
  return twilio(
    process.env.AUTH_TWILIO_ACCOUNT_SID,
    process.env.AUTH_TWILIO_AUTH_TOKEN
  );
}

function twilioVerify() {
  if (process.env.AUTH_TWILIO_SERVICE_SID === undefined) {
    throw new Error("Environment variable AUTH_TWILIO_SERVICE_SID is missing");
  }
  return twilioClient().verify.v2.services(process.env.AUTH_TWILIO_SERVICE_SID);
}

/**
 * Twilio Verify flow: send or verify OTP. No from number needed.
 * Set Convex env vars: AUTH_TWILIO_ACCOUNT_SID, AUTH_TWILIO_AUTH_TOKEN, AUTH_TWILIO_SERVICE_SID
 */
export const verify = internalAction({
  args: {
    phone: v.string(),
    code: v.optional(v.string()),
  },
  handler: async (ctx, { phone, code }) => {
    try {
      if (code === undefined) {
        await twilioVerify().verifications.create({
          to: phone,
          channel: "sms",
        });
        return null;
      }
      const { status } = await twilioVerify().verificationChecks.create({
        to: phone,
        code,
      });
      if (status !== "approved") {
        throw new Error("Invalid or expired code. Please try again.");
      }
      const { user } = await createAccount(ctx, {
        provider: "phone",
        account: { id: phone },
        profile: { phone, phoneVerified: true },
        shouldLinkViaPhone: true,
      });
      return { userId: user._id };
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error("Verification failed. Please try again.");
    }
  },
});
