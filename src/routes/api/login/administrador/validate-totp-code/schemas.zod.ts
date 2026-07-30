import { z } from "zod";

export const validateTotpSchema = z.object({
  Totp_Operation_Token: z
    .string({
      message: "MISSING_TOTP_OPERATION_TOKEN",
    })
    .min(1, "MISSING_TOTP_OPERATION_TOKEN"),
  Totp_Code: z
    .string({
      message: "MISSING_TOTP_CODE",
    })
    .length(6, "TOTP_CODE_INVALID_LENGTH")
    .regex(/^[0-9]{6}$/, "TOTP_CODE_INVALID_FORMAT"),
});

export type ValidateTotpInput = z.infer<typeof validateTotpSchema>;
