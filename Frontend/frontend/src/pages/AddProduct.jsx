import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProduct, getStockAdvice } from '../services/api';

export default function AddProduct() {
    const nav = useNavigate();
    const [sku, setSku] = useState('');
    const [name, setName] = useState('');
    const [cat, setCat] = useState('Electronics');
    const [price, setPrice] = useState(0);
    const [stock, setStock] = useState(0);
    const [lead, setLead] = useState(7);

    const [advice, setAdvice] = useState(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [errors, setErrors] = useState({});
    const [daysLeft] = useState(0);

    const validate = () => {
        const newErrors = {};
        if (!sku) {
            newErrors.sku = "SKU is required";
        } else if (!/^sku-\w+$/i.test(sku)) {
            newErrors.sku = "SKU format must be like 'SKU-123'";
        }

        if (!name.trim()) newErrors.name = "Product name is required";
        if (!cat) newErrors.cat = "Category is required";
        if (price <= 0 || isNaN(price)) newErrors.price = "Price must be greater than 0";
        if (stock < 0 || isNaN(stock)) newErrors.stock = "Stock cannot be negative";
        if (lead <= 0 || isNaN(lead)) newErrors.lead = "Lead time must be at least 1";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleFocus = (e, field) => {
        e.target.style.borderColor = '#f97316';
        e.target.style.boxShadow = '0 0 8px rgba(249,115,22,.4)';
        if (errors[field]) {
            setErrors({ ...errors, [field]: null });
        }
    };

    const handleBlur = (e, field) => {
        e.target.style.borderColor = errors[field] ? '#ef4444' : 'rgba(249,115,22,.3)';
        e.target.style.boxShadow = errors[field] ? '0 0 8px rgba(239,68,68,.4)' : 'none';
    };

    const getInputStyle = (field) => ({
        width: '100%', 
        background: 'rgba(0,0,0,.3)', 
        border: `1px solid ${errors[field] ? '#ef4444' : 'rgba(249,115,22,.3)'}`, 
        padding: '10px', 
        color: '#fff', 
        borderRadius: '2px', 
        outline: 'none', 
        transition: 'all .2s ease-in-out', 
        fontFamily: "'Inter', sans-serif",
        boxShadow: errors[field] ? '0 0 8px rgba(239,68,68,.4)' : 'none'
    });



    // Auto-fetch ML proxy advice when Category or Lead Time changes
    useEffect(() => {
        let active = true;
        if (!cat || !lead) return;

        setLoading(true);
        getStockAdvice(cat, lead)
            .then(res => { if (active) setAdvice(res); })
            .catch(e => console.error("ML Advice error:", e))
            .finally(() => { if (active) setLoading(false); });

        return () => { active = false; };
    }, [cat, lead]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErr('');
        if (!validate()) return;
        
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

    return (
        <div style={{ position: 'relative', zIndex: 10, padding: '32px' }}>
            <div className="flex justify-between items-center mb-6" style={{ animation: 'slideInLeft .6s ease' }}>
                <div>

                    <h1 className="page-title" style={{ fontFamily: "'Outfit', monospace", fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '4px', textShadow: '0 0 30px rgba(249,115,22,.3)' }}>ONBOARD <span>PRODUCT</span></h1>
                    <div className="title-bar" style={{ marginTop: '6px', height: '2px', width: '200px', background: 'linear-gradient(90deg, #f97316, transparent)', boxShadow: '0 0 10px rgba(249,115,22,.4)' }} />
                </div>
            </div>

            {err && <div style={{ background: 'rgba(239,68,68,.1)', color: '#ef4444', padding: '16px', borderRadius: '4px', fontSize: '12px', border: '1px solid rgba(239,68,68,.3)', marginBottom: '16px' }}>{err}</div>}

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
                <form onSubmit={handleSubmit} style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(249,115,22,.2)', borderRadius: '3px', padding: '24px', animation: 'fadeInUp .5s ease both', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <div>
                        <label style={{ display: 'block', fontSize: '10px', color: errors.sku ? '#ef4444' : 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', transition: 'color .2s' }}>SKU</label>
                        <input value={sku} onChange={e => { setSku(e.target.value); if(errors.sku) setErrors({...errors, sku: null}); }}
                            style={getInputStyle('sku')}
                            onFocus={(e) => handleFocus(e, 'sku')} onBlur={(e) => handleBlur(e, 'sku')} />
                        {errors.sku && <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '6px', fontWeight: '500', animation: 'fadeInUp .3s ease' }}>{errors.sku}</div>}
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', color: errors.name ? '#ef4444' : 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', transition: 'color .2s' }}>Product Name</label>
                        <input value={name} onChange={e => { setName(e.target.value); if(errors.name) setErrors({...errors, name: null}); }}
                            style={getInputStyle('name')}
                            onFocus={(e) => handleFocus(e, 'name')} onBlur={(e) => handleBlur(e, 'name')} />
                        {errors.name && <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '6px', fontWeight: '500', animation: 'fadeInUp .3s ease' }}>{errors.name}</div>}
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', color: errors.cat ? '#ef4444' : 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', transition: 'color .2s' }}>Category</label>
                        <select value={cat} onChange={e => { setCat(e.target.value); if(errors.cat) setErrors({...errors, cat: null}); }}
                            style={getInputStyle('cat')}
                            onFocus={(e) => handleFocus(e, 'cat')} onBlur={(e) => handleBlur(e, 'cat')}>
                            <option value="Electronics" style={{ background: '#0a050f' }}>Electronics</option>
                            <option value="Home Goods" style={{ background: '#0a050f' }}>Home Goods</option>
                            <option value="Apparel" style={{ background: '#0a050f' }}>Apparel</option>
                        </select>
                        {errors.cat && <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '6px', fontWeight: '500', animation: 'fadeInUp .3s ease' }}>{errors.cat}</div>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label style={{ display: 'block', fontSize: '10px', color: errors.price ? '#ef4444' : 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', transition: 'color .2s' }}>Unit Price</label>
                            <input type="number" step="0.01" value={price} onChange={e => { setPrice(e.target.value); if(errors.price) setErrors({...errors, price: null}); }}
                                style={getInputStyle('price')}
                                onFocus={(e) => handleFocus(e, 'price')} onBlur={(e) => handleBlur(e, 'price')} />
                            {errors.price && <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '6px', fontWeight: '500', animation: 'fadeInUp .3s ease' }}>{errors.price}</div>}
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '10px', color: errors.stock ? '#ef4444' : 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', transition: 'color .2s' }}>Opening Stock</label>
                            <input type="number" value={stock} onChange={e => { setStock(e.target.value); if(errors.stock) setErrors({...errors, stock: null}); }}
                                style={getInputStyle('stock')}
                                onFocus={(e) => handleFocus(e, 'stock')} onBlur={(e) => handleBlur(e, 'stock')} />
                            {errors.stock && <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '6px', fontWeight: '500', animation: 'fadeInUp .3s ease' }}>{errors.stock}</div>}
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', color: errors.lead ? '#ef4444' : 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', transition: 'color .2s' }}>Lead Time (Days)</label>
                        <input type="number" value={lead} onChange={e => { setLead(e.target.value); if(errors.lead) setErrors({...errors, lead: null}); }}
                            style={getInputStyle('lead')}
                            onFocus={(e) => handleFocus(e, 'lead')} onBlur={(e) => handleBlur(e, 'lead')} />
                        {errors.lead && <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '6px', fontWeight: '500', animation: 'fadeInUp .3s ease' }}>{errors.lead}</div>}
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
        </div>
    );
}
