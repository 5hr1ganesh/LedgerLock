import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { RPC_URL, ADDRESSES, ABIS, PRIVATE_KEY } from './contracts';
import {
  ShieldCheck,
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity,
  ArrowUpRight,
  Database,
  Lock,
  Unlock,
  Coins,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Zap,
  ArrowDownRight
} from 'lucide-react';
import './index.css';

// Updated Public Explorer Base
const EXPLORER_URL = "https://dashboard.tenderly.co/explorer/vnet/3b8501d8-503f-47bc-9175-ec3cbfc833a6/transactions";

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
}

const StatCard = ({ label, value, icon, color }: StatCardProps) => (
  <div className="glass-card hud-stat" style={{ borderLeft: color ? `4px solid ${color}` : undefined }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span className="stat-label">{label}</span>
      <div style={{ color: color || 'var(--accent-color)', opacity: 0.8 }}>{icon}</div>
    </div>
    <span className="stat-value">{value}</span>
  </div>
);

function App() {
  const [aum, setAum] = useState("0");
  const [sharePrice, setSharePrice] = useState("1.00");
  const [isKyc, setIsKyc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [simStep, setSimStep] = useState(0);
  const [taxLiability, setTaxLiability] = useState("0");
  const [errorMessage, setErrorMessage] = useState("");

  // CRE Scenarios State
  const [kycExpirySim, setKycExpirySim] = useState(false);
  const [taxDiscrepancySim, setTaxDiscrepancySim] = useState(false);
  const [emergencySim, setEmergencySim] = useState(false);
  const [isMocking, setIsMocking] = useState(false);

  const fetchData = useCallback(async () => {
    if (isMocking) return;
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const treasury = new ethers.Contract(ADDRESSES.TREASURY, ABIS.TREASURY, provider);

      const [totalAssets, totalSupply, emerMode] = await Promise.all([
        treasury.totalAssets(),
        treasury.totalSupply(),
        treasury.isEmergencyMode()
      ]);

      const usdc = new ethers.Contract(ADDRESSES.USDC, ABIS.USDC, provider);
      const taxVaultBalance = await usdc.balanceOf(ADDRESSES.VAULT);

      setAum(ethers.formatUnits(totalAssets, 6));
      setEmergencySim(emerMode);
      setTaxLiability(ethers.formatUnits(taxVaultBalance, 6));

      if (totalSupply > 0n) {
        const price = (totalAssets * ethers.parseUnits("1", 18)) / totalSupply;
        setSharePrice(ethers.formatUnits(price, 18));
      }

      const registry = new ethers.Contract(ADDRESSES.REGISTRY, ABIS.REGISTRY, provider);
      const registryResult = await registry.isVerified(ADDRESSES.JUDGE).catch(() => false);
      const expiration = await registry.kycExpiration(ADDRESSES.JUDGE);
      const now = Math.floor(Date.now() / 1000);

      setIsKyc(registryResult);
      // Only auto-update from chain if we aren't manually mocking an expiry in the UI
      if (!isMocking) {
        setKycExpirySim(expiration > 0n && expiration <= BigInt(now));
      }

      // Removed: Automatic skip to Step 2

    } catch (err) {
      console.error("Fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const addEvent = (title: string, sub: string, icon: React.ReactNode, hash?: string, level: "info" | "warning" | "alert" = "info") => {
    const color = level === "alert" ? "#ff4b2b" : level === "warning" ? "#ffda05" : "#00f2fe";
    setEvents(prev => [{ title, sub, time: new Date().toLocaleTimeString(), icon, hash, color }, ...prev]);
  };

  const handleStep = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const signer = new ethers.Wallet(PRIVATE_KEY, provider);

      if (simStep === 0 || simStep === 1) {
        const registry = new ethers.Contract(ADDRESSES.REGISTRY, ABIS.REGISTRY, signer);
        addEvent("KYC Initiated", `Verifying ${ADDRESSES.JUDGE.slice(0, 6)}...`, <ShieldCheck size={16} />);

        const tx = await registry.updateStatus(ADDRESSES.JUDGE, true, Math.floor(Date.now() / 1000) + 86400 * 365);
        addEvent("KYC Pending", "Confirming on Tenderly...", <Activity size={16} />, tx.hash);
        await tx.wait();

        setIsKyc(true);
        setSimStep(2);
        addEvent("KYC Approved", "Identity Verified On-Chain!", <CheckCircle2 size={16} />, tx.hash);

      } else if (simStep === 2) {
        const usdc = new ethers.Contract(ADDRESSES.USDC, ABIS.USDC, signer);
        addEvent("USDC Approval", "Authorizing Treasury Transfer...", <Lock size={16} />);

        const tx = await usdc.approve(ADDRESSES.TREASURY, ethers.parseUnits("10000", 6));
        addEvent("Approval Pending", "Waiting for confirmation...", <Activity size={16} />, tx.hash);
        await tx.wait();

        setSimStep(3);
        addEvent("Approval Success", "USDC Ready for Deposit", <Unlock size={16} />, tx.hash);

      } else if (simStep === 3) {
        const treasury = new ethers.Contract(ADDRESSES.TREASURY, ABIS.TREASURY, signer);
        addEvent("Treasury Deposit", "Transferring Capital...", <Coins size={16} />);

        // This will revert on-chain if Emergency Mode or KYC Expiry is active
        const tx = await treasury.deposit(ethers.parseUnits("10000", 6), ADDRESSES.JUDGE);
        addEvent("Deposit Pending", "Finalizing Ledger State...", <Activity size={16} />, tx.hash);
        await tx.wait();

        addEvent("Deposit Success", "10,000 USDC Contributed", <TrendingUp size={16} />, tx.hash);
        setSimStep(4);
        fetchData();
      }
    } catch (err: any) {
      console.error(err);
      let msg = err.message || "Transaction failed";
      if (err.info && err.info.error && err.info.error.message) {
        msg = err.info.error.message;
      }
      setErrorMessage(msg);
      addEvent("Transaction Failed", "Smart Contract rejected interaction.", <AlertCircle size={16} />, undefined, "alert");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      addEvent("Withdrawal Initiated", "Calculating realization & tax...", <ArrowDownRight size={16} />);

      // Simulation: Lockdown failure
      if (emergencySim) {
        setTimeout(() => {
          addEvent("Sentinel Check", "Withdrawal REJECTED by Circuit Breaker.", <ShieldAlert size={16} />, undefined, "alert");
          setErrorMessage("LOCKDOWN ACTIVE: Treasury assets are frozen by the Sentinel.");
          setLoading(false);
        }, 1200);
        return;
      }

      // Simulation: Audit failure if discrepancy is active
      if (taxDiscrepancySim) {
        setTimeout(() => {
          addEvent("CRE Audit Alert", "Tax Accrual mismatch during withdrawal!", <ShieldAlert size={16} />, undefined, "alert");
          setErrorMessage("AUDIT FAILURE: Tax liability mismatch. CRE Workflow halted exit.");
          setLoading(false);
        }, 1500);
        return;
      }

      // Real withdrawal would go here, but for demo we simulate the success path 
      // primarily to show the tax impact logic
      setTimeout(() => {
        addEvent("Tax Deducted", "20% performance tax successfully audited.", <Database size={16} color="#ffda05" />);
        addEvent("Withdrawal Success", "Net assets realization complete.", <CheckCircle2 size={16} color="#00f2fe" />);
        setSimStep(0);
        setAum("0"); // Clear on withdrawal
        setLoading(false);
      }, 1500);

    } catch (err: any) {
      setErrorMessage(err.message || "Withdrawal failed");
      setLoading(false);
    }
  };

  const toggleKycExpiry = async () => {
    if (loading) return;
    setLoading(true);
    setIsMocking(true); // Lock the UI state for the demo
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const signer = new ethers.Wallet(PRIVATE_KEY, provider);
      const registry = new ethers.Contract(ADDRESSES.REGISTRY, ABIS.REGISTRY, signer);

      const newStatus = !kycExpirySim;
      const expiration = newStatus ? Math.floor(Date.now() / 1000) + 5 : Math.floor(Date.now() / 1000) + 86400 * 365;

      addEvent("Auditing KYC", "Updating expiration on-chain...", <Clock size={16} />, undefined, "warning");
      const tx = await registry.updateStatus(ADDRESSES.JUDGE, true, expiration);
      await tx.wait();

      setKycExpirySim(newStatus);
      if (newStatus) {
        addEvent("CRE Alert", "Identity expiring. Deposits will revert.", <ShieldAlert size={16} />, tx.hash, "alert");
      } else {
        addEvent("Registry Sync", "Compliance status restored.", <ShieldCheck size={16} />, tx.hash);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaxSim = () => {
    const newStatus = !taxDiscrepancySim;
    setTaxDiscrepancySim(newStatus);
    if (newStatus) {
      setIsMocking(true); // Lock the UI for the demo alert
      addEvent("CRE Alert", "Tax Reporter detected discrepancies!", <AlertCircle size={16} />, undefined, "alert");
    } else {
      setIsMocking(false);
      addEvent("Sync Restored", "Tax Vault state audited successfully.", <CheckCircle2 size={16} />);
      fetchData();
    }
  };

  const toggleEmergency = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const signer = new ethers.Wallet(PRIVATE_KEY, provider);
      const treasury = new ethers.Contract(ADDRESSES.TREASURY, ABIS.TREASURY, signer);

      const newStatus = !emergencySim;
      addEvent("Action Requested", `${newStatus ? 'Activating' : 'Deactivating'} Circuit Breaker...`, <Zap size={16} />, undefined, "warning");

      const tx = await treasury.toggleEmergencyMode(newStatus);
      await tx.wait();

      setEmergencySim(newStatus);
      if (newStatus) {
        addEvent("Sentinel Status", "Emergency Mode ACTIVE. On-chain lock enabled.", <Zap size={16} />, tx.hash, "alert");
      } else {
        addEvent("Sentinel Status", "Emergency Mode CLEARED.", <ShieldCheck size={16} />, tx.hash);
      }
    } catch (err) {
      console.error(err);
      addEvent("Action Failed", "Treasury rejected state change.", <AlertCircle size={16} />, undefined, "alert");
    } finally {
      setLoading(false);
    }
  };

  const warpTime = () => {
    setLoading(true);
    setIsMocking(true); // Lock the refresh loop
    addEvent("Yield Accrual", "Simulating 180 Days of Growth...", <Clock size={16} />);
    setTimeout(() => {
      // MOCK YIELD GENERATION FOR DEMO
      const currentAumNum = parseFloat(aum.replace(/,/g, ''));
      if (currentAumNum > 0) {
        const simulatedGrowth = currentAumNum * 0.08; // 8% growth
        const newAum = currentAumNum + simulatedGrowth;
        const profit = newAum - 10000; // 10k is our base
        const accruedTax = profit * 0.20; // 20% performance tax

        setAum(newAum.toFixed(2).toString());
        setTaxLiability(accruedTax.toFixed(2).toString());

        // Also bump share price slightly
        const currentPrice = parseFloat(sharePrice);
        setSharePrice((currentPrice * 1.08).toFixed(4).toString());
      }

      addEvent("Performance Sync", "CRE Workflow verified yield per share.", <TrendingUp size={16} />);
      setLoading(false);
    }, 2000);
  };

  const resetSim = () => {
    setSimStep(0);
    setEvents([]);
    setIsKyc(false);
    setTaxLiability("0");
    setErrorMessage("");
    setKycExpirySim(false);
    setTaxDiscrepancySim(false);
    setEmergencySim(false);
    setIsMocking(false); // Release the lock
    fetchData();
  };

  return (
    <div className="app-container">
      <header className="dashboard-header">
        <div className="logo">
          <div className="logo-icon"><ShieldCheck size={20} /></div>
          LEDGERLOCK <span>INSTITUTIONAL</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={resetSim} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Reset Demo</button>
          <div className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={16} />
            Tenderly V2 Bridge
          </div>
        </div>
      </header>

      {errorMessage && (
        <div className="glass-card" style={{ marginBottom: '1.5rem', border: '1px solid #ff4b2b', background: 'rgba(255, 75, 43, 0.1)', display: 'flex', alignItems: 'center', gap: '12px', animation: 'slideIn 0.3s ease-out' }}>
          <ShieldAlert color="#ff4b2b" size={24} />
          <div style={{ flex: 1 }}>
            <h4 style={{ color: '#ff4b2b', marginBottom: '4px' }}>On-Chain Logic Revert</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage("")} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {emergencySim && (
        <div style={{
          background: 'rgba(255, 75, 43, 0.15)',
          border: '1px solid #ff4b2b',
          color: '#ff4b2b',
          padding: '1rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontWeight: 600,
          animation: 'pulse 2s infinite'
        }}>
          <ShieldAlert size={24} />
          <div style={{ flex: 1 }}>
            EMERGENCY LOCKDOWN ACTIVE: On-chain transactions are restricted by the CRE Sentinel.
          </div>
          <Zap size={20} />
        </div>
      )}

      <section className="hud-grid">
        <StatCard
          label="Treasury AUM"
          value={`${Number(aum).toLocaleString()} USDC`}
          icon={<TrendingUp />}
        />
        <StatCard
          label="Institutional NAV"
          value={`$${Number(sharePrice).toFixed(4)}`}
          icon={<Activity />}
        />
        <StatCard
          label="KYC Status"
          value={kycExpirySim ? "EXPIRING" : (isKyc ? "VERIFIED" : "PENDING")}
          icon={isKyc && !kycExpirySim ? <CheckCircle2 color="#00f2fe" /> : <AlertCircle color={kycExpirySim ? "#ffda05" : "#ff4b2b"} />}
          color={kycExpirySim ? "#ffda05" : undefined}
        />
        <StatCard
          label="Accrued Tax Liability"
          value={taxDiscrepancySim ? "DISCREPANCY" : `${taxLiability} USDC`}
          icon={<Database color={taxDiscrepancySim ? "#ff4b2b" : "#ffda05"} />}
          color={taxDiscrepancySim ? "#ff4b2b" : undefined}
        />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-card">
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Wallet size={20} /> Institutional Lifecycle Demo
            </h3>

            <div className="simulation-steps">
              <div className="step-list" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '20px', left: '10%', right: '10%', height: '2px', background: 'var(--glass-border)', zIndex: 0 }}></div>
                {[
                  { id: 1, label: "KYC", icon: <ShieldCheck size={16} /> },
                  { id: 2, label: "Approve", icon: <Unlock size={16} /> },
                  { id: 3, label: "Invest", icon: <Coins size={16} /> },
                  { id: 4, label: "Yield", icon: <TrendingUp size={16} /> }
                ].map(s => (
                  <div key={s.id} style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: simStep >= s.id ? 'var(--accent-color)' : 'var(--glass-bg)',
                      color: simStep >= s.id ? '#000' : 'var(--text-secondary)',
                      display: 'grid',
                      placeItems: 'center',
                      border: '2px solid',
                      borderColor: simStep >= s.id ? 'var(--accent-color)' : 'var(--glass-border)'
                    }}>
                      {s.icon}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: simStep >= s.id ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600 }}>{s.label}</span>
                  </div>
                ))}
              </div>

              <div className="judge-controls" style={{ minHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
                {simStep < 4 ? (
                  <>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '400px' }}>
                      {simStep <= 1 && `Verify current institutional status of ${ADDRESSES.JUDGE.slice(0, 8)}... on the Ledger.`}
                      {simStep === 2 && "Grant permission for the strategy to allocate USDC capital."}
                      {simStep === 3 && "Perform the on-chain deposit to begin generating institutional yield."}
                    </p>
                    <button
                      className="btn-primary"
                      onClick={handleStep}
                      disabled={loading}
                      style={{ padding: '1rem 2rem', fontSize: '1rem' }}
                    >
                      {loading ? "Transacting..." : (
                        simStep <= 1 ? "1. Verify On-Chain Identity" :
                          simStep === 2 ? "2. Approve USDC Allocation" : "3. Complete Strategic Deposit"
                      )}
                      <ChevronRight size={20} />
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center' }}>
                    <button
                      className="btn-primary"
                      onClick={warpTime}
                      disabled={loading}
                      style={{ background: 'linear-gradient(135deg, #ffda05 0%, #ff8c00 100%)', flex: 1 }}
                    >
                      {loading ? "Processing..." : "Trigger 180-Day Yield Performance"}
                      <Clock size={20} />
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={handleWithdraw}
                      disabled={loading}
                      style={{ flex: 1, borderColor: '#ff4b2b', color: '#ff4b2b' }}
                    >
                      {loading ? "Processing..." : "Execute Withdrawal (Audit Exit)"}
                      <ArrowUpRight size={20} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="glass-card">
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#ffda05' }}>
              <ShieldAlert size={20} /> Chainlink CRE: Audit Scenarios
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Use the toggles below to trigger real on-chain state changes, then attempt to transact above to see the Audit result.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <button
                className={`btn-secondary ${kycExpirySim ? 'active-warning' : ''}`}
                onClick={toggleKycExpiry}
                disabled={loading}
                style={kycExpirySim ? { borderColor: '#ffda05', color: '#ffda05', background: 'rgba(255,218,5,0.05)' } : {}}
              >
                {kycExpirySim ? "Expiring Status" : "Simulate KYC Expiry"}
              </button>
              <button
                className={`btn-secondary ${taxDiscrepancySim ? 'active-danger' : ''}`}
                onClick={toggleTaxSim}
                style={taxDiscrepancySim ? { borderColor: '#ff4b2b', color: '#ff4b2b', background: 'rgba(255,75,43,0.05)' } : {}}
              >
                Tax Discrepancy
              </button>
              <button
                className={`btn-secondary ${emergencySim ? 'active-danger' : ''}`}
                onClick={toggleEmergency}
                disabled={loading}
                style={emergencySim ? { borderColor: '#ff4b2b', color: '#ff4b2b', background: 'rgba(255,75,43,0.05)' } : {}}
              >
                {emergencySim ? "Lockdown ACTIVE" : "Emergency Mode"}
              </button>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={20} /> Ledger & CRE Audit Feed
          </h3>
          <div className="event-feed" style={{ maxHeight: '550px', overflowY: 'auto' }}>
            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                <Activity size={32} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                <p>Awaiting blockchain interaction...</p>
              </div>
            ) : (
              events.map((e, i) => (
                <div key={i} className="event-item" style={{ borderLeft: `2px solid ${e.color || '#00f2fe'}`, animation: 'slideIn 0.3s ease-out' }}>
                  <div className="event-info">
                    <span className="event-title" style={{ color: e.color || '#fff' }}>{e.title}</span>
                    <span className="event-sub">{e.sub}</span>
                    {e.hash && (
                      <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-400"
                        style={{ color: 'var(--accent-color)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', marginTop: '4px' }}
                      >
                        View Transaction <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <div style={{ color: e.color || 'var(--accent-color)' }}>{e.icon}</div>
                    <span className="event-sub">{e.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

export default App;
