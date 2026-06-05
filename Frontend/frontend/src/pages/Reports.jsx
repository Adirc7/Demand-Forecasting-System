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

    // Filter state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [dateError, setDateError] = useState('');

    const [showCsvModal, setShowCsvModal] = useState(false);
    const [csvStartDate, setCsvStartDate] = useState('');
    const [csvEndDate, setCsvEndDate] = useState('');
    const [csvDateErrors, setCsvDateErrors] = useState({});

    useEffect(() => {
        const now = new Date();
        now.setHours(23, 59, 59, 999);
        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            setDateError('Start date cannot be after end date.');
        } else if ((startDate && new Date(startDate) > now) || (endDate && new Date(endDate) > now)) {
            setDateError('Dates cannot be in the future.');
        } else {
            setDateError('');
        }
    }, [startDate, endDate]);

    const validateCsvDates = () => {
        const errors = {};
        const now = new Date();
        now.setHours(23, 59, 59, 999);

        if (!csvStartDate) {
            errors.csvStartDate = "Start date is required.";
        } else if (new Date(csvStartDate) > now) {
            errors.csvStartDate = "Start date cannot be in the future.";
        }

        if (!csvEndDate) {
            errors.csvEndDate = "End date is required.";
        } else if (new Date(csvEndDate) > now) {
            errors.csvEndDate = "End date cannot be in the future.";
        }

        if (csvStartDate && csvEndDate && new Date(csvStartDate) > new Date(csvEndDate)) {
            errors.csvEndDate = "End date must be after start date.";
        }

        setCsvDateErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const filteredReports = reports.filter(r => {
        if (!startDate && !endDate) return true;
        
        const reportDate = new Date(r.created_at);
        const sDate = startDate ? new Date(startDate) : null;
        let eDate = endDate ? new Date(endDate) : null;
        
        if (eDate) eDate.setHours(23, 59, 59, 999);

        // Do not filter if there's a validation error
        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            return true;
        }

        if (sDate && eDate) return reportDate >= sDate && reportDate <= eDate;
        if (sDate) return reportDate >= sDate;
        if (eDate) return reportDate <= eDate;
        return true;
    });

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

        filteredReports.forEach(r => {
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
            doc.text(`Total Revenue (Period): Rs. ${businessData.total_revenue.toLocaleString()}`, 14, finalY);
            doc.text(`Total Inventory Value: Rs. ${businessData.total_inventory_value.toLocaleString()}`, 14, finalY + 8);
            doc.text(`Estimated Restock Cost (7D): Rs. ${businessData.est_restock_cost.toLocaleString()}`, 14, finalY + 16);

            finalY += 30;
            doc.setFontSize(12);
            doc.setTextColor(59, 130, 246);
            doc.text('Top 5 Fast Movers', 14, finalY);

            const fmCol = ["SKU", "Name", "Qty Sold", "Revenue"];
            const fmRows = businessData.fast_movers ? businessData.fast_movers.map(m => [m.sku, m.name, m.qty_sold.toString(), `Rs. ${m.revenue}`]) : [];

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
        if (!validateCsvDates()) return;
        try {
            setGenerating(true);
            await downloadCSVFile(csvStartDate, csvEndDate);
            setShowCsvModal(false);
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

                    <h1 className="page-title" style={{ fontFamily: "'Outfit', monospace", fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '4px', textShadow: '0 0 30px rgba(249,115,22,.3)' }}>REPORTS <span>& ANALYTICS</span></h1>
                    <div className="title-bar" style={{ marginTop: '6px', height: '2px', width: '200px', background: 'linear-gradient(90deg, #f97316, transparent)', boxShadow: '0 0 10px rgba(249,115,22,.4)' }} />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <button onClick={() => setShowCsvModal(true)} disabled={generating}
                        className="refresh-btn" style={{ position: 'relative', background: 'transparent', border: '1px solid rgba(168,85,247,.4)', padding: '10px 20px', color: '#a855f7', fontSize: '10px', letterSpacing: '2px', fontFamily: "'Outfit', monospace", fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', borderRadius: '2px', transition: 'all .3s', opacity: generating ? 0.5 : 1 }}
                        onMouseEnter={(e) => { if (!generating) { e.currentTarget.style.background = 'rgba(168,85,247,.1)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(168,85,247,.3)' } }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none' }}>
                        GENERATE DATASET (CSV)
                    </button>
                    <button onClick={handleDownloadPDF} disabled={filteredReports.length === 0}
                        className="refresh-btn" style={{ position: 'relative', background: 'transparent', border: '1px solid rgba(249,115,22,.4)', padding: '10px 20px', color: '#f97316', fontSize: '10px', letterSpacing: '2px', fontFamily: "'Outfit', monospace", fontWeight: 700, cursor: filteredReports.length === 0 ? 'not-allowed' : 'pointer', borderRadius: '2px', transition: 'all .3s', opacity: filteredReports.length === 0 ? 0.5 : 1 }}
                        onMouseEnter={(e) => { if (filteredReports.length > 0) { e.currentTarget.style.background = 'rgba(249,115,22,.1)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(249,115,22,.3)' } }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none' }}>
                        DOWNLOAD PDF ↓
                    </button>
                    <button onClick={handleGen} disabled={generating}
                        className="refresh-btn" style={{ position: 'relative', background: 'transparent', border: '1px solid rgba(59,130,246,.4)', padding: '10px 20px', color: '#3b82f6', fontSize: '10px', letterSpacing: '2px', fontFamily: "'Outfit', monospace", fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'all .3s' }}
                        onMouseEnter={(e) => { if (!generating) { e.currentTarget.style.background = 'rgba(59,130,246,.1)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(59,130,246,.3)' } }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none' }}>
                        {generating ? 'CAPTURING...' : 'CAPTURE SNAPSHOT'}
                    </button>
                </div>
            </div>

            {metrics && (
                <div className="grid grid-cols-3 gap-4 mt-6" style={{ animation: 'fadeInUp .5s ease both' }}>
                    <div style={{ background: 'linear-gradient(135deg, rgba(8,12,28,.97), rgba(8,8,22,.97))', border: '1px solid rgba(59,130,246,.3)', borderRadius: '3px', padding: '24px', transition: 'all 0.3s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(59,130,246,.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}>
                        <div style={{ fontSize: '10px', color: '#ffffff', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>MODEL ACCURACY (MAE)</div>
                        <div style={{ fontFamily: "'Outfit', monospace", fontSize: '32px', fontWeight: 900, color: '#3b82f6', textShadow: '0 0 16px rgba(59,130,246,.4)' }}>{metrics.MAE ?? 'N/A'}</div>
                        <div style={{ fontSize: '9px', color: 'rgba(226,232,240,.3)', letterSpacing: '1px', marginTop: '8px' }}>// MEAN ABSOLUTE ERROR</div>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, rgba(8,12,28,.97), rgba(8,8,22,.97))', border: '1px solid rgba(59,130,246,.3)', borderRadius: '3px', padding: '24px', transition: 'all 0.3s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(234,179,8,.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}>
                        <div style={{ fontSize: '10px', color: '#ffffff', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>MODEL ACCURACY (RMSE)</div>
                        <div style={{ fontFamily: "'Outfit', monospace", fontSize: '32px', fontWeight: 900, color: '#eab308', textShadow: '0 0 16px rgba(234,179,8,.4)' }}>{metrics.RMSE ?? 'N/A'}</div>
                        <div style={{ fontSize: '9px', color: 'rgba(226,232,240,.3)', letterSpacing: '1px', marginTop: '8px' }}>// ROOT MEAN SQUARE ERROR</div>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, rgba(8,12,28,.97), rgba(8,8,22,.97))', border: '1px solid rgba(168,85,247,.3)', borderRadius: '3px', padding: '24px', transition: 'all 0.3s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(168,85,247,.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}>
                        <div style={{ fontSize: '10px', color: '#ffffff', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>MODEL ACCURACY (%)</div>
                        <div style={{ fontFamily: "'Outfit', monospace", fontSize: '32px', fontWeight: 900, color: '#a855f7', textShadow: '0 0 16px rgba(168,85,247,.4)' }}>{metrics.Accuracy != null ? `${metrics.Accuracy}%` : 'N/A'}</div>
                        <div style={{ fontSize: '9px', color: 'rgba(226,232,240,.3)', letterSpacing: '1px', marginTop: '8px' }}>// FORECAST PRECISION</div>
                    </div>
                </div>
            )}

            {businessData && (
                <>
                    <div className="grid grid-cols-3 gap-4 mt-4" style={{ animation: 'fadeInUp .5s ease .1s both' }}>
                        <div style={{ background: 'linear-gradient(135deg, rgba(16,18,27,.97), rgba(10,10,16,.97))', border: '1px solid rgba(34,197,94,.3)', borderRadius: '3px', padding: '24px', transition: 'all 0.3s ease' }}
                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(34,197,94,.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}>
                            <div style={{ fontSize: '10px', color: '#ffffff', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Period Revenue</div>
                            <div style={{ fontFamily: "'Outfit', monospace", fontSize: '28px', fontWeight: 900, color: '#22c55e', textShadow: '0 0 16px rgba(34,197,94,.4)' }}>Rs. {businessData.total_revenue.toLocaleString()}</div>
                        </div>
                        <div style={{ background: 'linear-gradient(135deg, rgba(16,18,27,.97), rgba(10,10,16,.97))', border: '1px solid rgba(168,85,247,.3)', borderRadius: '3px', padding: '24px', transition: 'all 0.3s ease' }}
                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(168,85,247,.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}>
                            <div style={{ fontSize: '10px', color: '#ffffff', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Total Inventory Value</div>
                            <div style={{ fontFamily: "'Outfit', monospace", fontSize: '28px', fontWeight: 900, color: '#a855f7', textShadow: '0 0 16px rgba(168,85,247,.4)' }}>Rs. {businessData.total_inventory_value.toLocaleString()}</div>
                        </div>
                        <div style={{ background: 'linear-gradient(135deg, rgba(16,18,27,.97), rgba(10,10,16,.97))', border: '1px solid rgba(239,68,68,.3)', borderRadius: '3px', padding: '24px', transition: 'all 0.3s ease' }}
                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(239,68,68,.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}>
                            <div style={{ fontSize: '10px', color: '#ffffff', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Est. Restock Cost</div>
                            <div style={{ fontFamily: "'Outfit', monospace", fontSize: '28px', fontWeight: 900, color: '#ef4444', textShadow: '0 0 16px rgba(239,68,68,.4)' }}>Rs. {businessData.est_restock_cost.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4" style={{ animation: 'fadeInUp .5s ease .2s both' }}>
                        <div style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(59,130,246,.2)', borderRadius: '3px', padding: '16px' }}>
                            <h3 style={{ fontFamily: "'Outfit', monospace", fontSize: '12px', color: '#3b82f6', letterSpacing: '2px', marginBottom: '16px' }}>TOP 5 FAST MOVERS ⚡</h3>
                            {businessData.fast_movers?.length > 0 ? businessData.fast_movers.map(m => (
                                <div key={m.sku} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid rgba(59,130,246,.1)', fontSize: '11px', color: '#e2e8f0' }}>
                                    <span><strong style={{ color: '#94a3b8' }}>{m.sku}</strong> {m.name}</span>
                                    <span style={{ color: '#22c55e' }}>{m.qty_sold} sold / Rs. {m.revenue}</span>
                                </div>
                            )) : <div style={{ fontSize: '11px', color: 'rgba(226,232,240,.4)' }}>No sales data.</div>}
                        </div>

                        <div style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(249,115,22,.2)', borderRadius: '3px', padding: '16px' }}>
                            <h3 style={{ fontFamily: "'Outfit', monospace", fontSize: '12px', color: '#f97316', letterSpacing: '2px', marginBottom: '16px' }}>SLOW / DEAD STOCK 🧊</h3>
                            {businessData.dead_stock?.length > 0 ? businessData.dead_stock.map(m => (
                                <div key={m.sku} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid rgba(249,115,22,.1)', fontSize: '11px', color: '#e2e8f0' }}>
                                    <span><strong style={{ color: '#94a3b8' }}>{m.sku}</strong> {m.name}</span>
                                    <span style={{ color: '#ef4444' }}>{m.stock} in stock / Tied up: Rs. {m.tied_up_value}</span>
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
                        <h3 style={{ fontFamily: "'Outfit', monospace", fontSize: '14px', color: '#22c55e', letterSpacing: '2px', marginBottom: '8px' }}>PERIOD REVENUE TREND (6-MONTH) 📈</h3>
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
                                    <YAxis stroke="rgba(226,232,240,.3)" fontSize={10} tickFormatter={(val) => `Rs. ${val/1000}k`} />
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(12,12,22,.9)', border: '1px solid rgba(34,197,94,.4)', borderRadius: '2px', fontFamily: "'Inter', sans-serif" }} itemStyle={{ color: '#22c55e' }} formatter={(value) => [`Rs. ${value.toLocaleString()}`, 'Revenue']} />
                                    <Area type="monotone" dataKey="revenue" stroke="#22c55e" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Bar Chart: Total Inventory Value */}
                    <div style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(99,102,241,.2)', borderRadius: '3px', padding: '24px' }}>
                        <h3 style={{ fontFamily: "'Outfit', monospace", fontSize: '14px', color: '#6366f1', letterSpacing: '2px', marginBottom: '8px' }}>INVENTORY CAPITAL VALUATION 💰</h3>
                        <p style={{ fontSize: '10px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px', marginBottom: '24px' }}>// WAREHOUSE STOCK VALUE HELD MONTH-OVER-MONTH</p>
                        <div style={{ height: '300px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={historical.inventory_chart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="name" stroke="rgba(226,232,240,.3)" fontSize={10} tickMargin={10} />
                                    <YAxis stroke="rgba(226,232,240,.3)" fontSize={10} tickFormatter={(val) => `Rs. ${val/1000}k`} />
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(12,12,22,.9)', border: '1px solid rgba(99,102,241,.4)', borderRadius: '2px', fontFamily: "'Inter', sans-serif" }} itemStyle={{ color: '#6366f1' }} cursor={{fill: 'rgba(99,102,241,.1)'}} formatter={(value) => [`Rs. ${value.toLocaleString()}`, 'Inventory Value']} />
                                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Line Chart: SKU Pipelines */}
                    <div style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(59,130,246,.2)', borderRadius: '3px', padding: '24px' }}>
                        <h3 style={{ fontFamily: "'Outfit', monospace", fontSize: '14px', color: '#3b82f6', letterSpacing: '2px', marginBottom: '8px' }}>FAST-MOVER PIPELINE VOLUMES ⚡</h3>
                        <p style={{ fontSize: '10px', color: 'rgba(226,232,240,.4)', letterSpacing: '1px', marginBottom: '24px' }}>// TOP 5 SKUS: HISTORICAL STOCK TRAJECTORIES</p>
                        <div style={{ height: '300px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={historical.sku_chart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="name" stroke="rgba(226,232,240,.3)" fontSize={10} tickMargin={10} />
                                    <YAxis stroke="rgba(226,232,240,.3)" fontSize={10} />
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(12,12,22,.9)', border: '1px solid rgba(59,130,246,.4)', borderRadius: '2px', fontFamily: "'Inter', sans-serif" }} />
                                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: "'Inter', sans-serif" }} />
                                    
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

            <div style={{ marginTop: '32px', animation: 'fadeInUp .6s ease .1s both' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', marginBottom: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', color: dateError ? '#ef4444' : 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', transition: 'color .2s' }}>Start Date</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                               style={{ background: 'rgba(0,0,0,.3)', border: `1px solid ${dateError ? '#ef4444' : 'rgba(249,115,22,.3)'}`, padding: '8px 12px', color: '#fff', borderRadius: '2px', outline: 'none', colorScheme: 'dark', fontFamily: "'Inter', sans-serif", fontSize: '12px', transition: 'border-color .2s', boxShadow: dateError ? '0 0 8px rgba(239,68,68,.4)' : 'none' }}
                               onFocus={(e) => {if(!dateError) e.target.style.borderColor = '#f97316'}} onBlur={(e) => {if(!dateError) e.target.style.borderColor = 'rgba(249,115,22,.3)'}} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', color: dateError ? '#ef4444' : 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', transition: 'color .2s' }}>End Date</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                               style={{ background: 'rgba(0,0,0,.3)', border: `1px solid ${dateError ? '#ef4444' : 'rgba(249,115,22,.3)'}`, padding: '8px 12px', color: '#fff', borderRadius: '2px', outline: 'none', colorScheme: 'dark', fontFamily: "'Inter', sans-serif", fontSize: '12px', transition: 'border-color .2s', boxShadow: dateError ? '0 0 8px rgba(239,68,68,.4)' : 'none' }}
                               onFocus={(e) => {if(!dateError) e.target.style.borderColor = '#f97316'}} onBlur={(e) => {if(!dateError) e.target.style.borderColor = 'rgba(249,115,22,.3)'}} />
                    </div>
                    <div>
                         <button onClick={() => { setStartDate(''); setEndDate(''); }}
                                 style={{ background: 'transparent', border: '1px solid rgba(226,232,240,.2)', color: 'rgba(226,232,240,.6)', padding: '8px 16px', fontSize: '10px', cursor: 'pointer', borderRadius: '2px', fontFamily: "'Outfit', monospace", letterSpacing: '1px', transition: 'all .3s' }}
                                 onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(226,232,240,.1)'; e.currentTarget.style.borderColor = 'rgba(226,232,240,.4)' }}
                                 onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(226,232,240,.2)' }}>
                              CLEAR FILTER
                         </button>
                    </div>
                </div>
                {dateError && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '-8px', marginBottom: '16px', fontWeight: '500', animation: 'fadeInUp .3s ease' }}>{dateError}</div>}
            </div>

            <div style={{ background: 'linear-gradient(135deg, rgba(12,12,22,.97), rgba(18,8,28,.97))', border: '1px solid rgba(249,115,22,.2)', borderRadius: '3px', overflow: 'hidden', animation: 'fadeInUp .6s ease .1s both' }}>
                <table className="min-w-full" style={{ borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'rgba(5,5,10,.5)', borderBottom: '1px solid rgba(249,115,22,.15)' }}>
                        <tr>
                            <th className="px-6 py-3 text-left font-medium uppercase tracking-wider" style={{ color: 'rgba(226,232,240,.4)', fontFamily: "'Outfit', monospace", fontSize: '10px', letterSpacing: '1px', borderBottom: 'none' }}>Generated At</th>
                            <th className="px-6 py-3 text-left font-medium uppercase tracking-wider" style={{ color: 'rgba(226,232,240,.4)', fontFamily: "'Outfit', monospace", fontSize: '10px', letterSpacing: '1px', borderBottom: 'none' }}>Total SKUs</th>
                            <th className="px-6 py-3 text-left font-medium uppercase tracking-wider" style={{ color: '#ef4444', fontFamily: "'Outfit', monospace", fontSize: '10px', letterSpacing: '1px', borderLeft: '1px solid rgba(239,68,68,.2)', borderBottom: 'none', borderTop: 'none', borderRight: 'none', background: 'rgba(239,68,68,.05)' }}>Low Stock SKUs</th>
                            <th className="px-6 py-3 text-left font-medium uppercase tracking-wider" style={{ color: '#3b82f6', fontFamily: "'Outfit', monospace", fontSize: '10px', letterSpacing: '1px', borderLeft: '1px solid rgba(59,130,246,.2)', borderBottom: 'none', borderTop: 'none', borderRight: 'none', background: 'rgba(59,130,246,.05)' }}>Cold Start SKUs</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredReports.map((r, i) => (
                            <tr key={i} style={{ transition: 'background .2s', borderBottom: '1px solid rgba(249,115,22,.1)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(249,115,22,.05)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'rgba(226,232,240,.6)', borderBottom: 'none' }}>{new Date(r.created_at).toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: '#e2e8f0', borderBottom: 'none' }}>{r.total_skus}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold" style={{ color: '#ef4444', borderLeft: '1px solid rgba(239,68,68,.1)', borderBottom: 'none', borderTop: 'none', borderRight: 'none' }}>{r.low_stock_count}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold" style={{ color: '#3b82f6', borderLeft: '1px solid rgba(59,130,246,.1)', borderBottom: 'none', borderTop: 'none', borderRight: 'none' }}>{r.cold_start_count}</td>
                            </tr>
                        ))}
                        {filteredReports.length === 0 && Array.from(reports).length > 0 && !dateError && <tr><td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'rgba(226,232,240,.4)' }}>No reports found for this date range.</td></tr>}
                        {reports.length === 0 && <tr><td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'rgba(226,232,240,.4)' }}>No snapshots taken yet.</td></tr>}
                    </tbody>
                </table>
            </div>

            {showCsvModal && (
                <div style={{
                    position: "fixed", inset: 0,
                    background: "rgba(6, 10, 16, 0.85)", backdropFilter: "blur(8px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "16px", zIndex: 9999, animation: "fadeIn .3s ease"
                }}>
                    <div style={{
                        background: 'linear-gradient(145deg, #12081a 0%, #0a050f 100%)',
                        border: '1px solid rgba(168,85,247,0.5)',
                        boxShadow: `0 0 0 1px rgba(168,85,247,.2), 0 0 80px rgba(168,85,247,.1), 0 40px 80px rgba(0,0,0,0.8)`,
                        borderRadius: "8px", padding: "32px", maxWidth: "450px", width: "100%", position: "relative"
                    }}>
                        <button onClick={() => setShowCsvModal(false)} style={{ position:'absolute', top:'16px', right:'16px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#e2e8f0' }}>✕</button>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <h3 className="text-xl font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: '#a855f7', letterSpacing: '2px', margin: 0 }}>GENERATE CSV DATASET</h3>
                        </div>

                        <p style={{ fontSize: '12px', color: 'rgba(226,232,240,0.7)', marginBottom: '24px', lineHeight: '1.6', fontFamily: "'Inter', sans-serif" }}>
                            Select a specific date range for the dataset generation. <strong style={{color: '#f97316'}}>Both Start and End dates are required</strong>.
                        </p>

                        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '10px', color: csvDateErrors.csvStartDate ? '#ef4444' : 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', transition: 'color .2s' }}>Start Date</label>
                                <input type="date" value={csvStartDate} 
                                       onChange={e => { setCsvStartDate(e.target.value); if(csvDateErrors.csvStartDate) setCsvDateErrors({...csvDateErrors, csvStartDate: null}); }}
                                       style={{ width: '100%', background: 'rgba(0,0,0,.5)', border: `1px solid ${csvDateErrors.csvStartDate ? '#ef4444' : 'rgba(168,85,247,.3)'}`, padding: '12px', color: '#fff', borderRadius: '4px', outline: 'none', colorScheme: 'dark', fontFamily: "'Inter', sans-serif", transition: 'all .2s ease-in-out', boxShadow: csvDateErrors.csvStartDate ? '0 0 8px rgba(239,68,68,.4)' : 'none' }}
                                       onFocus={(e) => { e.target.style.borderColor = '#a855f7'; e.target.style.boxShadow = '0 0 8px rgba(168,85,247,.4)'; }}
                                       onBlur={(e) => { e.target.style.borderColor = csvDateErrors.csvStartDate ? '#ef4444' : 'rgba(168,85,247,.3)'; e.target.style.boxShadow = csvDateErrors.csvStartDate ? '0 0 8px rgba(239,68,68,.4)' : 'none'; }} />
                                {csvDateErrors.csvStartDate && <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '6px', fontWeight: '500', animation: 'fadeInUp .3s ease' }}>{csvDateErrors.csvStartDate}</div>}
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '10px', color: csvDateErrors.csvEndDate ? '#ef4444' : 'rgba(226,232,240,.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', transition: 'color .2s' }}>End Date</label>
                                <input type="date" value={csvEndDate} 
                                       onChange={e => { setCsvEndDate(e.target.value); if(csvDateErrors.csvEndDate) setCsvDateErrors({...csvDateErrors, csvEndDate: null}); }}
                                       style={{ width: '100%', background: 'rgba(0,0,0,.5)', border: `1px solid ${csvDateErrors.csvEndDate ? '#ef4444' : 'rgba(168,85,247,.3)'}`, padding: '12px', color: '#fff', borderRadius: '4px', outline: 'none', colorScheme: 'dark', fontFamily: "'Inter', sans-serif", transition: 'all .2s ease-in-out', boxShadow: csvDateErrors.csvEndDate ? '0 0 8px rgba(239,68,68,.4)' : 'none' }}
                                       onFocus={(e) => { e.target.style.borderColor = '#a855f7'; e.target.style.boxShadow = '0 0 8px rgba(168,85,247,.4)'; }}
                                       onBlur={(e) => { e.target.style.borderColor = csvDateErrors.csvEndDate ? '#ef4444' : 'rgba(168,85,247,.3)'; e.target.style.boxShadow = csvDateErrors.csvEndDate ? '0 0 8px rgba(239,68,68,.4)' : 'none'; }} />
                                {csvDateErrors.csvEndDate && <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '6px', fontWeight: '500', animation: 'fadeInUp .3s ease' }}>{csvDateErrors.csvEndDate}</div>}
                            </div>
                        </div>

                        <div style={{ height: '16px' }}></div>

                        <button onClick={handleDownloadCSV} disabled={generating}
                            style={{
                            width: '100%', padding: "14px", background: `linear-gradient(135deg, rgba(168,85,247, 0.8), rgba(126,34,206, 0.8))`, 
                            color: "#fff", fontWeight: "bold", border: '1px solid rgba(168,85,247, 0.5)', borderRadius: "4px", cursor: generating ? "not-allowed" : "pointer", 
                            fontFamily: "'Outfit', monospace", letterSpacing: '2px', boxShadow: `0 0 20px rgba(168,85,247, 0.3)`,
                            transition: 'all 0.3s', opacity: generating ? 0.5 : 1
                        }}>
                            {generating ? 'GENERATING...' : 'DOWNLOAD DATASET'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
