import { convexAuth } from "@convex-dev/auth/server";
import { TwilioVerify } from "./otp/TwilioVerify";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [TwilioVerify()],
});
