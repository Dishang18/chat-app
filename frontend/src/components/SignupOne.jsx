import React, { useState } from 'react';
import axios from 'axios';

const SignupOne = ({ setStep, formData, setFormData }) => {
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/auth/signup/step1`, formData);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Step 1: Basic Info</h2>
      <input
        type="text"
        placeholder="Username"
        required
        value={formData.username}
        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
      />
      <input
        type="email"
        placeholder="Email"
        required
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />
      <input
        type="password"
        placeholder="Password"
        required
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
      />
      <select
        required
        value={formData.preferredLanguage}
        onChange={(e) => setFormData({ ...formData, preferredLanguage: e.target.value })}
      >
        <option value="">Select Language</option>
        <option value="en">English</option>
        <option value="hi">Hindi</option>
        <option value="es">Spanish</option>
      </select>

      <button type="submit">Next</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
};

export default SignupOne;
