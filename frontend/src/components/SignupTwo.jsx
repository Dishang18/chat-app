import React, { useState } from 'react';
import axios from 'axios';

const SignupTwo = ({ formData, setFormData }) => {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState('');

  const handleSendOtp = async () => {
    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/auth/signup/send-otp`, {
        phone: formData.phone,
      });
      setOtpSent(true);
      setStatus('OTP sent');
    } catch (err) {
      setStatus('Failed to send OTP');
    }
  };

  const handleVerifyOtp = async () => {
    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/auth/signup/verify-otp`, {
        ...formData,
        otp,
      });
      setStatus('Signup successful!');
    } catch (err) {
      setStatus('Invalid OTP or signup failed');
    }
  };

  return (
    <div>
      <h2>Step 2: Phone Verification</h2>
      <input
        type="text"
        placeholder="Phone Number"
        required
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
      />
      <button onClick={handleSendOtp}>Send OTP</button>

      {otpSent && (
        <>
          <input
            type="text"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <button onClick={handleVerifyOtp}>Verify & Sign Up</button>
        </>
      )}

      <p>{status}</p>
    </div>
  );
};

export default SignupTwo;
