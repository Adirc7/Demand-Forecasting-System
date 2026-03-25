import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function SessionManager({ children }) {
    const { user, logout } = useAuth();
    const [timeoutMinutes, setTimeoutMinutes] = useState(30); // Default 30 mins
    const [showWarning, setShowWarning] = useState(false);
    const [countdown, setCountdown] = useState(60); // 60 seconds warning

    // Timers
    const idleTimerRef = useRef(null);
    const countdownTimerRef = useRef(null);
    const lastActivityRef = useRef(Date.now());

    // Fetch system settings for timeout
    useEffect(() => {
        if (!user) return;

        const fetchSettings = async () => {
            try {
                const docRef = doc(db, 'settings', 'system');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().session_timeout_minutes) {
                    setTimeoutMinutes(docSnap.data().session_timeout_minutes);
                }
            } catch (err) {
                console.error("Failed to fetch session timeout:", err);
            }
        };
        fetchSettings();
    }, [user]);

    // Handle user activity
    const resetIdleTimer = useCallback(() => {
        // If warning is showing, don't auto-reset just by moving mouse. 
        // They MUST click the "Stay Logged In" button to dismiss the warning.
        if (showWarning) return;

        lastActivityRef.current = Date.now();
        setupIdleTimer();
    }, [showWarning, timeoutMinutes]);

    const setupIdleTimer = useCallback(() => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

        // Calculate when to show the warning (Timeout minus 1 minute)
        // Ensure at least 1 minute timeout so warning logic doesn't break
        const effectiveTimeout = Math.max(2, timeoutMinutes);
        const warningTimeMs = (effectiveTimeout - 1) * 60 * 1000;

        idleTimerRef.current = setTimeout(() => {
            startWarningCountdown();
        }, warningTimeMs);
    }, [timeoutMinutes]);

    const startWarningCountdown = useCallback(() => {
        setShowWarning(true);
        setCountdown(60);

        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

        countdownTimerRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(countdownTimerRef.current);
                    handleLogout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    const handleStayLoggedIn = () => {
        setShowWarning(false);
        setCountdown(60);
        lastActivityRef.current = Date.now();
        setupIdleTimer();
    };

    const handleLogout = useCallback(async () => {
        setShowWarning(false);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

        try {
            await logout();
        } catch (err) {
            console.error("Logout failed:", err);
        }
    }, [logout]);

    // Attach event listeners for activity
    useEffect(() => {
        if (!user) {
            // Cleanup if no user
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            return;
        }

        const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

        // Use a throttled event listener to prevent performance issues
        let throttleTimer;
        const throttledReset = () => {
            if (throttleTimer) return;
            throttleTimer = setTimeout(() => {
                resetIdleTimer();
                throttleTimer = null;
            }, 1000); // Only process activity at most once per second
        };

        events.forEach(e => window.addEventListener(e, throttledReset));

        // Initial setup
        setupIdleTimer();

        return () => {
            events.forEach(e => window.removeEventListener(e, throttledReset));
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            if (throttleTimer) clearTimeout(throttleTimer);
        };
    }, [user, resetIdleTimer, setupIdleTimer]);

    return (
        <>
            {children}
            {showWarning && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#0a050f] border border-[#f97316] rounded-xl p-8 max-w-md w-full shadow-[0_0_30px_rgba(249,115,22,0.2)] text-center animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f97316]/20 flex items-center justify-center">
                            <span className="text-[#f97316] text-3xl font-bold font-['Orbitron']">!</span>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2 font-['Orbitron']">SESSION EXPIRING</h2>
                        <p className="text-slate-300 mb-6 font-['Share_Tech_Mono']">
                            You've been inactive for a while. For your security, you will be logged out in:
                        </p>
                        <div className="text-5xl font-bold text-[#f97316] mb-8 font-['Share_Tech_Mono'] drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]">
                            00:{countdown.toString().padStart(2, '0')}
                        </div>
                        <div className="flex gap-4 w-full">
                            <button
                                onClick={handleLogout}
                                className="flex-1 py-3 px-4 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors font-['Share_Tech_Mono']"
                            >
                                LOGOUT NOW
                            </button>
                            <button
                                onClick={handleStayLoggedIn}
                                className="flex-1 py-3 px-4 rounded bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors font-['Share_Tech_Mono'] font-bold shadow-[0_0_15px_rgba(249,115,22,0.3)] hover:shadow-[0_0_20px_rgba(249,115,22,0.5)]"
                            >
                                STAY LOGGED IN
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
