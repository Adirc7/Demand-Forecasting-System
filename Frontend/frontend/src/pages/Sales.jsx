import { useState, useEffect } from 'react';
import { getSales, recordSale, uploadSalesCSV, getProducts, triggerAdminEmail } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function Sales() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');

    // Products for dropdown
    const [products, setProducts] = useState([]);

    // Manual Form State
    const [sku, setSku] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // CSV File State
    const [file, setFile] = useState(null);

    // AI Smart Reminder State
    const [showReminder, setShowReminder] = useState(false);
    const [daysLeft, setDaysLeft] = useState(0);
    const [emailing, setEmailing] = useState(false);

    const fetchSales = async () => {
        try {
            setLoading(true);
            const data = await getSales();
            // Sort by created_at descending if available
            data.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            setSales(data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch sales history: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSales();
        fetchProducts();
    }, []);

    // Proactive AI Reminder Logic (Calculates on page load)
    useEffect(() => {
        const today = new Date();
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        setDaysLeft(lastDayOfMonth - today.getDate());
    }, []);

    // Dynamic AI Traffic Light System
    const getAlertTheme = (days) => {
        if (days <= 7) return { 
            color: '#ef4444', text: 'CRITICAL DEADLINE',
            bg: 'linear-gradient(145deg, #1f0b0d 0%, #0a050f 100%)', border: '1px solid rgba(239, 68, 68, 0.5)'
        };
        if (days <= 15) return { 
            color: '#eab308', text: 'UPCOMING DEADLINE',
            bg: 'linear-gradient(145deg, #1a160b 0%, #0a050f 100%)', border: '1px solid rgba(234, 179, 8, 0.5)'
        };
        return { 
            color: '#22c55e', text: 'SYSTEM HEALTHY',
            bg: 'linear-gradient(145deg, #0b1a0f 0%, #0a050f 100%)', border: '1px solid rgba(34, 197, 94, 0.5)'
        };
    };
    const alertTheme = getAlertTheme(daysLeft);

    const fetchProducts = async () => {
        try {
            const res = await getProducts('?limit=1000');
            setProducts(res.data || []);
        } catch (err) {
            console.error("Failed to fetch products", err);
        }
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess('');
        try {
            await recordSale({ sku, quantity: Number(quantity), date });
            setSuccess(`Successfully recorded sale for ${quantity}x ${sku}`);
            setSku('');
            setQuantity(1);
            fetchSales();
        } catch (err) {
            setError('Failed to record sale: ' + err.message);
        }
    };

    const handleCsvUpload = async (e) => {
        e.preventDefault();
        if (!file) return;
        setError(null);
        setSuccess('');
        setLoading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await uploadSalesCSV(formData);
            setSuccess(`Successfully processed CSV: ${res.processed} rows processed.`);
            setFile(null);
            document.getElementById('csvFileInput').value = ''; // Reset input
            fetchSales();
        } catch (err) {
            setError('Failed to upload CSV: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async () => {
        setEmailing(true);
        try {
            const res = await triggerAdminEmail({ days_left: daysLeft });
            if(res.status === 'success') {
                setSuccess('Official Admin Email sent to aadithyabanda@gmail.com!');
                setShowReminder(false);
            } else {
                setError('Failed to send email: ' + res.message);
            }
        } catch (err) {
            setError('Error sending email: ' + err.message);
        } finally {
            setEmailing(false);
        }
    };

    const CSS = `
.wrap{
  min-height:100vh;
  background:linear-gradient(135deg,#050508 0%,#0a050f 50%,#050510 100%);
  color:#e2e8f0;font-family:'Share Tech Mono',monospace;
  position:relative;overflow-x:hidden;
}
/* CARDS GRID */
.cards-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}

.cyber-card{
  position:relative;
  background:linear-gradient(135deg,rgba(15,15,25,.95),rgba(20,10,30,.95));
  border:1px solid rgba(249,115,22,.2);border-radius:4px;padding:28px;
  animation:fadeInUp .6s ease both;
  transition:border-color .3s, box-shadow .3s;
}
.cyber-card:hover{border-color:rgba(249,115,22,.4); box-shadow:0 0 15px rgba(249,115,22,.1)}
.cyber-card::before{content:'';position:absolute;top:-1px;left:-1px;width:14px;height:14px;border-top:2px solid rgba(249,115,22,.6);border-left:2px solid rgba(249,115,22,.6)}
.cyber-card::after{content:'';position:absolute;bottom:-1px;right:-1px;width:14px;height:14px;border-bottom:2px solid rgba(249,115,22,.6);border-right:2px solid rgba(249,115,22,.6)}

.card-title{font-family:'Orbitron',monospace;font-size:11px;font-weight:700;color:#f97316;letter-spacing:3px;margin-bottom:24px;text-shadow:0 0 5px rgba(249,115,22,.3)}

.field-label{font-size:10px;color:rgba(226,232,240,.4);letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;margin-top:16px}
.field-label:first-of-type{margin-top:0}

.cyber-input{
  width:100%;background:rgba(5,5,10,.8);
  border:1px solid rgba(249,115,22,.15);border-radius:2px;
  padding:12px 14px;color:#e2e8f0;font-family:'Share Tech Mono',monospace;
  font-size:13px;letter-spacing:1px;outline:none;transition:all .3s;
}
.cyber-input:focus{border-color:rgba(249,115,22,.5);box-shadow:0 0 8px rgba(249,115,22,.15);}
.cyber-input::placeholder{color:rgba(226,232,240,.2)}

.cyber-select {
  cursor: pointer;
}
.cyber-select option {
  background: #0a050f;
  color: #e2e8f0;
}

.record-btn{
  margin-top:20px;position:relative;
  background:linear-gradient(135deg,rgba(249,115,22,.8),rgba(234,88,12,.8));
  border:1px solid rgba(249,115,22,.4);padding:12px 24px;color:#fff;font-size:11px;letter-spacing:2px;
  font-family:'Orbitron',monospace;font-weight:700;text-transform:uppercase;
  cursor:pointer;clip-path:polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%);
  overflow:hidden;transition:all .3s;
}
.record-btn::before{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent);transition:left .5s}
.record-btn:hover::before{left:100%}
.record-btn:hover{box-shadow:0 0 12px rgba(249,115,22,.3); background:linear-gradient(135deg,#f97316,#ea580c);}
.record-btn:disabled{opacity:0.5;cursor:not-allowed; box-shadow:none;}

/* CSV CARD */
.csv-hint{font-size:11px;color:rgba(226,232,240,.35);letter-spacing:1px;margin-bottom:20px;line-height:1.8}
.csv-hint code{color:#f97316;background:rgba(249,115,22,.1);padding:1px 6px;border-radius:2px;font-family:'Share Tech Mono',monospace}

.csv-select-label{font-size:10px;color:rgba(226,232,240,.4);letter-spacing:3px;text-transform:uppercase;margin-bottom:12px}

.file-row{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.choose-btn{
  background:rgba(249,115,22,.05);border:1px solid rgba(249,115,22,.3);
  color:#f97316;font-family:'Orbitron',monospace;font-size:10px;letter-spacing:2px;
  padding:8px 16px;cursor:pointer;border-radius:2px;transition:all .3s;white-space:nowrap;
}
.choose-btn:hover{background:rgba(249,115,22,.15)}
.file-name{font-size:11px;color:rgba(226,232,240,.3);letter-spacing:1px}

.upload-btn{
  position:relative;background:linear-gradient(135deg,rgba(34,197,94,.8),rgba(22,163,74,.8));
  border:1px solid rgba(34,197,94,.4);padding:12px 24px;color:#fff;font-size:11px;letter-spacing:2px;
  font-family:'Orbitron',monospace;font-weight:700;text-transform:uppercase;
  cursor:pointer;clip-path:polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%);
  overflow:hidden;transition:all .3s;
}
.upload-btn:hover{box-shadow:0 0 12px rgba(34,197,94,.3); background:linear-gradient(135deg,#22c55e,#16a34a);}
.upload-btn:disabled{opacity:0.5;cursor:not-allowed; box-shadow:none;}

/* HISTORY TABLE */
.history-card{
  position:relative;
  background:linear-gradient(135deg,rgba(15,15,25,.95),rgba(20,10,30,.95));
  border:1px solid rgba(249,115,22,.2);border-radius:4px;overflow:hidden;
  animation:fadeInUp .6s ease .3s both;
  transition:border-color .3s, box-shadow .3s;
}
.history-card:hover{border-color:rgba(249,115,22,.4); box-shadow:0 0 15px rgba(249,115,22,.1)}
.history-card::before{content:'';position:absolute;top:-1px;left:-1px;width:14px;height:14px;border-top:2px solid rgba(249,115,22,.6);border-left:2px solid rgba(249,115,22,.6);z-index:1}
.history-card::after{content:'';position:absolute;bottom:-1px;right:-1px;width:14px;height:14px;border-bottom:2px solid rgba(249,115,22,.6);border-right:2px solid rgba(249,115,22,.6);z-index:1}

.history-header{
  display:flex;justify-content:space-between;align-items:center;
  padding:18px 24px;border-bottom:1px solid rgba(249,115,22,.15);
  background:rgba(249,115,22,.04);
}
.history-title{font-family:'Orbitron',monospace;font-size:11px;font-weight:700;color:#f97316;letter-spacing:3px;text-shadow:0 0 10px rgba(249,115,22,.4)}

.refresh-btn{
  background:transparent;border:1px solid rgba(249,115,22,.3);
  color:#f97316;font-family:'Orbitron',monospace;font-size:10px;letter-spacing:2px;
  padding:6px 16px;cursor:pointer;border-radius:2px;transition:all .3s;
}
.refresh-btn:hover{background:rgba(249,115,22,.1);border-color:#f97316}

.table-head{display:grid;grid-template-columns:1fr 1.2fr 1fr 1.5fr;padding:14px 24px;border-bottom:1px solid rgba(249,115,22,.15)}
.th{font-family:'Orbitron',monospace;font-size:9px;font-weight:700;color:#f97316;letter-spacing:3px;text-shadow:0 0 8px rgba(249,115,22,.4)}

.table-row{
  display:grid;grid-template-columns:1fr 1.2fr 1fr 1.5fr;
  padding:16px 24px;border-bottom:1px solid rgba(249,115,22,.06);
  border-left:2px solid transparent;transition:all .2s;cursor:pointer;
}
.table-row:last-child{border-bottom:none}
.table-row:hover{background:rgba(249,115,22,.04);border-left-color:#f97316}

.td-date{font-size:12px;color:rgba(226,232,240,.5);letter-spacing:1px;display:flex;align-items:center;gap:8px}
.dot{width:5px;height:5px;background:#f97316;border-radius:50%;box-shadow:0 0 5px #f97316;flex-shrink:0}
.td-sku{font-family:'Orbitron',monospace;font-size:11px;font-weight:700;color:#e2e8f0;letter-spacing:1px}
.td-qty{font-family:'Orbitron',monospace;font-size:14px;font-weight:700;color:#f97316;text-shadow:0 0 8px rgba(249,115,22,.5)}
.td-user{font-size:11px;color:rgba(226,232,240,.4);letter-spacing:1px}

@keyframes inputGlow{0%,100%{box-shadow:0 0 0px transparent}50%{box-shadow:0 0 10px rgba(249,115,22,.3)}}

.status-bar{margin-top:24px;display:flex;gap:28px;animation:fadeInUp .6s ease .7s both}
.stat{display:flex;align-items:center;gap:8px;font-size:10px;letter-spacing:2px}
.stat-dot{width:7px;height:7px;border-radius:50%}
.stat-label{color:rgba(226,232,240,.3)}
.stat-val{font-family:'Orbitron',monospace;font-weight:700}
    `;

    return (
        <>
            <style>{CSS}</style>
            <div className="wrap" style={{ position: 'relative', zIndex: 10, padding: '32px' }}>
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px', animation: 'slideInLeft .6s ease' }}>
                    <div>
                        <div className="page-subtitle" style={{ fontSize: '11px', color: '#f97316', letterSpacing: '2px', marginBottom: '6px', textShadow: '0 0 10px rgba(249,115,22,.5)' }}>// SYSTEM MODULE: M2</div>
                        <h1 className="page-title">SALES <span>MANAGEMENT</span></h1>
                        <div className="title-bar" />
                    </div>
                    {/* Notify Indicator Top Right */}
                    <button 
                        onClick={() => setShowReminder(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            background: 'rgba(10,5,15,0.8)', border: alertTheme.border,
                            padding: '12px 20px', borderRadius: '4px', cursor: 'pointer',
                            boxShadow: `0 0 15px ${alertTheme.color}33`, transition: 'all 0.3s',
                        }}
                    >
                        <div style={{ width: '8px', height: '8px', background: alertTheme.color, borderRadius: '50%', boxShadow: `0 0 10px ${alertTheme.color}`, animation: 'pulse 1.5s infinite' }} />
                        <span style={{ color: alertTheme.color, fontFamily: "'Orbitron', monospace", fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold' }}>
                            NOTIFY
                        </span>
                    </button>
                </div>

                {error && <div style={{ background: 'rgba(239,68,68,.1)', color: '#ef4444', padding: '16px', borderRadius: '4px', fontSize: '12px', border: '1px solid rgba(239,68,68,.3)', marginBottom: '16px' }}>{error}</div>}
                {success && <div style={{ background: 'rgba(34,197,94,.1)', color: '#22c55e', padding: '16px', borderRadius: '4px', fontSize: '12px', border: '1px solid rgba(34,197,94,.3)', marginBottom: '16px' }}>{success}</div>}

                <div className="cards-grid">
                    {/* Manual Entry Form */}
                    <div className="cyber-card" style={{ animationDelay: ".1s" }}>
                        <h2 className="card-title">◈ RECORD SALE MANUALLY</h2>
                        <form onSubmit={handleManualSubmit}>
                            <div className="field-label">SKU</div>
                            <select
                                required
                                className="cyber-input cyber-select"
                                value={sku}
                                onChange={(e) => setSku(e.target.value)}
                            >
                                <option value="" disabled>Select a SKU</option>
                                {products.map(p => (
                                    <option key={p.sku} value={p.sku}>
                                        {p.sku} {p.product_name ? `- ${p.product_name}` : ''}
                                    </option>
                                ))}
                            </select>

                            <div className="field-label">Quantity</div>
                            <input
                                required
                                className="cyber-input"
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                            />

                            <div className="field-label">Date</div>
                            <input
                                required
                                className="cyber-input"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                style={{ colorScheme: "dark" }}
                            />

                            <button
                                type="submit"
                                disabled={loading || !sku}
                                className="record-btn"
                            >
                                ⬡ RECORD SALE
                            </button>
                        </form>
                    </div>

                    {/* CSV Upload Form */}
                    <div className="cyber-card" style={{ animationDelay: ".2s" }}>
                        <h2 className="card-title">◈ BULK UPLOAD VIA CSV</h2>
                        <div className="csv-hint">
                            CSV must contain headers&nbsp;
                            <code>sku</code>, <code>quantity</code>, <code>date</code>.
                        </div>

                        <form onSubmit={handleCsvUpload}>
                            <div className="csv-select-label">Select CSV File</div>

                            <div className="file-row">
                                <label>
                                    <input
                                        type="file"
                                        id="csvFileInput"
                                        accept=".csv"
                                        required
                                        style={{ display: "none" }}
                                        onChange={(e) => setFile(e.target.files[0])}
                                    />
                                    <span className="choose-btn">CHOOSE FILE</span>
                                </label>
                                <span className="file-name">{file ? file.name : "No file chosen"}</span>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !file}
                                className="upload-btn"
                            >
                                ⬆ {loading && file ? 'UPLOADING...' : 'UPLOAD CSV'}
                            </button>

                            {/* Decorative data lines */}
                            <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 8 }}>
                                {["SKU_ID · QUANTITY · DATE", "FORMAT: CSV / UTF-8", "MAX SIZE: 10MB"].map((t, i) => (
                                    <div key={i} style={{
                                        fontSize: 9, color: "rgba(226,232,240,.15)", letterSpacing: 2,
                                        display: "flex", alignItems: "center", gap: 8
                                    }}>
                                        <div style={{ width: 3, height: 3, background: "rgba(249,115,22,.3)", borderRadius: "50%" }} />
                                        {t}
                                    </div>
                                ))}
                            </div>
                        </form>
                    </div>
                </div>

                {/* Sales History Table */}
                <div className="history-card">
                    <div className="history-header">
                        <h2 className="history-title">◈ RECENT SALES HISTORY</h2>
                        <button onClick={fetchSales} disabled={loading} className="refresh-btn">
                            ↻ REFRESH
                        </button>
                    </div>

                    {loading && !sales.length ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(226,232,240,.4)' }}>Loading sales history...</div>
                    ) : sales.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(226,232,240,.4)' }}>No sales recorded yet.</div>
                    ) : (
                        <>
                            <div className="table-head">
                                <div className="th">DATE</div>
                                <div className="th">SKU</div>
                                <div className="th">QUANTITY</div>
                                <div className="th">RECORDED BY</div>
                            </div>

                            {sales.slice(0, 50).map((sale, i) => (
                                <div
                                    key={i}
                                    className="table-row"
                                    style={{ animationDelay: `${.4 + i * .08}s`, animation: "fadeInUp .5s ease both" }}
                                >
                                    <div className="td-date">
                                        <span className="dot" />
                                        {sale.date}
                                    </div>
                                    <div className="td-sku">{sale.sku}</div>
                                    <div className="td-qty">{String(sale.quantity || 1).padStart(2, "0")}</div>
                                    <div className="td-user">{sale.recorded_by}</div>
                                </div>
                            ))}

                            {sales.length > 50 && (
                                <div style={{ padding: '12px', textAlign: 'center', fontSize: '10px', color: 'rgba(226,232,240,.3)', background: 'rgba(0,0,0,.2)' }}>
                                    Showing last 50 entries.
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Status bar */}
                <div className="status-bar">
                    {[
                        { label: "SYSTEM STATUS", val: "ONLINE", color: "#22c55e" },
                        { label: "MODULE", val: "M2", color: "#f97316" },
                        { label: "RECORDS", val: `${sales.length}`, color: "#3b82f6" },
                        { label: "LAST SYNC", val: "LIVE", color: "#818cf8" },
                    ].map(s => (
                        <div key={s.label} className="stat">
                            <span className="stat-dot" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
                            <span className="stat-label">{s.label}:</span>
                            <span className="stat-val" style={{ color: s.color }}>{s.val}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Proactive AI Reminder Modal */}
            {showReminder && (
                <div style={{
                    position: "fixed", inset: 0,
                    background: "rgba(6, 10, 16, 0.85)", backdropFilter: "blur(8px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "16px", zIndex: 9999, animation: "fadeIn .3s ease"
                }}>
                    <div style={{
                        background: alertTheme.bg,
                        border: alertTheme.border,
                        boxShadow: `0 0 0 1px ${alertTheme.color}33, 0 0 80px ${alertTheme.color}22, 0 40px 80px rgba(0,0,0,0.8)`,
                        borderRadius: "16px", padding: "32px", maxWidth: "450px", width: "100%", position: "relative"
                    }}>
                        <button onClick={() => setShowReminder(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ width: '12px', height: '12px', background: alertTheme.color, borderRadius: '50%', boxShadow: `0 0 12px ${alertTheme.color}`, animation: 'pulse 1s infinite' }} />
                            <h3 className="text-xl font-bold" style={{ fontFamily: "'Orbitron', sans-serif", color: alertTheme.color, letterSpacing: '2px', textShadow: `0 0 10px ${alertTheme.color}88`, margin: 0 }}>{alertTheme.text}</h3>
                        </div>
                        
                        {/* Admin Simulation Removed */}

                        <p style={{ fontSize: '14px', color: '#e2e8f0', marginBottom: '12px', lineHeight: '1.6', fontFamily: "'Share Tech Mono', monospace" }}>
                            You have exactly <strong style={{ color: alertTheme.color, fontSize: '18px', letterSpacing: '2px', padding: '0 4px' }}>{daysLeft} DAYS LEFT</strong> before the AI Retraining cycle locks in.
                        </p>
                        
                        <div style={{ background: `${alertTheme.color}11`, borderLeft: `3px solid ${alertTheme.color}`, padding: '12px 16px', marginBottom: '24px' }}>
                            <p style={{ fontSize: '12px', color: 'rgba(226,232,240,0.8)', margin: 0, fontFamily: "'Share Tech Mono', monospace" }}>
                                {daysLeft <= 15 ? 
                                    (<span>⚠️ <strong>WARNING:</strong> Missing data will severely damage next month's inventory forecasts. You must upload the final Bulk Sales CSV for this month immediately.</span>) :
                                    (<span>✅ <strong>HEALTHY:</strong> You have plenty of time. If you have an updated CSV from your POS, you can securely upload it so the AI stays fresh.</span>)
                                }
                            </p>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {daysLeft <= 8 && user && (user.email === 'aadithyabanda@gmail.com' || user.email === 'Admin@test.com' || user.role === 'admin') && (
                                <button onClick={handleSendEmail} disabled={emailing}
                                    style={{
                                    flex: 1, padding: "14px", background: `linear-gradient(135deg, rgba(239, 68, 68, 0.8), rgba(185, 28, 28, 0.8))`, 
                                    color: "#fff", fontWeight: "bold", border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: "6px", cursor: emailing ? "wait" : "pointer", 
                                    fontFamily: "'Orbitron', monospace", letterSpacing: '2px', boxShadow: `0 0 20px rgba(239, 68, 68, 0.4)`,
                                    transition: 'all 0.3s'
                                }}>
                                    {emailing ? 'SENDING EMAIL...' : 'SEND OFFICIAL EMAIL'}
                                </button>
                            )}
                            
                            <button onClick={() => {
                                setShowReminder(false);
                                document.getElementById('csvFileInput')?.click();
                            }} style={{
                                flex: 1, padding: "14px", background: `linear-gradient(135deg, ${alertTheme.color}ee, ${alertTheme.color}aa)`, 
                                color: "#fff", fontWeight: "bold", border: alertTheme.border, borderRadius: "6px", cursor: "pointer", 
                                fontFamily: "'Orbitron', monospace", letterSpacing: '2px', boxShadow: `0 0 20px ${alertTheme.color}66`,
                                transition: 'all 0.3s'
                            }}>
                                UPLOAD CSV NOW
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
