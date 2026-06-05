import React, { useState, useRef, useEffect } from 'react';
import { getAlerts, getBusinessMetrics, getProducts, getAccuracy } from '../services/api';

const API_KEY = "fdgddfgdfgdghgfhghghgfh";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

const SYSTEM_PROMPT = `You are the intelligent Assistant for the Dropex.AI Smart Inventory System. This platform uses React, FastAPI, Firebase, and a custom AI Model to govern supply chains.
Crucially, when predicting demand, Dropex uses a state-of-the-art Artificial Intelligence / Machine Learning model (specifically a Gradient Boosting Regressor utilizing 30-day rolling statistics, lags, and temporal features). It does NOT use simple mathematical calculus. 
However, for brand new 'cold-start' products (zero sales history), it temporarily leverages mathematical category baselines scaled by lead times.
If asked about system stability, confirm the system is extremely stable, utilizing robust AI retraining loops and caching layers. Keep your answers concise, professional, informative, and slightly futuristic. Use relevant emojis periodically to make your responses more expressive and engaging. IMPORTANT: When providing points or steps, always use standard newlines and numbers (1., 2., etc.) or dashes (-). DO NOT use Markdown bolding (** or *) because it will not render correctly. Always separate paragraphs with empty lines. Keep text flowing smoothly.`;

