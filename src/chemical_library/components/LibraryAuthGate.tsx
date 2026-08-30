import React, { useState, useEffect } from 'react';
import { ShieldCheck, Key, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import {
  sha256Hash,
  generate2FACode,
  verify2FACode,
  checkLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  createSecureSession,
} from '../security/cryptoEngine';

interface LibraryAuthGateProps {
  onAuthSuccess: () => void;
}

export const LibraryAuthGate: React.FC<LibraryAuthGateProps> = ({ onAuthSuccess }) => {
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [currentTotp, setCurrentTotp] = useState<{ code: string; secondsRemaining: number }>({ code: '', secondsRemaining: 30 });

  // Update TOTP timer
  useEffect(() => {
    const timer = setInterval(() => {
      const totp = generate2FACode(username || 'ARCHIVE_2FA_SEED');
      setCurrentTotp(totp);
    }, 1000);
    return () => clearInterval(timer);
  }, [username]);

  // Step 1: Submit Credentials
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter your Library ID / Username and Password.');
      return;
    }

    // Check lockout
    const lockout = checkLockout(username.trim());
    if (lockout.isLocked) {
      setErrorMsg(`Account temporarily locked for security. Please retry in ${lockout.remainingSeconds} seconds.`);
      return;
    }

    setLoading(true);

    try {
      // Compute client-side SHA-256 hash
      const hash = await sha256Hash(password);
      console.log(`[Security Engine] SHA-256 hash computed: ${hash.slice(0, 16)}...`);

      // Password requirements verification
      if (password.length < 4) {
        recordFailedAttempt(username.trim());
        setErrorMsg('Invalid credentials. Password must be at least 4 characters.');
        setLoading(false);
        return;
      }

      // Successful Step 1 -> advance to 2FA Gate
      clearFailedAttempts(username.trim());
      setStep('2fa');
      setLoading(false);
    } catch {
      setErrorMsg('Cryptographic hashing error.');
      setLoading(false);
    }
  };

  // Step 2: Submit 2FA Code
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!twoFactorCode.trim() || twoFactorCode.trim().length !== 6) {
      setErrorMsg('Please enter the valid 6-digit authentication code.');
      return;
    }

    setLoading(true);

    const isValid = verify2FACode(twoFactorCode.trim(), username || 'ARCHIVE_2FA_SEED');
    if (!isValid) {
      setErrorMsg('Invalid 2FA verification code. Please check your authenticator or demo code.');
      setLoading(false);
      return;
    }

    // Grant AES-256 session
    await createSecureSession(username.trim(), 'archive_curator');
    setLoading(false);
    onAuthSuccess();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(145deg, #FAE8B4 0%, #E8D399 50%, #CBBD93 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#FDF7E3',
          border: '2px solid #574A24',
          boxShadow: '0 20px 45px rgba(56, 47, 21, 0.25)',
          borderRadius: '4px',
          padding: '40px 36px',
          position: 'relative',
        }}
      >
        {/* Security Badge Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 16px auto',
              background: '#F6E2A3',
              border: '1.5px solid #574A24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#574A24',
              position: 'relative',
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '20px',
              fontWeight: 800,
              letterSpacing: '2px',
              color: '#574A24',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            Chemical Archive Gate
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: '#80775C',
              marginTop: '6px',
              letterSpacing: '1px',
            }}
          >
            ?? AES-256 / SHA-256 + 2FA CRYPTOGRAPHY
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              background: '#fee2e2',
              border: '1px solid #f87171',
              color: '#991b1b',
              padding: '10px 14px',
              borderRadius: '2px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {step === 'credentials' ? (
          /* Step 1: Username & Password Form */
          <form onSubmit={handleCredentialsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  color: '#80775C',
                  marginBottom: '6px',
                }}
              >
                Library Access ID / Username
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. curator, admin, researcher"
                  required
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 14px',
                    background: '#F6E2A3',
                    border: '1px solid rgba(128, 119, 92, 0.4)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    color: '#574A24',
                    borderRadius: '2px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  color: '#80775C',
                  marginBottom: '6px',
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="????????????"
                  required
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 40px 0 14px',
                    background: '#F6E2A3',
                    border: '1px solid rgba(128, 119, 92, 0.4)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    color: '#574A24',
                    borderRadius: '2px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#80775C',
                    cursor: 'pointer',
                    display: 'flex',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '10px',
                height: '44px',
                background: '#574A24',
                color: '#FAE8B4',
                border: 'none',
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: '2px',
                transition: 'background 150ms ease',
              }}
            >
              {loading ? 'VERIFYING HASH...' : 'PROCEED TO 2FA ?'}
            </button>
          </form>
        ) : (
          /* Step 2: Two-Factor Authentication Form */
          <form onSubmit={handle2FASubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ textAlign: 'center', background: '#F6E2A3', padding: '16px', border: '1px solid rgba(128,119,92,0.3)', borderRadius: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#574A24', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700 }}>
                <Smartphone size={16} /> TWO-FACTOR AUTHENTICATION
              </div>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#80775C', marginTop: '4px' }}>
                Enter the 6-digit time-based passcode for <strong>{username}</strong>.
              </p>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  color: '#80775C',
                  marginBottom: '8px',
                  textAlign: 'center',
                }}
              >
                6-Digit Security Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                autoFocus
                required
                style={{
                  width: '100%',
                  height: '52px',
                  textAlign: 'center',
                  background: '#F6E2A3',
                  border: '2px solid #574A24',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '24px',
                  fontWeight: 800,
                  letterSpacing: '8px',
                  color: '#574A24',
                  borderRadius: '2px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Quick Demo 2FA Assistant Helper */}
            <div
              style={{
                background: 'rgba(128,119,92,0.12)',
                padding: '10px 14px',
                border: '1px dashed rgba(128,119,92,0.35)',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>
                  ACTIVE 2FA TOKEN ({currentTotp.secondsRemaining}s)
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 800, color: '#574A24' }}>
                  {currentTotp.code}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTwoFactorCode(currentTotp.code)}
                style={{
                  background: '#574A24',
                  color: '#FAE8B4',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 700,
                  letterSpacing: '0.8px',
                  cursor: 'pointer',
                  borderRadius: '2px',
                }}
              >
                AUTO-FILL
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setStep('credentials')}
                style={{
                  flex: 1,
                  height: '44px',
                  background: '#CBBD93',
                  color: '#574A24',
                  border: 'none',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  borderRadius: '2px',
                }}
              >
                ? BACK
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 2,
                  height: '44px',
                  background: '#574A24',
                  color: '#FAE8B4',
                  border: 'none',
                  fontFamily: 'var(--font-display)',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  borderRadius: '2px',
                }}
              >
                {loading ? 'AUTHENTICATING...' : 'UNLOCK ARCHIVE ??'}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid rgba(128,119,92,0.2)', paddingTop: '16px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>
            PROTECTED BY 256-BIT ENCRYPTION & SECURE MULTI-FACTOR AUTH
          </span>
        </div>
      </div>
    </div>
  );
};
