const otpStore: Record<string, string> = {};

export function saveOTP(phone: string, otp: string) {
  console.log("Saving OTP:", phone, otp);
  otpStore[phone] = otp;
}

export function verifyOTP(phone: string, otp: string) {
  console.log("Verifying OTP:", phone, otp, "Stored:", otpStore[phone]);
  return otpStore[phone] === otp;
}