import { useState, useEffect, useMemo } from 'react';
import { getForecasts, triggerRetrain } from '../services/api';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line } from 'recharts';

export default function Forecasts() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [retraining, setRetraining] = useState(false);
    const [daysLeft, setDaysLeft] = useState(0);

    useEffect(() => { 
        load(); 
        
        // Calculate days left in the current month to sync with the Sales Module
        const today = new Date();
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const diff = Math.ceil((endOfMonth - today) / (1000 * 60 * 60 * 24));
        setDaysLeft(diff);
    }, []);

    const isDataReady = daysLeft <= 5; // Realism: Only unlocks in the final 5 days of the month when Sales is guaranteed to upload

    const load = async () => {
        setLoading(true);
        try {
            setData(await getForecasts());
        } finally { setLoading(false); }
    };

    const handleRetrain = async () => {
        if (!window.confirm("Trigger AI Model Retrain now? This runs in the background.")) return;
        setRetraining(true);
        try {
            await triggerRetrain();
            alert("Retrain pipeline started.");
        } catch (e) { alert("Error: " + e.message); }
        finally { setRetraining(false); }
    };

    // Aggregate by Category for Chart
    const chartData = Object.values(data.reduce((acc, curr) => {
        if (!acc[curr.category]) acc[curr.category] = { category: curr.category, total_forecast_7: 0, total_forecast_30: 0 };
        acc[curr.category].total_forecast_7 += curr.forecast_7d || 0;
        acc[curr.category].total_forecast_30 += curr.forecast_30d || 0;
        return acc;
    }, {}));

    // Calculate Pareto Data (80/20 Rule: SKU demand sorted descending with cumulative %)
    const skuDemands = data
        .map(curr => ({ sku: curr.sku, demand: curr.forecast_30d || 0, category: curr.category }))
        .sort((a, b) => b.demand - a.demand);

    let cumulative = 0;
    const totalDemand = skuDemands.reduce((sum, item) => sum + item.demand, 0);
    
    const paretoData = skuDemands.map((item, index) => {
        cumulative += item.demand;
        return {
            rank: index + 1,
            sku: item.sku,
            category: item.category,
            demand: Number(item.demand.toFixed(1)),
            cumulativePercentage: totalDemand > 0 ? Number(((cumulative / totalDemand) * 100).toFixed(1)) : 0
        };
    });

    const COLORS = ['#f97316', '#8b5cf6', '#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#fbbf24', '#a855f7', '#06b6d4', '#22c55e', '#f43f5e', '#eab308'];

    // --- DSA Filtering & Sorting Logic ---
    const processedData = useMemo(() => {
        let filtered = data.filter((item) => 
            item.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
            item.category.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];
                
                if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                if (typeof bVal === 'string') bVal = bVal.toLowerCase();

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [data, searchTerm, sortConfig]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return ' ↕';
        return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
    };
    // ------------------------------------

    if (loading) return <div className="p-8 text-center text-gray-500">Loading forecast data...</div>;

    return (
        <div style={{ position: 'relative', zIndex: 10, padding: '32px' }}>
            <div className="flex justify-between items-center mb-6" style={{ animation: 'slideInLeft .6s ease' }}>
                <div>

                    <h1 className="page-title" style={{ fontFamily: "'Outfit', monospace", fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '4px', textShadow: '0 0 30px rgba(249,115,22,.3)' }}>DEMAND <span>FORECASTS</span></h1>
                    <div className="title-bar" style={{ marginTop: '6px', height: '2px', width: '200px', background: 'linear-gradient(90deg, #f97316, transparent)', boxShadow: '0 0 10px rgba(249,115,22,.4)' }} />
                </div>
                
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {/* Dynamic AI Sync Notification */}
                    <div style={{ 
                        padding: '8px 16px', 
                        borderRadius: '2px', 
                        fontFamily: "'Outfit', monospace", 
                        fontSize: '10px', 
                        fontWeight: 700, 
                        letterSpacing: '1px',
                        border: isDataReady ? '1px solid rgba(34,197,94,.5)' : '1px dashed rgba(234,179,8,.5)',
                        color: isDataReady ? '#22c55e' : '#eab308',
                        background: isDataReady ? 'rgba(34,197,94,.05)' : 'rgba(234,179,8,.05)',
                        boxShadow: isDataReady ? '0 0 15px rgba(34,197,94,.2)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.5s ease'
                    }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDataReady ? '#22c55e' : '#eab308', boxShadow: `0 0 10px ${isDataReady ? '#22c55e' : '#eab308'}` }} />
                        {isDataReady ? 'SALES DATA SYNCED' : 'AWAITING SALES UPLOAD'}
                    </div>

                    <button onClick={handleRetrain} disabled={retraining}
                        title={!isDataReady ? "Warning: Sales data might be incomplete. Retraining is not advised." : "Data is ready. Start ML Pipeline."}
                        className="refresh-btn" style={{ 
                            position: 'relative', 
                            background: isDataReady ? 'rgba(34,197,94,.15)' : 'transparent', 
                            border: `1px solid ${isDataReady ? '#22c55e' : 'rgba(249,115,22,.4)'}`, 
                            padding: '10px 20px', 
                            color: isDataReady ? '#22c55e' : '#f97316', 
                            fontSize: '10px', 
                            letterSpacing: '2px', 
                            fontFamily: "'Outfit', monospace", 
                            fontWeight: 700, 
                            cursor: retraining ? 'wait' : 'pointer', 
                            borderRadius: '2px', 
                            transition: 'all .3s',
                            boxShadow: isDataReady ? '0 0 20px rgba(34,197,94,.3)' : 'none'
                        }}>
                        {retraining ? 'TRIGGERING...' : (isDataReady ? 'RETRAIN AI NOW' : 'MANUAL RETRAIN')}
                    </button>
                </div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(249,115,22,.2)', borderRadius: '3px', padding: '16px', animation: 'fadeInUp .5s ease both', marginBottom: '32px' }}>
                <h2 style={{ fontFamily: "'Outfit', monospace", fontSize: '12px', color: '#e2e8f0', letterSpacing: '1px', marginBottom: '16px' }}>
                    FORWARD DEMAND FORECAST BY CATEGORY ({new Date().toLocaleString('default', { month: 'long' }).toUpperCase()})
                    <span style={{ fontSize: '9px', color: 'rgba(226,232,240,.4)', marginLeft: '12px', letterSpacing: '1px' }}>// TRAINED ON {new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleString('default', { month: 'long' }).toUpperCase()} EOM DATA</span>
                </h2>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <XAxis dataKey="category" stroke="rgba(226,232,240,.3)" tick={{ fill: 'rgba(226,232,240,.5)', fontSize: 10 }} />
                            <YAxis stroke="rgba(226,232,240,.3)" tick={{ fill: 'rgba(226,232,240,.5)', fontSize: 10 }} />
                            <Tooltip cursor={{ fill: 'rgba(249,115,22,.1)' }} contentStyle={{ backgroundColor: 'rgba(12,12,22,.95)', border: '1px solid rgba(249,115,22,.4)', color: '#fff' }} />
                            <Legend wrapperStyle={{ fontSize: "11px", color: "rgba(226,232,240,.5)" }} />
                            <Bar dataKey="total_forecast_7" fill="#8884d8" name={`7-Day Demand (${new Date().toLocaleString('default', { month: 'short' })})`} />
                            <Bar dataKey="total_forecast_30" fill="#f97316" name={`30-Day Demand (${new Date().toLocaleString('default', { month: 'short' })})`} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(244,63,94,.2)', borderRadius: '3px', padding: '16px', animation: 'fadeInUp .55s ease both', marginBottom: '32px' }}>
                <h2 style={{ fontFamily: "'Outfit', monospace", fontSize: '12px', color: '#e2e8f0', letterSpacing: '1px', marginBottom: '16px' }}>SKU DEMAND DISTRIBUTION (PARETO 80/20 ANALYSIS FOR {new Date().toLocaleString('default', { month: 'long' }).toUpperCase()})</h2>
                <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={paretoData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <XAxis dataKey="sku" stroke="rgba(226,232,240,.3)" tick={false} />
                            <YAxis yAxisId="left" stroke="rgba(226,232,240,.3)" tick={{ fill: 'rgba(226,232,240,.5)', fontSize: 10 }} />
                            <YAxis yAxisId="right" orientation="right" stroke="#f97316" tick={{ fill: '#f97316', fontSize: 10 }} domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
                            <Tooltip cursor={{ fill: 'rgba(249,115,22,.1)' }} contentStyle={{ backgroundColor: 'rgba(12,12,22,.95)', border: '1px solid rgba(249,115,22,.4)', color: '#fff' }} itemStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                            <Legend wrapperStyle={{ fontSize: "11px", color: "rgba(226,232,240,.5)" }} />
                            <Bar yAxisId="left" dataKey="demand" name={`30-Day Demand (${new Date().toLocaleString('default', { month: 'short' })})`} fill="#3b82f6" />
                            <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" stroke="#f97316" strokeWidth={3} dot={false} name="Cumulative %" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(249,115,22,.2)', borderRadius: '3px', padding: '16px', marginBottom: '32px', animation: 'fadeInUp .6s ease both' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontFamily: "'Outfit', monospace", fontSize: '12px', color: '#e2e8f0', letterSpacing: '1px' }}>FORECAST DATA.TABLE</h2>
                    <input 
                        type="text" 
                        placeholder="Search SKU or Category..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            background: 'rgba(0,0,0,0.5)',
                            border: '1px solid rgba(249,115,22,.4)',
                            color: '#fff',
                            padding: '8px 12px',
                            borderRadius: '3px',
                            fontFamily: "'Outfit', monospace",
                            fontSize: '11px',
                            width: '250px',
                            outline: 'none',
                        }}
                    />
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="min-w-full" style={{ borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'rgba(5,5,10,.5)', borderBottom: '1px solid rgba(249,115,22,.15)' }}>
                            <tr>
                                <th onClick={() => handleSort('sku')} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer" style={{ color: 'rgba(226,232,240,.4)', fontFamily: "'Outfit', monospace", cursor: 'pointer' }}>SKU<span style={{ color: 'rgba(249,115,22,.8)' }}>{getSortIcon('sku')}</span></th>
                                <th onClick={() => handleSort('category')} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer" style={{ color: 'rgba(226,232,240,.4)', fontFamily: "'Outfit', monospace", cursor: 'pointer' }}>Category<span style={{ color: 'rgba(249,115,22,.8)' }}>{getSortIcon('category')}</span></th>
                                <th onClick={() => handleSort('forecast_7d')} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer" style={{ color: 'rgba(226,232,240,.4)', fontFamily: "'Outfit', monospace", cursor: 'pointer' }}>7-Day ({new Date().toLocaleString('default', { month: 'short' })})<span style={{ color: 'rgba(249,115,22,.8)' }}>{getSortIcon('forecast_7d')}</span></th>
                                <th onClick={() => handleSort('forecast_30d')} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer" style={{ color: 'rgba(226,232,240,.4)', fontFamily: "'Outfit', monospace", cursor: 'pointer' }}>30-Day ({new Date().toLocaleString('default', { month: 'short' })})<span style={{ color: 'rgba(249,115,22,.8)' }}>{getSortIcon('forecast_30d')}</span></th>
                                <th onClick={() => handleSort('is_cold')} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer" style={{ color: 'rgba(226,232,240,.4)', fontFamily: "'Outfit', monospace", cursor: 'pointer' }}>ML Status<span style={{ color: 'rgba(249,115,22,.8)' }}>{getSortIcon('is_cold')}</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedData.length > 0 ? processedData.map((f, i) => (
                                <tr key={i} style={{ transition: 'background .2s', borderBottom: '1px solid rgba(249,115,22,.1)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(249,115,22,.05)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                    <td className="px-6 py-4 font-mono text-sm" style={{ color: 'rgba(226,232,240,.6)' }}>{f.sku}</td>
                                    <td className="px-6 py-4 text-sm" style={{ color: '#e2e8f0' }}>{f.category}</td>
                                    <td className="px-6 py-4 font-bold text-sm" style={{ color: '#818cf8', textShadow: '0 0 8px rgba(129,140,248,.3)' }}>{f.forecast_7d}</td>
                                    <td className="px-6 py-4 font-bold text-sm" style={{ color: '#f97316', textShadow: '0 0 8px rgba(249,115,22,.3)' }}>{f.forecast_30d}</td>
                                    <td className="px-6 py-4">
                                        <span style={{
                                            fontSize: '9px', padding: '3px 8px', borderRadius: '2px', letterSpacing: '1px',
                                            ...(f.is_cold
                                                ? { border: '1px solid rgba(59,130,246,.4)', color: '#3b82f6', background: 'rgba(59,130,246,.1)' }
                                                : { border: '1px solid rgba(34,197,94,.4)', color: '#22c55e', background: 'rgba(34,197,94,.1)' })
                                        }}>
                                            {f.is_cold ? 'COLD-START' : 'GRADUATED'}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-sm" style={{ color: 'rgba(226,232,240,.5)', fontFamily: "'Outfit', monospace" }}>
                                        NO MATCHING DATA FOUND
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
