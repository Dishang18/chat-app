import React, { useState } from 'react';
import SignupStepOne from './components/SignupOne';
import SignupStepTwo from './components/SignupTwo';
import './App.css';

const App = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    preferredLanguage: '',
    phone: '',
  });

  return (
    <div style={{ padding: 20 }}>
      {step === 1 ? (
        <SignupStepOne setStep={setStep} formData={formData} setFormData={setFormData} />
      ) : (
        <SignupStepTwo formData={formData} setFormData={setFormData} />
      )}
    </div>
  );
};

export default App;
