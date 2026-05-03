import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProduct, getStockAdvice, getProducts, migrateSKU } from '../services/api';
import { validateSKU, validateNumericLimit, sanitizeString } from "../utils/validation";

export default function AddProduct() {
    const nav = useNavigate();
    const [activeTab, setActiveTab] = useState('onboard'); // 'onboard' or 'correct'
    
    // ONBOARD STATE
    const [sku, setSku] = useState('');
    const [name, setName] = useState('');
    const [cat, setCat] = useState('Electronics');
    const [price, setPrice] = useState(0);
    const [stock, setStock] = useState(0);
    const [lead, setLead] = useState(7);

    // CORRECT SKU STATE
    const [products, setProducts] = useState([]);
    const [oldSku, setOldSku] = useState('');
    const [newSku, setNewSku] = useState('');

    const [advice, setAdvice] = useState(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [daysLeft, setDaysLeft] = useState(0);

    // Calculate Days Left in Month
    useEffect(() => {
        const today = new Date();
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const diff = Math.ceil((endOfMonth - today) / (1000 * 60 * 60 * 24));
        setDaysLeft(diff);
    }, []);

    // Fetch products on mount to populate correct tab and ML Portfolio Dashboard
    useEffect(() => {
        setLoading(true);
        getProducts('?limit=1000')
            .then(res => { setProducts(res.data || []); setLoading(false); })
            .catch(e => { setErr(e.message); setLoading(false); });
    }, []);

    // Auto-fetch ML proxy advice when Category or Lead Time changes
    useEffect(() => {
        let active = true;
        if (!cat || !lead || activeTab !== 'onboard') return;

        setLoading(true);
        getStockAdvice(cat, lead)
            .then(res => { if (active) setAdvice(res); })
            .catch(e => console.error("ML Advice error:", e))
            .finally(() => { if (active) setLoading(false); });

        return () => { active = false; };
    }, [cat, lead, activeTab]);

    const handleSubmitOnboard = async (e) => {
        e.preventDefault();
        setErr('');
        
        const skuErr = validateSKU(sku);
        const nameErr = sanitizeString(name, 'Product Name');
        const priceErr = validateNumericLimit(price, 'Unit Price', 0);
        const stockErr = validateNumericLimit(stock, 'Opening Stock', 0);
        const leadErr = validateNumericLimit(lead, 'Lead Time', 1);

        let categoryPriceErr = '';
        const priceVal = parseFloat(price);
        if (cat === 'Electronics' && priceVal < 5000) {
            categoryPriceErr = 'Electronics governance constraint: Unit Price must be >= Rs. 5,000.';
        } else if (cat === 'Home Goods' && priceVal < 500) {
            categoryPriceErr = 'Home Goods governance constraint: Unit Price must be >= Rs. 500.';
        } else if (cat === 'Apparel' && priceVal < 1000) {
            categoryPriceErr = 'Apparel governance constraint: Unit Price must be >= Rs. 1,000.';
        }

        if (skuErr || nameErr || priceErr || categoryPriceErr || stockErr || leadErr) {
            setErr(skuErr || nameErr || priceErr || categoryPriceErr || stockErr || leadErr);
            return;
        }

        try {
            await createProduct({
                sku,
                product_name: name,
                category: cat,
                unit_price: parseFloat(price),
                opening_stock: parseInt(stock),
                lead_time_days: parseInt(lead)
            });
            nav('/inventory');
        } catch (e) {
            setErr(e.message);
        }
    };

    const handleMigrate = async (e) => {
        e.preventDefault();
        setErr('');
        const skuErr = validateSKU(newSku);
        if (skuErr) return setErr(skuErr);
        
        try {
            setLoading(true);
            await migrateSKU(oldSku, newSku);
            setErr('');
            alert('SKU Successfully Migrated!');
            nav('/inventory');
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'relative', zIndex: 10, padding: '32px' }}>
            <div className="flex justify-between items-center mb-6" style={{ animation: 'slideInLeft .6s ease' }}>
                <div>
                    <h1 className="page-title" style={{ fontFamily: "'Outfit', monospace", fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '4px', textShadow: '0 0 30px rgba(249,115,22,.3)' }}>PRODUCT <span>CONTROL</span></h1>
                    <div className="title-bar" style={{ marginTop: '6px', height: '2px', width: '200px', background: 'linear-gradient(90deg, #f97316, transparent)', boxShadow: '0 0 10px rgba(249,115,22,.4)' }} />
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <button onClick={() => {setActiveTab('onboard'); setErr('');}} 
                    style={{ padding: '12px 24px', background: activeTab === 'onboard' ? 'rgba(249,115,22,0.2)' : 'transparent', border: `1px solid ${activeTab === 'onboard' ? '#f97316' : 'rgba(226,232,240,0.2)'}`, color: activeTab === 'onboard' ? '#f97316' : '#94a3b8', borderRadius: '4px', cursor: 'pointer', fontFamily: "'Outfit', monospace", fontWeight: 'bold', transition: 'all 0.3s' }}>
                    ➕ ONBOARD NEW
                </button>
                <button onClick={() => {setActiveTab('correct'); setErr('');}} 
                    style={{ padding: '12px 24px', background: activeTab === 'correct' ? 'rgba(59,130,246,0.2)' : 'transparent', border: `1px solid ${activeTab === 'correct' ? '#3b82f6' : 'rgba(226,232,240,0.2)'}`, color: activeTab === 'correct' ? '#3b82f6' : '#94a3b8', borderRadius: '4px', cursor: 'pointer', fontFamily: "'Outfit', monospace", fontWeight: 'bold', transition: 'all 0.3s' }}>
                    ✏️ CORRECT WRONG SKU
                </button>
            </div>

            {err && <div style={{ background: 'rgba(239,68,68,.1)', color: '#ef4444', padding: '16px', borderRadius: '4px', fontSize: '12px', border: '1px solid rgba(239,68,68,.3)', marginBottom: '16px' }}>{err}</div>}

            {activeTab === 'onboard' && (
                <>
                    {daysLeft > 7 && (
                        <div style={{ background: 'rgba(234,179,8,.1)', color: '#eab308', padding: '16px', borderRadius: '4px', fontSize: '12px', border: '1px dashed rgba(234,179,8,.4)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '16px' }}>🔒</span>
                            <div>
                                <strong style={{ display: 'block', letterSpacing: '1px', marginBottom: '4px', fontFamily: "'Outfit', monospace" }}>SYSTEM GOVERNANCE LOCK ACTIVE</strong>
                                You cannot onboard new products right now. To ensure pristine ML training data intervals, Product Managers are strictly limited to adding new SKUs only during the <strong>final 7 days of the month</strong>.
                                <br/><span style={{ color: 'rgba(234,179,8,.7)' }}>(Currently {daysLeft} days remaining)</span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                        <form onSubmit={handleSubmitOnboard} style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(249,115,22,.2)', borderRadius: '3px', padding: '24px', animation: 'fadeInUp .5s ease both', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                            <div>
                                <label style={{ display: 'block', fontSize: '10px', color: 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>SKU</label>
                                <input required value={sku} onChange={e => setSku(e.target.value)}
                                    style={{ width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(249,115,22,.3)', padding: '10px', color: '#fff', borderRadius: '2px', outline: 'none', transition: 'border-color .2s', fontFamily: "'Inter', sans-serif" }}
                                    onFocus={(e) => e.target.style.borderColor = '#f97316'} onBlur={(e) => e.target.style.borderColor = 'rgba(249,115,22,.3)'} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '10px', color: 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Product Name</label>
                                <input required value={name} onChange={e => setName(e.target.value)}
                                    style={{ width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(249,115,22,.3)', padding: '10px', color: '#fff', borderRadius: '2px', outline: 'none', transition: 'border-color .2s', fontFamily: "'Inter', sans-serif" }}
                                    onFocus={(e) => e.target.style.borderColor = '#f97316'} onBlur={(e) => e.target.style.borderColor = 'rgba(249,115,22,.3)'} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '10px', color: 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Category</label>
                                <select required value={cat} onChange={e => setCat(e.target.value)}
                                    style={{ width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(249,115,22,.3)', padding: '10px', color: '#fff', borderRadius: '2px', outline: 'none', transition: 'border-color .2s', fontFamily: "'Inter', sans-serif" }}
                                    onFocus={(e) => e.target.style.borderColor = '#f97316'} onBlur={(e) => e.target.style.borderColor = 'rgba(249,115,22,.3)'}>
                                    <option value="Electronics" style={{ background: '#0a050f' }}>Electronics</option>
                                    <option value="Home Goods" style={{ background: '#0a050f' }}>Home Goods</option>
                                    <option value="Apparel" style={{ background: '#0a050f' }}>Apparel</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label style={{ display: 'block', fontSize: '10px', color: 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Unit Price</label>
                                    <input required type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                                        style={{ width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(249,115,22,.3)', padding: '10px', color: '#fff', borderRadius: '2px', outline: 'none', transition: 'border-color .2s', fontFamily: "'Inter', sans-serif" }}
                                        onFocus={(e) => e.target.style.borderColor = '#f97316'} onBlur={(e) => e.target.style.borderColor = 'rgba(249,115,22,.3)'} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '10px', color: 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Opening Stock</label>
                                    <input required type="number" min="0" value={stock} onChange={e => setStock(e.target.value)}
                                        style={{ width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(249,115,22,.3)', padding: '10px', color: '#fff', borderRadius: '2px', outline: 'none', transition: 'border-color .2s', fontFamily: "'Inter', sans-serif" }}
                                        onFocus={(e) => e.target.style.borderColor = '#f97316'} onBlur={(e) => e.target.style.borderColor = 'rgba(249,115,22,.3)'} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '10px', color: 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Lead Time (Days)</label>
                                <input required type="number" min="1" value={lead} onChange={e => setLead(e.target.value)}
                                    style={{ width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(249,115,22,.3)', padding: '10px', color: '#fff', borderRadius: '2px', outline: 'none', transition: 'border-color .2s', fontFamily: "'Inter', sans-serif" }}
                                    onFocus={(e) => e.target.style.borderColor = '#f97316'} onBlur={(e) => e.target.style.borderColor = 'rgba(249,115,22,.3)'} />
                            </div>

                            <div className="pt-4">
                                <button type="submit" disabled={daysLeft > 7} className="refresh-btn" style={{ width: '100%', background: daysLeft > 7 ? 'rgba(0,0,0,.5)' : 'transparent', border: `1px solid ${daysLeft > 7 ? 'rgba(249,115,22,.1)' : 'rgba(249,115,22,.4)'}`, padding: '12px', color: daysLeft > 7 ? 'rgba(249,115,22,.3)' : '#f97316', fontSize: '11px', letterSpacing: '2px', fontFamily: "'Outfit', monospace", fontWeight: 700, cursor: daysLeft > 7 ? 'not-allowed' : 'pointer', borderRadius: '2px', transition: 'all .3s' }}
                                    onMouseEnter={(e) => { if (daysLeft <= 7) { e.currentTarget.style.background = 'rgba(249,115,22,.1)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(249,115,22,.3)' } }}
                                    onMouseLeave={(e) => { if (daysLeft <= 7) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none' } }}>
                                    {daysLeft > 7 ? 'LOCKED: AWAITING END OF MONTH' : 'CREATE PRODUCT (COLD-START)'}
                                </button>
                            </div>
                        </form>

                        {/* Live ML Advice Panel */}
                        <div style={{ background: 'linear-gradient(135deg, rgba(8,12,28,.97), rgba(8,8,22,.97))', border: '1px solid rgba(59,130,246,.3)', borderRadius: '3px', padding: '24px', height: 'fit-content', position: 'sticky', top: '24px', animation: 'fadeInUp .5s ease .1s both' }}>
                            <h2 style={{ fontFamily: "'Outfit', monospace", fontSize: '12px', color: '#10b981', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', textShadow: '0 0 10px rgba(16,185,129,.5)' }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                LIVE ML ADVICE (RETRAINED MODEL)
                            </h2>
                            <p style={{ fontSize: '10px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px', marginBottom: '24px' }}>// CATEGORY BASELINE INFERENCE BASED ON CURRENT MARKET DATA</p>

                            {loading ? (
                                <div className="animate-pulse space-y-4">
                                    <div style={{ height: '16px', background: 'rgba(59,130,246,.2)', borderRadius: '2px', width: '75%' }}></div>
                                    <div style={{ height: '16px', background: 'rgba(59,130,246,.2)', borderRadius: '2px', width: '50%' }}></div>
                                </div>
                            ) : advice ? (
                                <div className="space-y-4">
                                    <div style={{ background: 'rgba(0,0,0,.3)', padding: '16px', borderRadius: '3px', border: '1px solid rgba(59,130,246,.2)' }}>
                                        <div style={{ fontSize: '10px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Recommended Stock</div>
                                        <div style={{ fontFamily: "'Outfit', monospace", fontSize: '32px', fontWeight: 900, color: '#3b82f6', textShadow: '0 0 16px rgba(59,130,246,.4)' }}>{advice.recommended || 0} UNITS</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div style={{ background: 'rgba(0,0,0,.3)', padding: '12px', borderRadius: '3px', border: '1px solid rgba(16,185,129,.1)' }}>
                                            <div style={{ fontSize: '9px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px' }}>BASELINE UNIT PRICE</div>
                                            <div style={{ fontFamily: "'Outfit', monospace", fontSize: '16px', fontWeight: 700, color: '#e2e8f0', marginTop: '4px' }}>Rs. {Math.round(advice.recommended_price || 0).toLocaleString()}</div>
                                        </div>
                                        <div style={{ background: 'rgba(0,0,0,.3)', padding: '12px', borderRadius: '3px', border: '1px solid rgba(16,185,129,.1)' }}>
                                            <div style={{ fontSize: '9px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px' }}>SUPPLY LEAD TIME</div>
                                            <div style={{ fontFamily: "'Outfit', monospace", fontSize: '16px', fontWeight: 700, color: '#e2e8f0', marginTop: '4px' }}>{advice.recommended_lead_time || 0} DAYS</div>
                                        </div>
                                        <div style={{ background: 'rgba(0,0,0,.3)', padding: '12px', borderRadius: '3px', border: '1px solid rgba(59,130,246,.1)' }}>
                                            <div style={{ fontSize: '9px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px' }}>REORDER POINT</div>
                                            <div style={{ fontFamily: "'Outfit', monospace", fontSize: '16px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{advice.reorder_point || 0}</div>
                                        </div>
                                        <div style={{ background: 'rgba(0,0,0,.3)', padding: '12px', borderRadius: '3px', border: '1px solid rgba(59,130,246,.1)' }}>
                                            <div style={{ fontSize: '9px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px' }}>CONFIDENCE</div>
                                            <div style={{ fontFamily: "'Outfit', monospace", fontSize: '10px', fontWeight: 700, color: '#eab308', marginTop: '4px', letterSpacing: '1px' }}>{advice.confidence}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: '10px', color: 'rgba(226,232,240,.3)', letterSpacing: '1px', padding: '16px', border: '1px dashed rgba(59,130,246,.2)', textAlign: 'center', borderRadius: '2px' }}>
                                    ENTER CATEGORY & LEAD TIME TO COMMENCE PREDICTION
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Category Investment Dashboard (ML Portfolio Matrix) */}
                    <div style={{ marginTop: '32px', padding: '24px', background: 'linear-gradient(135deg, rgba(8,12,28,.97), rgba(8,8,22,.97))', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '4px', animation: 'fadeInUp 0.6s ease' }}>
                        <h2 style={{ fontFamily: "'Outfit', monospace", fontSize: '14px', color: '#8b5cf6', letterSpacing: '2px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', textShadow: '0 0 10px rgba(139, 92, 246, 0.4)' }}>
                            📊 CATEGORY INVESTMENT PORTFOLIO (AI MATRIX)
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {['Electronics', 'Home Goods', 'Apparel'].map(category => {
                                const catProducts = products.filter(p => p.category === category);
                                const totalSKUs = catProducts.length;
                                
                                let health = 0;
                                let topSKU = 'None';
                                let action = 'SEED';
                                let theme = { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
                                
                                if (totalSKUs > 0) {
                                    let healthyCount = 0;
                                    let highestSales = -1;
                                    
                                    catProducts.forEach(p => {
                                        if (p.current_stock > 15) healthyCount++;
                                        const sales = p.sales_day_count || 0;
                                        if (sales > highestSales) {
                                            highestSales = sales;
                                            topSKU = p.sku;
                                        }
                                    });
                                    
                                    health = Math.round((healthyCount / totalSKUs) * 100);
                                    if (health < 40) {
                                        action = 'EMERGENCY BUY';
                                        theme = { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
                                    } else if (health < 75) {
                                        action = 'MAINTAIN';
                                        theme = { color: '#eab308', bg: 'rgba(234,179,8,0.1)' };
                                    } else {
                                        action = 'EXPAND ALLOC.';
                                        theme = { color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
                                    }
                                }

                                return (
                                    <div key={category} style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${theme.bg}`, borderRadius: '4px' }}>
                                        <div style={{ fontSize: '11px', color: 'rgba(226,232,240,0.6)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>{category}</div>
                                        
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>Portfolio Health:</span>
                                            <strong style={{ fontSize: '14px', color: theme.color, fontFamily: "'Space Mono', monospace" }}>{health}%</strong>
                                        </div>
                                        
                                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginBottom: '16px' }}>
                                            <div style={{ height: '100%', width: `${health}%`, background: theme.color }} />
                                        </div>
                                        
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>Top Performer:</span>
                                            <span style={{ fontSize: '10px', color: '#e2e8f0', fontFamily: "'Outfit', monospace" }}>{topSKU}</span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>AI Directive:</span>
                                            <span style={{ fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', color: theme.color, background: theme.bg, padding: '4px 8px', borderRadius: '2px' }}>{action}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'correct' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                    <form onSubmit={handleMigrate} style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(59,130,246,.2)', borderRadius: '3px', padding: '24px', animation: 'fadeInUp .5s ease both', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '10px', color: 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Select Target Product</label>
                            <select required value={oldSku} onChange={e => setOldSku(e.target.value)} disabled={loading}
                                style={{ width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(59,130,246,.3)', padding: '10px', color: '#fff', borderRadius: '2px', outline: 'none', transition: 'border-color .2s', fontFamily: "'Inter', sans-serif" }}
                                onFocus={(e) => e.target.style.borderColor = '#3b82f6'} onBlur={(e) => e.target.style.borderColor = 'rgba(59,130,246,.3)'}>
                                <option value="" disabled style={{ background: '#0a050f' }}>{loading ? "Loading products..." : "-- Select SKU with Typo --"}</option>
                                {products.map(p => (
                                    <option key={p.sku} value={p.sku} style={{ background: '#0a050f' }}>{p.sku} ({p.product_name || "Unknown"})</option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label style={{ display: 'block', fontSize: '10px', color: 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Enter Correct SKU String</label>
                            <input required value={newSku} onChange={e => setNewSku(e.target.value)} disabled={loading}
                                style={{ width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(59,130,246,.3)', padding: '10px', color: '#fff', borderRadius: '2px', outline: 'none', transition: 'border-color .2s', fontFamily: "'Inter', sans-serif" }}
                                onFocus={(e) => e.target.style.borderColor = '#3b82f6'} onBlur={(e) => e.target.style.borderColor = 'rgba(59,130,246,.3)'} />
                        </div>

                        <div className="pt-4">
                            <button type="submit" disabled={!oldSku || !newSku || loading} 
                                style={{ width: '100%', background: 'transparent', border: '1px solid rgba(59,130,246,.4)', padding: '12px', color: '#3b82f6', fontSize: '11px', letterSpacing: '2px', fontFamily: "'Outfit', monospace", fontWeight: 700, cursor: (!oldSku || !newSku || loading) ? 'not-allowed' : 'pointer', borderRadius: '2px', transition: 'all .3s', opacity: (!oldSku || !newSku || loading) ? 0.5 : 1 }}
                                onMouseEnter={(e) => { if (oldSku && newSku && !loading) { e.currentTarget.style.background = 'rgba(59,130,246,.1)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(59,130,246,.3)' } }}
                                onMouseLeave={(e) => { if (oldSku && newSku && !loading) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none' } }}>
                                {loading ? 'MIGRATING PRIMARY KEY...' : 'EXECUTE PRIMARY KEY MIGRATION'}
                            </button>
                        </div>
                    </form>

                    <div style={{ background: 'linear-gradient(135deg, rgba(8,8,22,.97), rgba(12,8,28,.97))', border: '1px solid rgba(239,68,68,.3)', borderRadius: '3px', padding: '24px', height: 'fit-content', animation: 'fadeInUp .5s ease .1s both' }}>
                        <h2 style={{ fontFamily: "'Outfit', monospace", fontSize: '12px', color: '#ef4444', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', textShadow: '0 0 10px rgba(239,68,68,.5)' }}>
                            ⚠️ PRIMARY KEY MIGRATION PROTOCOL
                        </h2>
                        
                        <p style={{ fontSize: '12px', color: 'rgba(226,232,240,.7)', lineHeight: '1.6', marginBottom: '16px', fontFamily: "'Inter', sans-serif" }}>
                            You are requesting to mathematically change the <strong>Document ID</strong> of a product. Be aware of the following constraints:
                        </p>
                        
                        <ul style={{ listStyleType: 'disc', paddingLeft: '16px', fontSize: '12px', color: 'rgba(226,232,240,.5)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li>The backend will completely clone the core inventory document over to the new requested string identifier.</li>
                            <li>The original mis-typed document will be physically purged from the database.</li>
                            <li><strong style={{ color: '#ef4444' }}>Sales Constraint Active:</strong> If the mis-typed SKU has already accumulated confirmed sales within the ledger, this migration request will be explicitly <strong style={{ color: '#f97316' }}>REJECTED</strong> by the backend to prevent historical accounting decoupling.</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
