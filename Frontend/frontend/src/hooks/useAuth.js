import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

export function useAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async u => {
            if (u) {
                const tokenResult = await u.getIdTokenResult();
                u.role = tokenResult.claims.role || 'staff';
                u.isAdmin = tokenResult.claims.admin === true || u.role === 'admin';
            }
            setUser(u);
            setLoading(false);
        });
        return unsub;
    }, []);

    const login = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
    const logout = () => signOut(auth);
    const resetPassword = (email) => sendPasswordResetEmail(auth, email);

    return { user, loading, login, logout, resetPassword };
}