export default function AssistantBot() {
    const [isOpen, setIsOpen] = useState(false);
    
    // Hidden context history structure
    const [history, setHistory] = useState([
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "Understood. I am online and ready to assist administrators with Dropex.AI system analysis." }] }
    ]);
    
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [liveContext, setLiveContext] = useState("");
    const chatEndRef = useRef(null);

    const questions = [
        "What is the current operational status of the system?",
        "Is the AI forecasting model currently stable? (Run a system analysis)",
        "Does the system rely on AI-driven forecasting or mathematical fallback logic? Why?"
    ];

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if(isOpen) setTimeout(scrollToBottom, 50);
    }, [history, isOpen]);

    // Background Telemetry Polling (instantly ready when asking questions)
    useEffect(() => {
        let isMounted = true;
        const fetchTelemetry = async () => {
            try {
                const [alertsRes, metricsRes, productsRes, accRes] = await Promise.all([
                    getAlerts().catch(()=>({data:[]})),
                    getBusinessMetrics().catch(()=>({})),
                    getProducts().catch(()=>({data:[]})),
                    getAccuracy().catch(()=>({accuracy: 'N/A', last_trained: 'N/A'}))
                ]);
                if (!isMounted) return;
                
                const numAlerts = alertsRes.data ? alertsRes.data.length : 0;
                const revenue = metricsRes.business_metrics?.total_revenue || 0;
                const numProducts = productsRes.data ? productsRes.data.length : 0;
                const aiAccuracy = accRes.accuracy || 'unknown';
                
                setLiveContext(`\n\n[LIVE TELEMETRY]\nAs of this exact moment, there are EXACTLY ${numAlerts} active inventory alerts. There are ${numProducts} total SKUs. Total period revenue is Rs. ${revenue.toLocaleString()}. The AI Forecasting Model is currently operating at an accuracy of ${aiAccuracy}. Answer queries honestly using this exact live data.`);
            } catch (e) {
                console.error("Telemetry error", e);
            }
        };
        fetchTelemetry();
        const interval = setInterval(fetchTelemetry, 30000); // Poll every 30s
        return () => { isMounted = false; clearInterval(interval); };
    }, []);

    const handleSend = async (text) => {
        if (!text.trim()) return;
        setInputValue('');
        setLoading(true);

        const displayHistory = [...history, { role: "user", parts: [{ text }] }];
        setHistory(displayHistory); // Update UI immediately

        // 2. Inject telemetry into the hidden system core rule
        const hiddenSystemMsg = { role: "user", parts: [{ text: SYSTEM_PROMPT + liveContext }] };
        const apiHistory = [hiddenSystemMsg, history[1], ...history.slice(2), { role: "user", parts: [{ text }] }];

        try {
            const response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: apiHistory })
            });
            const data = await response.json();
            
            let botText = "Error communicating with AI Core.";
            if (data.candidates && data.candidates[0]?.content?.parts?.length > 0) {
                botText = data.candidates[0].content.parts[0].text;
            } else if (data.error) {
                botText = `API Error: ${data.error.message}`;
            }

            setHistory([...displayHistory, { role: "model", parts: [{ text: botText }] }]);
        } catch (error) {
            setHistory([...displayHistory, { role: "model", parts: [{ text: "Neural Network error occurred. Please check connection." }] }]);
        } finally {
            setLoading(false);
        }
    };

    // Filter out the hidden system prompt from UI
    const visibleMessages = history.slice(2);

    return (
        <>
            {/* Full Screen Blur Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md transition-all duration-500"
                    onClick={() => setIsOpen(false)}
                ></div>
            )}

            {/* Chatbot Window */}
            <div className={`fixed bottom-24 right-8 z-50 w-[420px] bg-slate-900 border-2 border-indigo-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-8 pointer-events-none'}`} style={{ height: '600px', boxShadow: '0 20px 50px -12px rgba(99, 102, 241, 0.4)' }}>
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex justify-between items-center border-b border-indigo-400/30">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 bg-slate-900/50 rounded-full flex items-center justify-center text-xl shadow-inner border border-white/10">🤖</div>
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-indigo-600 animate-pulse"></div>
                        </div>
                        <div>
                            <h3 className="font-bold text-white tracking-wide font-['Outfit']">Dropex.AI Nexus</h3>
                            <p className="text-xs text-indigo-100 opacity-80 uppercase tracking-widest">System Intelligence</p>
                        </div>
                    </div>
                </div>

                {/* Message Log */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 font-['Inter'] text-sm" style={{ background: 'linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(30,27,75,0.4) 100%)' }}>
                    
                    {visibleMessages.length === 0 && (
                        <div className="text-center mt-6">
                            <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                                <span className="text-2xl">✨</span>
                            </div>
                            <h4 className="text-indigo-300 font-bold tracking-widest uppercase mb-2">Systems Online</h4>
                            <p className="text-slate-400 text-xs mb-6 px-4">I am connected directly to Dropex's data stream. You can ask me questions about the current architecture, AI forecasts, or stability.</p>
                            
                            <div className="flex flex-col gap-2">
                                {questions.map((q, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => handleSend(q)}
                                        className="text-left bg-slate-800/80 hover:bg-indigo-600/20 text-indigo-200 border border-indigo-500/20 hover:border-indigo-400/50 p-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-sm text-xs"
                                    >
                                        💬 {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {visibleMessages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-2 items-start ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role !== 'user' && (
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm shadow-md border border-slate-600 shrink-0">
                                    🤖
                                </div>
                            )}
                            <div className={`max-w-[75%] p-3 rounded-2xl whitespace-pre-wrap ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm shadow-[0_4px_15px_rgba(79,70,229,0.3)]' : 'bg-slate-800/90 text-slate-200 border border-slate-700/50 rounded-tl-sm shadow-md'}`}>
                                {msg.parts[0].text}
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-sm shadow-md border border-indigo-400/50 shrink-0">
                                    👤
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {loading && (
                        <div className="flex gap-2 items-start justify-start">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm shadow-md border border-slate-600 shrink-0">
                                🤖
                            </div>
                            <div className="bg-slate-800/90 border border-indigo-500/30 p-4 rounded-2xl rounded-tl-sm shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                                <span className="flex gap-1 animate-pulse">
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animation-delay-200"></span>
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animation-delay-400"></span>
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-slate-900 border-t border-slate-700/50">
                    <form 
                        onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
                        className="flex items-center gap-2"
                    >
                        <input 
                            type="text" 
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Type a query to Nexus..." 
                            className="flex-1 bg-slate-800 border border-slate-600 focus:border-indigo-500 text-sm text-white rounded-full px-4 py-3 outline-none transition-all shadow-inner focus:shadow-[0_0_10px_rgba(99,102,241,0.3)]"
                        />
                        <button 
                            type="submit" 
                            disabled={!inputValue.trim() || loading}
                            className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(99,102,241,0.4)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.6)] transition-all active:scale-95"
                        >
                            <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                        </button>
                    </form>
                </div>
            </div>

            {/* Floating Action Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-8 right-8 z-50 w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.6)] flex items-center justify-center text-3xl hover:scale-110 hover:shadow-[0_0_30px_rgba(168,85,247,0.8)] transition-all duration-300 border-2 border-indigo-400/30"
            >
                {isOpen ? '✕' : '🤖'}
            </button>
        </>
    );
}
