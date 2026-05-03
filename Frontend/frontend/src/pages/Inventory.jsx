import { useState, useEffect } from 'react';
import { getAlerts, acknowledge_alert, setOverrideThreshold, updateInventory, adjustInventory } from '../services/api';
import WhyPopup from '../components/WhyPopup';
import './Inventory.css';

export default function Inventory() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [selectedSku, setSelectedSku] = useState(null);
    const [hovered, setHovered] = useState(null);
    const [overrideSku, setOverrideSku] = useState(null);
    const [overrideVal, setOverrideVal] = useState('');
    const [adjustSku, setAdjustSku] = useState(null);
    const [adjustVal, setAdjustVal] = useState('');
    const [adjustReason, setAdjustReason] = useState('Typo Correction');

    useEffect(() => { loadAlerts(); }, []);

    const loadAlerts = async () => {
        try {
            setLoading(true); setErr('');
            setAlerts(await getAlerts());
        } catch (e) { setErr(e.message); }
        finally { setLoading(false); }
    };

    const handleAcknowledge = async (sku) => {
        try {
            await acknowledge_alert(sku);
            // ZERO-READ UPDATE: Instantly modify local state instead of doing costly DB fetch
            setAlerts(prev => prev.map(a => a.sku === sku ? { ...a, acknowledged: true } : a));
        } catch (e) {
            setErr("Failed to acknowledge alert: " + e.message);
        }
    };

    const handleArrived = async (sku, current_stock) => {
        const qty = prompt(`🚚 TRUCK ARRIVED: Enter total physical stock received for ${sku}:`);
        if (!qty || isNaN(qty) || parseInt(qty) <= 0) return;
        
        const price = prompt(`💰 SUPPLIER INVOICE: Enter unit price paid for ${sku} (COGS):`);
        if (!price || isNaN(price) || parseFloat(price) < 0) {
            setErr("Invalid supplier price. Operation cancelled.");
            return;
        }

        try {
            // Update database physically
            await updateInventory(sku, { 
                current_stock: current_stock + parseInt(qty), 
                unit_price: parseFloat(price),
                acknowledged: false 
            });
            // ZERO-READ REMOVAL: Instantly clear the alert from the screen locally
            setAlerts(prev => prev.filter(a => a.sku !== sku));
        } catch (e) {
            setErr("Failed to verify arrival: " + e.message);
        }
    };

    const handleSetOverride = async (e) => {
        e.preventDefault();
        try {
            await setOverrideThreshold(overrideSku.sku, parseInt(overrideVal));
            setOverrideSku(null);
            setOverrideVal('');
            await loadAlerts();
        } catch (error) {
            setErr("Failed to set override: " + error.message);
        }
    };

    const handleAdjustSubmit = async (e) => {
        e.preventDefault();
        try {
            const newStockVal = parseInt(adjustVal);
            if (isNaN(newStockVal) || newStockVal < 0) {
                setErr("Invalid stock value. Must be a non-negative number.");
                return;
            }
            await adjustInventory(adjustSku.sku, newStockVal, adjustReason);
            setAdjustSku(null);
            setAdjustVal('');
            await loadAlerts();
        } catch (error) {
            setErr("Failed to adjust stock: " + error.message);
        }
    };

    const getUrgencyBadge = (u) => {
        switch (u) {
            case 'EMERGENCY': return { text: 'EMERGENCY', color: '#ff0055', bg: 'rgba(255,0,85,.15)' };
            case 'CRITICAL': return { text: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,.1)' };
            case 'URGENT': return { text: 'URGENT', color: '#f97316', bg: 'rgba(249,115,22,.1)' };
            case 'REORDER': return { text: 'REORDER', color: '#eab308', bg: 'rgba(234,179,8,.1)' };
            default: return { text: 'OK', color: '#22c55e', bg: 'rgba(34,197,94,.1)' };
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Scanning inventory for alerts...</div>;

    return (
        <div className="inv-wrap"> {/* Scoped to not break other components */}
            <div className="grid-bg" />
            <div className="scanline" />
            <div className="blob1" />
            <div className="blob2" />

            <main>
                <div className="page-header">
                    <div>
                        <div className="page-subtitle" style={{ marginBottom: '16px' }}>// SYSTEM MODULE: M3</div>
                        <h1 className="page-title">INVENTORY <span>ALERTS</span></h1>
                        <div className="title-bar" style={{ marginTop: '16px' }} />
                    </div>
                    <button className="refresh-btn" onClick={loadAlerts}>↻ REFRESH LIST</button>
                </div>

                {err ? <div className="text-red-500 mb-4">{err}</div> : null}

                <div className="cards-grid">
                    {alerts.map((a, i) => {
                        const badge = getUrgencyBadge(a.urgency);
                        return (
                            <div
                                key={i}
                                className="item-card"
                                style={{ animationDelay: `${(i % 9) * 0.05}s` }}
                                onMouseEnter={() => setHovered(i)}
                                onMouseLeave={() => setHovered(null)}
                            >
                                <div className="card-top">
                                    <div className="card-name truncate" title={a.product_name}>{a.product_name}</div>
                                    <div className="ok-badge" style={{
                                        color: badge.color,
                                        borderColor: badge.color,
                                        background: badge.bg,
                                        textShadow: `0 0 8px ${badge.color}80`
                                    }}>
                                        {badge.text}
                                    </div>
                                </div>
                                <div className="card-sku">{a.sku}</div>

                                <div className="card-stats" style={{ gridTemplateColumns: a.reorder_flag ? '1fr 1fr 1fr' : '1fr 1fr' }}>
                                    <div className="stat-block">
                                        <div className="stat-label-sm">Stock</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <div className="stat-val-sm" style={{ color: a.current_stock < a.reorder_point ? '#f97316' : '#22c55e' }}>{a.current_stock}</div>
                                            <button 
                                                onClick={() => { setAdjustSku(a); setAdjustVal(a.current_stock); }}
                                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '10px' }}
                                                title="Correct Stock Entry"
                                            >
                                                ✏️
                                            </button>
                                        </div>
                                    </div>
                                    <div className="stat-block">
                                        <div className="stat-label-sm">Days Left</div>
                                        <div className="stat-val-sm" style={{ color: "#3b82f6", textShadow: "0 0 10px rgba(59,130,246,.4)" }}>
                                            {a.days_of_stock >= 999 ? '999+' : a.days_of_stock}
                                        </div>
                                    </div>
                                    {!!a.reorder_flag && a.recommended_order_quantity > 0 && (
                                        <div className="stat-block">
                                            <div className="stat-label-sm" style={{ color: '#a78bfa' }}>Order Qty</div>
                                            <div className="stat-val-sm" style={{ color: "#d8b4fe", textShadow: "0 0 10px rgba(167,139,250,.4)" }}>
                                                +{a.recommended_order_quantity}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="divider" style={{ marginTop: 'auto' }} />

                                <div className="card-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div className="model-tag">{a.mode} • {a.confidence.split(' ')[0]}</div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {a.acknowledged ? (
                                            <>
                                                <div style={{ fontSize: '9px', color: '#64748b', border: '1px solid #334155', padding: '4px 8px', borderRadius: '2px', background: 'rgba(51,65,85,.1)', fontFamily: "'Orbitron', monospace", letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                                                    ORDER PLACED ✓
                                                </div>
                                                <button
                                                    onClick={() => handleArrived(a.sku, a.current_stock)}
                                                    style={{ fontSize: '9px', color: '#22c55e', border: '1px solid rgba(34,197,94,.4)', padding: '4px 8px', borderRadius: '2px', background: 'transparent', cursor: 'pointer', fontFamily: "'Orbitron', monospace", letterSpacing: '1px', transition: 'all 0.2s', marginLeft: '8px', whiteSpace: 'nowrap' }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,.1)'; e.currentTarget.style.boxShadow = '0 0 8px rgba(34,197,94,.3)'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
                                                >
                                                    TRUCK ARRIVED ➔
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleAcknowledge(a.sku)}
                                                style={{ fontSize: '9px', color: '#f97316', border: '1px solid rgba(249,115,22,.4)', padding: '4px 8px', borderRadius: '2px', background: 'transparent', cursor: 'pointer', fontFamily: "'Orbitron', monospace", letterSpacing: '1px', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(249,115,22,.1)'; e.currentTarget.style.boxShadow = '0 0 8px rgba(249,115,22,.3)'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
                                            >
                                                MARK AS ORDERED ✓
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setOverrideSku(a)}
                                            style={{ fontSize: '10px', color: '#94a3b8', border: '1px solid #334155', padding: '4px 8px', borderRadius: '2px', background: 'transparent', cursor: 'pointer', transition: 'all 0.2s', marginLeft: '4px' }}
                                            title="Set Manual Override Threshold"
                                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(148,163,184,.1)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            ⚙️
                                        </button>
                                        <div className="explain-link" onClick={() => setSelectedSku(a)}>Explain Why →</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {alerts.length === 0 && <div style={{ gridColumn: '1 / -1' }} className="py-12 text-center text-gray-500">No inventory alerts generated.</div>}
                </div>

                <div className="status-bar">
                    {[
                        { label: "SYSTEM STATUS", val: "ONLINE", color: "#22c55e" },
                        { label: "MODULE", val: "M3", color: "#f97316" },
                        { label: "TOTAL SKUs", val: `${alerts.length}`, color: "#3b82f6" },
                        { label: "ALERT LEVEL", val: alerts.some(a => a.urgency === 'CRITICAL') ? "CRITICAL" : "NOMINAL", color: "#818cf8" },
                    ].map(s => (
                        <div key={s.label} className="stat">
                            <span className="stat-dot" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
                            <span className="stat-lbl">{s.label}:</span>
                            <span className="stat-v" style={{ color: s.color }}>{s.val}</span>
                        </div>
                    ))}
                </div>
            </main>

            {selectedSku && <WhyPopup alert={selectedSku} onClose={() => setSelectedSku(null)} />}
            
            {overrideSku && (
                <div style={{
                    position: "fixed", inset: 0,
                    background: "rgba(6, 10, 16, 0.8)", backdropFilter: "blur(6px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "16px", zIndex: 9999
                }}>
                    <div style={{
                        background: "linear-gradient(145deg, #0d1520 0%, #080e18 100%)",
                        border: "1px solid rgba(0, 229, 255, 0.15)",
                        boxShadow: "0 0 0 1px rgba(0, 229, 255, 0.15), 0 0 60px rgba(0, 229, 255, 0.08), 0 40px 80px rgba(0,0,0,0.8)",
                        borderRadius: "16px", padding: "24px", maxWidth: "400px", width: "100%", position: "relative"
                    }}>
                        <button onClick={() => setOverrideSku(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white">✕</button>
                        <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>Set Manual Override</h3>
                        <p className="text-sm text-gray-400 mb-4">Set a custom fallback reorder point for <strong>{overrideSku.sku}</strong>. This bypasses AI constraints.</p>
                        <form onSubmit={handleSetOverride}>
                            <input 
                                type="number" 
                                style={{
                                    width: "100%", background: "#060a10", color: "#00e5ff", 
                                    border: "1px solid rgba(0, 229, 255, 0.2)", borderRadius: "6px", 
                                    padding: "12px", marginBottom: "16px", fontFamily: "'Space Mono', monospace",
                                    outline: "none", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)"
                                }}
                                placeholder="E.g. 100"
                                value={overrideVal}
                                onChange={e => setOverrideVal(e.target.value)}
                                min="0" required
                            />
                            <div style={{ display: "flex", gap: "12px" }}>
                                <button type="button" onClick={() => setOverrideSku(null)} style={{
                                    flex: 1, padding: "10px", background: "transparent", color: "#8899aa", 
                                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", cursor: "pointer", fontFamily: "'Space Mono', monospace"
                                }}>Cancel</button>
                                <button type="submit" style={{
                                    flex: 1, padding: "10px", background: "linear-gradient(135deg, #00c8e0, #0088cc)", 
                                    color: "#000", fontWeight: "bold", border: "none", borderRadius: "6px", cursor: "pointer", 
                                    fontFamily: "'Space Mono', monospace", boxShadow: "0 0 15px rgba(0, 229, 255, 0.3)"
                                }}>Save Rule</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {adjustSku && (
                <div style={{
                    position: "fixed", inset: 0,
                    background: "rgba(6, 10, 16, 0.8)", backdropFilter: "blur(6px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "16px", zIndex: 9999
                }}>
                    <div style={{
                        background: "linear-gradient(145deg, #0d1520 0%, #080e18 100%)",
                        border: "1px solid rgba(0, 229, 255, 0.15)",
                        boxShadow: "0 0 0 1px rgba(0, 229, 255, 0.15), 0 0 60px rgba(0, 229, 255, 0.08), 0 40px 80px rgba(0,0,0,0.8)",
                        borderRadius: "16px", padding: "24px", maxWidth: "400px", width: "100%", position: "relative"
                    }}>
                        <button onClick={() => setAdjustSku(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white">✕</button>
                        <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>Adjust Stock</h3>
                        <p className="text-sm text-gray-400 mb-4">Correct the actual physical stock for <strong>{adjustSku.sku}</strong>. This action will be logged.</p>
                        <form onSubmit={handleAdjustSubmit}>
                            <label style={{ display: 'block', color: '#8899aa', fontSize: '12px', marginBottom: '4px', fontFamily: "'Space Mono', monospace" }}>New Physical Stock Count (Current: {adjustSku.current_stock})</label>
                            <input 
                                type="number" 
                                style={{
                                    width: "100%", background: "#060a10", color: "#00e5ff", 
                                    border: "1px solid rgba(0, 229, 255, 0.2)", borderRadius: "6px", 
                                    padding: "12px", marginBottom: "16px", fontFamily: "'Space Mono', monospace",
                                    outline: "none", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)"
                                }}
                                placeholder="Exact Count"
                                value={adjustVal}
                                onChange={e => setAdjustVal(e.target.value)}
                                min="0" required
                            />
                            
                            <label style={{ display: 'block', color: '#8899aa', fontSize: '12px', marginBottom: '4px', fontFamily: "'Space Mono', monospace" }}>Reason for Correction</label>
                            <select 
                                value={adjustReason}
                                onChange={e => setAdjustReason(e.target.value)}
                                style={{
                                    width: "100%", background: "#060a10", color: "#00e5ff", 
                                    border: "1px solid rgba(0, 229, 255, 0.2)", borderRadius: "6px", 
                                    padding: "12px", marginBottom: "24px", fontFamily: "'Space Mono', monospace",
                                    outline: "none"
                                }}
                            >
                                <option value="Typo Correction">Typo Correction</option>
                                <option value="Damaged Goods">Damaged Goods</option>
                                <option value="Lost / Missing">Lost / Missing</option>
                                <option value="Found Stock">Found Stock</option>
                                <option value="Other">Other</option>
                            </select>

                            <div style={{ display: "flex", gap: "12px" }}>
                                <button type="button" onClick={() => setAdjustSku(null)} style={{
                                    flex: 1, padding: "10px", background: "transparent", color: "#8899aa", 
                                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", cursor: "pointer", fontFamily: "'Space Mono', monospace"
                                }}>Cancel</button>
                                <button type="submit" style={{
                                    flex: 1, padding: "10px", background: "linear-gradient(135deg, #00c8e0, #0088cc)", 
                                    color: "#000", fontWeight: "bold", border: "none", borderRadius: "6px", cursor: "pointer", 
                                    fontFamily: "'Space Mono', monospace", boxShadow: "0 0 15px rgba(0, 229, 255, 0.3)"
                                }}>Save Correction</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
