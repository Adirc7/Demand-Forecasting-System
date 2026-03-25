import { useState, useEffect, useCallback } from 'react';
import { getReports, generateReport, getAccuracy, getBusinessMetrics, getHistoricalMetrics, downloadCSVFile } from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import html2canvas from 'html2canvas';

export default function Reports() {
    const [reports, setReports] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [businessData, setBusinessData] = useState(null);
    const [historical, setHistorical] = useState(null);
    const [generating, setGenerating] = useState(false);

    const load = useCallback(async () => {
        const [reps, acc, biz, hist] = await Promise.all([getReports(), getAccuracy(), getBusinessMetrics(), getHistoricalMetrics()]);
        setReports(reps);
        setMetrics(acc);
        setBusinessData(biz);
        setHistorical(hist);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleGen = async () => {
        setGenerating(true);
        await generateReport({ date_range: 'Last 7 Days' });
        await load();
        setGenerating(false);
    };

    const handleDownloadPDF = async () => {
        setGenerating(true);
        const doc = new jsPDF('p', 'mm', 'a4');

        // Add Title
        doc.setFontSize(18);
        doc.setTextColor(249, 115, 22); // Orange theme color
        doc.text('DROPEX.AI - System Report Snapshot', 14, 22);

        // Add Subtitle/Date
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

        // Define columns and map data
        const tableColumn = ["Generated At", "Total SKUs", "Low Stock SKUs", "Cold Start SKUs"];
        const tableRows = [];

        reports.forEach(r => {
            const rowData = [
                new Date(r.created_at).toLocaleString(),
                r.total_skus.toString(),
                r.low_stock_count.toString(),
                r.cold_start_count.toString()
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'grid',
            styles: { fontSize: 10, halign: 'center' },
            headStyles: { fillColor: [5, 5, 10], textColor: [249, 115, 22] },
            alternateRowStyles: { fillColor: [240, 240, 240] }
        });

        if (businessData) {
            let finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 15 : 60;
            doc.setFontSize(14);
            doc.setTextColor(59, 130, 246);
            doc.text('Financial & Business Overview', 14, finalY);

            finalY += 10;
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.text(`Total Revenue (Period): $${businessData.total_revenue}`, 14, finalY);
            doc.text(`Total Inventory Value: $${businessData.total_inventory_value}`, 14, finalY + 8);
            doc.text(`Estimated Restock Cost (7D): $${businessData.est_restock_cost}`, 14, finalY + 16);

            finalY += 30;
            doc.setFontSize(12);
            doc.setTextColor(59, 130, 246);
            doc.text('Top 5 Fast Movers', 14, finalY);

            const fmCol = ["SKU", "Name", "Qty Sold", "Revenue"];
            const fmRows = businessData.fast_movers ? businessData.fast_movers.map(m => [m.sku, m.name, m.qty_sold.toString(), `$${m.revenue}`]) : [];

            autoTable(doc, {
                head: [fmCol],
                body: fmRows,
                startY: finalY + 5,
                theme: 'grid',
                styles: { fontSize: 9 },
                headStyles: { fillColor: [5, 5, 10], textColor: [59, 130, 246] }
            });
        }

        // Capture Charts using html2canvas
        const chartsElement = document.getElementById('historical-charts-container');
        if (chartsElement) {
            let finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 15 : 60;
            
            // If table reached near bottom, add new page
            if (finalY > 250) {
                doc.addPage();
                finalY = 20;
            }

            try {
                const canvas = await html2canvas(chartsElement, { backgroundColor: '#0a050f', scale: 2 });
                const imgData = canvas.toDataURL('image/png');
                
                // Calculate dimensions to fit A4 width
                const pdfWidth = doc.internal.pageSize.getWidth() - 28; // 14mm margins
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                
                doc.text('Historical Analytics (Aug 2025 - Feb 2026)', 14, finalY);
                doc.addImage(imgData, 'PNG', 14, finalY + 5, pdfWidth, pdfHeight);
            } catch (e) {
                console.error("Failed to capture charts for PDF:", e);
            }
        }

        // Save PDF
        doc.save(`dropex_reports_${new Date().toISOString().split('T')[0]}.pdf`);
        setGenerating(false);
    };

    const handleDownloadCSV = async () => {
        try {
            setGenerating(true);
            await downloadCSVFile();
        } catch (e) {
            console.error(e);
            alert("Export failed: " + e.message);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div style={{ position: 'relative', zIndex: 10, padding: '32px' }}>
            <div className="flex justify-between items-center mb-6" style={{ animation: 'slideInLeft .6s ease' }}>
                <div>
                    <div className="page-subtitle">// SYSTEM MODULE: M5</div>
                    <h1 className="page-title" style={{ fontFamily: "'Orbitron', monospace", fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '4px', textShadow: '0 0 30px rgba(249,115,22,.3)' }}>REPORTS <span>& ANALYTICS</span></h1>
                    <div className="title-bar" style={{ marginTop: '6px', height: '2px', width: '200px', background: 'linear-gradient(90deg, #f97316, transparent)', boxShadow: '0 0 10px rgba(249,115,22,.4)' }} />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <button onClick={handleDownloadCSV} disabled={generating}
                        className="refresh-btn" style={{ position: 'relative', background: 'transparent', border: '1px solid rgba(168,85,247,.4)', padding: '10px 20px', color: '#a855f7', fontSize: '10px', letterSpacing: '2px', fontFamily: "'Orbitron', monospace", fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', borderRadius: '2px', transition: 'all .3s', opacity: generating ? 0.5 : 1 }}
                        onMouseEnter={(e) => { if (!generating) { e.currentTarget.style.background = 'rgba(168,85,247,.1)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(168,85,247,.3)' } }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none' }}>
                        GENERATE DATASET (CSV)
                    </button>
                    <button onClick={handleDownloadPDF} disabled={reports.length === 0}
                        className="refresh-btn" style={{ position: 'relative', background: 'transparent', border: '1px solid rgba(249,115,22,.4)', padding: '10px 20px', color: '#f97316', fontSize: '10px', letterSpacing: '2px', fontFamily: "'Orbitron', monospace", fontWeight: 700, cursor: reports.length === 0 ? 'not-allowed' : 'pointer', borderRadius: '2px', transition: 'all .3s', opacity: reports.length === 0 ? 0.5 : 1 }}
                        onMouseEnter={(e) => { if (reports.length > 0) { e.currentTarget.style.background = 'rgba(249,115,22,.1)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(249,115,22,.3)' } }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none' }}>
                        DOWNLOAD PDF ↓
                    </button>
                    <button onClick={handleGen} disabled={generating}
                        className="refresh-btn" style={{ position: 'relative', background: 'transparent', border: '1px solid rgba(59,130,246,.4)', padding: '10px 20px', color: '#3b82f6', fontSize: '10px', letterSpacing: '2px', fontFamily: "'Orbitron', monospace", fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'all .3s' }}
                        onMouseEnter={(e) => { if (!generating) { e.currentTarget.style.background = 'rgba(59,130,246,.1)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(59,130,246,.3)' } }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none' }}>
                        {generating ? 'CAPTURING...' : 'CAPTURE SNAPSHOT'}
                    </button>
                </div>
            </div>

            {metrics && (
                <div className="grid grid-cols-2 gap-4 mt-6" style={{ animation: 'fadeInUp .5s ease both' }}>
                    <div style={{ background: 'linear-gradient(135deg, rgba(8,12,28,.97), rgba(8,8,22,.97))', border: '1px solid rgba(59,130,246,.3)', borderRadius: '3px', padding: '24px', transition: 'all 0.3s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(59,130,246,.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}>
                        <div style={{ fontSize: '10px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>MODEL ACCURACY (MAE)</div>
                        <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '32px', fontWeight: 900, color: '#3b82f6', textShadow: '0 0 16px rgba(59,130,246,.4)' }}>{metrics.MAE ?? 'N/A'}</div>
                        <div style={{ fontSize: '9px', color: 'rgba(226,232,240,.3)', letterSpacing: '1px', marginTop: '8px' }}>// MEAN ABSOLUTE ERROR</div>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, rgba(8,12,28,.97), rgba(8,8,22,.97))', border: '1px solid rgba(59,130,246,.3)', borderRadius: '3px', padding: '24px', transition: 'all 0.3s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(234,179,8,.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}>
                        <div style={{ fontSize: '10px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>MODEL ACCURACY (RMSE)</div>
                        <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '32px', fontWeight: 900, color: '#eab308', textShadow: '0 0 16px rgba(234,179,8,.4)' }}>{metrics.RMSE ?? 'N/A'}</div>
                        <div style={{ fontSize: '9px', color: 'rgba(226,232,240,.3)', letterSpacing: '1px', marginTop: '8px' }}>// ROOT MEAN SQUARE ERROR</div>
                    </div>
                </div>
            )}

            {businessData && (
                <>
                    <div className="grid grid-cols-3 gap-4 mt-4" style={{ animation: 'fadeInUp .5s ease .1s both' }}>
                        <div style={{ background: 'linear-gradient(135deg, rgba(16,18,27,.97), rgba(10,10,16,.97))', border: '1px solid rgba(34,197,94,.3)', borderRadius: '3px', padding: '24px', transition: 'all 0.3s ease' }}
                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(34,197,94,.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}>
                            <div style={{ fontSize: '10px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Period Revenue</div>
                            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '28px', fontWeight: 900, color: '#22c55e', textShadow: '0 0 16px rgba(34,197,94,.4)' }}>${businessData.total_revenue}</div>
                        </div>
                        <div style={{ background: 'linear-gradient(135deg, rgba(16,18,27,.97), rgba(10,10,16,.97))', border: '1px solid rgba(168,85,247,.3)', borderRadius: '3px', padding: '24px', transition: 'all 0.3s ease' }}
                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(168,85,247,.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}>
                            <div style={{ fontSize: '10px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Total Inventory Value</div>
                            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '28px', fontWeight: 900, color: '#a855f7', textShadow: '0 0 16px rgba(168,85,247,.4)' }}>${businessData.total_inventory_value}</div>
                        </div>
                        <div style={{ background: 'linear-gradient(135deg, rgba(16,18,27,.97), rgba(10,10,16,.97))', border: '1px solid rgba(239,68,68,.3)', borderRadius: '3px', padding: '24px', transition: 'all 0.3s ease' }}
                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(239,68,68,.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}>
                            <div style={{ fontSize: '10px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Est. Restock Cost</div>
                            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '28px', fontWeight: 900, color: '#ef4444', textShadow: '0 0 16px rgba(239,68,68,.4)' }}>${businessData.est_restock_cost}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4" style={{ animation: 'fadeInUp .5s ease .2s both' }}>
                        <div style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(59,130,246,.2)', borderRadius: '3px', padding: '16px' }}>
                            <h3 style={{ fontFamily: "'Orbitron', monospace", fontSize: '12px', color: '#3b82f6', letterSpacing: '2px', marginBottom: '16px' }}>TOP 5 FAST MOVERS ⚡</h3>
                            {businessData.fast_movers?.length > 0 ? businessData.fast_movers.map(m => (
                                <div key={m.sku} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid rgba(59,130,246,.1)', fontSize: '11px', color: '#e2e8f0' }}>
                                    <span><strong style={{ color: '#94a3b8' }}>{m.sku}</strong> {m.name}</span>
                                    <span style={{ color: '#22c55e' }}>{m.qty_sold} sold / ${m.revenue}</span>
                                </div>
                            )) : <div style={{ fontSize: '11px', color: 'rgba(226,232,240,.4)' }}>No sales data.</div>}
                        </div>

                        <div style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(249,115,22,.2)', borderRadius: '3px', padding: '16px' }}>
                            <h3 style={{ fontFamily: "'Orbitron', monospace", fontSize: '12px', color: '#f97316', letterSpacing: '2px', marginBottom: '16px' }}>SLOW / DEAD STOCK 🧊</h3>
                            {businessData.dead_stock?.length > 0 ? businessData.dead_stock.map(m => (
                                <div key={m.sku} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid rgba(249,115,22,.1)', fontSize: '11px', color: '#e2e8f0' }}>
                                    <span><strong style={{ color: '#94a3b8' }}>{m.sku}</strong> {m.name}</span>
                                    <span style={{ color: '#ef4444' }}>{m.stock} in stock / Tied up: ${m.tied_up_value}</span>
                                </div>
                            )) : <div style={{ fontSize: '11px', color: 'rgba(226,232,240,.4)' }}>No dead stock.</div>}
                        </div>
                    </div>
                </>
            )}

            {historical && (
                <div id="historical-charts-container" style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeInUp .6s ease .3s both' }}>
                    
                    {/* Area Chart: Period Revenue */}
                    <div style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(34,197,94,.2)', borderRadius: '3px', padding: '24px' }}>
                        <h3 style={{ fontFamily: "'Orbitron', monospace", fontSize: '14px', color: '#22c55e', letterSpacing: '2px', marginBottom: '8px' }}>PERIOD REVENUE TREND (6-MONTH) 📈</h3>
                        <p style={{ fontSize: '10px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px', marginBottom: '24px' }}>// MONTH-OVER-MONTH FINANCIAL GROWTH TRAJECTORY</p>
                        <div style={{ height: '300px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={historical.revenue_chart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" stroke="rgba(226,232,240,.3)" fontSize={10} tickMargin={10} />
                                    <YAxis stroke="rgba(226,232,240,.3)" fontSize={10} tickFormatter={(val) => `$${val/1000}k`} />
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(12,12,22,.9)', border: '1px solid rgba(34,197,94,.4)', borderRadius: '2px', fontFamily: "'Share Tech Mono', monospace" }} itemStyle={{ color: '#22c55e' }} formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']} />
                                    <Area type="monotone" dataKey="revenue" stroke="#22c55e" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Bar Chart: Total Inventory Value */}
                    <div style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(168,85,247,.2)', borderRadius: '3px', padding: '24px' }}>
                        <h3 style={{ fontFamily: "'Orbitron', monospace", fontSize: '14px', color: '#a855f7', letterSpacing: '2px', marginBottom: '8px' }}>INVENTORY CAPITAL VALUATION 💰</h3>
                        <p style={{ fontSize: '10px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px', marginBottom: '24px' }}>// WAREHOUSE STOCK VALUE HELD MONTH-OVER-MONTH</p>
                        <div style={{ height: '300px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={historical.inventory_chart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="name" stroke="rgba(226,232,240,.3)" fontSize={10} tickMargin={10} />
                                    <YAxis stroke="rgba(226,232,240,.3)" fontSize={10} tickFormatter={(val) => `$${val/1000}k`} />
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(12,12,22,.9)', border: '1px solid rgba(168,85,247,.4)', borderRadius: '2px', fontFamily: "'Share Tech Mono', monospace" }} itemStyle={{ color: '#a855f7' }} cursor={{fill: 'rgba(168,85,247,.1)'}} formatter={(value) => [`$${value.toLocaleString()}`, 'Inventory Value']} />
                                    <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Line Chart: SKU Pipelines */}
                    <div style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(59,130,246,.2)', borderRadius: '3px', padding: '24px' }}>
                        <h3 style={{ fontFamily: "'Orbitron', monospace", fontSize: '14px', color: '#3b82f6', letterSpacing: '2px', marginBottom: '8px' }}>FAST-MOVER PIPELINE VOLUMES ⚡</h3>
                        <p style={{ fontSize: '10px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px', marginBottom: '24px' }}>// TOP 5 SKUS: HISTORICAL STOCK TRAJECTORIES</p>
                        <div style={{ height: '300px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={historical.sku_chart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="name" stroke="rgba(226,232,240,.3)" fontSize={10} tickMargin={10} />
                                    <YAxis stroke="rgba(226,232,240,.3)" fontSize={10} />
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(12,12,22,.9)', border: '1px solid rgba(59,130,246,.4)', borderRadius: '2px', fontFamily: "'Share Tech Mono', monospace" }} />
                                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: "'Share Tech Mono', monospace" }} />
                                    
                                    {historical.top_skus.map((sku, index) => {
                                        const colors = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ec4899'];
                                        return <Line key={sku} type="monotone" dataKey={sku} stroke={colors[index % 5]} strokeWidth={2} dot={{ r: 4, fill: '#0a050f', strokeWidth: 2 }} activeDot={{ r: 6 }} />;
                                    })}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            )}

            <div style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(249,115,22,.2)', borderRadius: '3px', marginTop: '32px', overflow: 'hidden', animation: 'fadeInUp .6s ease .1s both' }}>
                <table className="min-w-full" style={{ borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'rgba(5,5,10,.5)', borderBottom: '1px solid rgba(249,115,22,.15)' }}>
                        <tr>
                            <th className="px-6 py-3 text-left font-medium uppercase tracking-wider" style={{ color: 'rgba(226,232,240,.4)', fontFamily: "'Orbitron', monospace", fontSize: '10px', letterSpacing: '1px', borderBottom: 'none' }}>Generated At</th>
                            <th className="px-6 py-3 text-left font-medium uppercase tracking-wider" style={{ color: 'rgba(226,232,240,.4)', fontFamily: "'Orbitron', monospace", fontSize: '10px', letterSpacing: '1px', borderBottom: 'none' }}>Total SKUs</th>
                            <th className="px-6 py-3 text-left font-medium uppercase tracking-wider" style={{ color: '#ef4444', fontFamily: "'Orbitron', monospace", fontSize: '10px', letterSpacing: '1px', borderLeft: '1px solid rgba(239,68,68,.2)', borderBottom: 'none', borderTop: 'none', borderRight: 'none', background: 'rgba(239,68,68,.05)' }}>Low Stock SKUs</th>
                            <th className="px-6 py-3 text-left font-medium uppercase tracking-wider" style={{ color: '#3b82f6', fontFamily: "'Orbitron', monospace", fontSize: '10px', letterSpacing: '1px', borderLeft: '1px solid rgba(59,130,246,.2)', borderBottom: 'none', borderTop: 'none', borderRight: 'none', background: 'rgba(59,130,246,.05)' }}>Cold Start SKUs</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.map((r, i) => (
                            <tr key={i} style={{ transition: 'background .2s', borderBottom: '1px solid rgba(249,115,22,.1)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(249,115,22,.05)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'rgba(226,232,240,.6)', borderBottom: 'none' }}>{new Date(r.created_at).toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: '#e2e8f0', borderBottom: 'none' }}>{r.total_skus}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold" style={{ color: '#ef4444', borderLeft: '1px solid rgba(239,68,68,.1)', borderBottom: 'none', borderTop: 'none', borderRight: 'none' }}>{r.low_stock_count}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold" style={{ color: '#3b82f6', borderLeft: '1px solid rgba(59,130,246,.1)', borderBottom: 'none', borderTop: 'none', borderRight: 'none' }}>{r.cold_start_count}</td>
                            </tr>
                        ))}
                        {reports.length === 0 && <tr><td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'rgba(226,232,240,.4)' }}>No snapshots taken yet.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
