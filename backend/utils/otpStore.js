// utils/otpStore.js
const otpStore = new Map();

export const setOtp = (phone, otp) => otpStore.set(phone, otp);
export const getOtp = (phone) => otpStore.get(phone);
export const deleteOtp = (phone) => otpStore.delete(phone);
