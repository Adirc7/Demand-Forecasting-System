import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deactivateUser } from '../services/api';
import './UserManagement.css';

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    
    // Modals state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    // Form inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('staff');
    const [formError, setFormError] = useState('');

    const rolesAvailable = [
        'admin', 'staff', 'inventory_manager', 
        'forecast_manager', 'sales_manager', 
        'product_manager', 'report_analyst'
    ];

    useEffect(() => { loadUsers(); }, []);

    const loadUsers = async () => {
        try {
            setLoading(true); setErr('');
            setUsers(await getUsers());
        } catch (e) { setErr(e.message); }
        finally { setLoading(false); }
    };

    const handleCreateUser = async () => {
        try {
            setFormError('');
            if (!email || !password) return setFormError('Email and Password required');
            await createUser({ email, password, role });
            setIsAddModalOpen(false);
            resetForm();
            loadUsers();
        } catch (e) {
            setFormError("Failed to create user: " + e.message);
        }
    };

    const handleUpdateRole = async () => {
        try {
            setFormError('');
            await updateUser(selectedUser.uid, { role });
            setIsEditModalOpen(false);
            resetForm();
            loadUsers();
        } catch (e) {
            setFormError("Failed to update: " + e.message);
        }
    };

    const handleToggleStatus = async (user) => {
        try {
            if (user.active) {
                // If active, we deactivate
                await deactivateUser(user.uid);
            } else {
                // If inactive, we re-activate via update
                await updateUser(user.uid, { active: true });
            }
            loadUsers();
        } catch (e) {
            setErr("Status change failed: " + e.message);
        }
    };

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setRole('staff');
        setSelectedUser(null);
        setFormError('');
    };

    const openEditModal = (user) => {
        setSelectedUser(user);
        setRole(user.role);
        setIsEditModalOpen(true);
    };

    const openAddModal = () => {
        resetForm();
        setIsAddModalOpen(true);
    };

    if (loading) return <div className="p-8 text-center" style={{color: '#8b5cf6'}}>Decrypting User Matrix...</div>;

    return (
        <div className="user-wrap">
            <div className="grid-bg" />
            <div className="scanline" />
            <div className="blob1" style={{background: 'radial-gradient(circle, rgba(139, 92, 246, .05) 0%, transparent 70%)'}} />
            
            <main>
                <div className="page-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                        <div className="page-subtitle" style={{ color: '#8b5cf6', textShadow: '0 0 10px rgba(139,92,246,0.5)' }}>// SYSTEM MODULE: ADMIN</div>
                        <h1 className="page-title" style={{textShadow: '0 0 30px rgba(139,92,246,.3)'}}>USER <span>MANAGEMENT</span></h1>
                        <div className="title-bar" style={{ background: 'linear-gradient(90deg, #8b5cf6, transparent)', boxShadow: '0 0 10px rgba(139,92,246,.4)' }} />
                    </div>
                    <button className="add-btn" onClick={openAddModal}>+ INITALIZE NEW USER</button>
                </div>

                {err ? <div className="text-red-500 mb-4 bg-red-900/20 p-4 border border-red-500">{err}</div> : null}

                <div className="cards-grid">
                    {users.map((u, i) => (
                        <div key={u.uid} className="user-card" style={{ animationDelay: `${(i % 9) * 0.05}s` }}>
                            <div className="card-top">
                                <div className="card-email" title={u.email}>{u.email}</div>
                                <div className="user-badge" style={{color: u.active ? '#22c55e' : '#ef4444', borderColor: u.active ? '#22c55e' : '#ef4444', background: u.active ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)'}}>
                                    {u.active ? 'ACTIVE' : 'INACTIVE'}
                                </div>
                            </div>
                            <div className="card-uid">UID: {u.uid}</div>
                            
                            <div className="stat-block">
                                <div className="stat-label-sm">System Role</div>
                                <div className="stat-val-sm">{u.role.toUpperCase()}</div>
                            </div>

                            <div className="divider" />

                            <div className="card-bottom">
                                <button className="action-btn" style={{color: '#a78bfa'}} onClick={() => openEditModal(u)}>
                                    EDIT ROLE
                                </button>
                                <button 
                                    className={`action-btn ${u.active ? 'danger' : 'success'}`} 
                                    onClick={() => handleToggleStatus(u)}
                                >
                                    {u.active ? 'DEACTIVATE' : 'REACTIVATE'}
                                </button>
                            </div>
                        </div>
                    ))}
                    {users.length === 0 && <div className="text-center w-full" style={{gridColumn: '1 / -1', color: '#a78bfa'}}>No users found.</div>}
                </div>
            </main>

            {/* ADD USER MODAL */}
            {isAddModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>INITIALIZE ADMIN / USER</h2>
                        {formError && <div className="text-red-500 text-xs mb-4">{formError}</div>}
                        
                        <div className="form-group">
                            <label>USER EMAIL</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="operative@system.com" />
                        </div>
                        <div className="form-group">
                            <label>TEMPORARY PASSWORD</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                        </div>
                        <div className="form-group">
                            <label>ASSIGN ROLE</label>
                            <select value={role} onChange={e => setRole(e.target.value)}>
                                {rolesAvailable.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setIsAddModalOpen(false)}>CANCEL</button>
                            <button className="add-btn" style={{padding: '8px 16px'}} onClick={handleCreateUser}>GRANT ACCESS</button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT USER ROLE MODAL */}
            {isEditModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>MODIFY USER CLEARANCE</h2>
                        <div className="text-xs text-gray-400 mb-4">Target: {selectedUser?.email}</div>
                        {formError && <div className="text-red-500 text-xs mb-4">{formError}</div>}
                        
                        <div className="form-group">
                            <label>UPDATE ROLE</label>
                            <select value={role} onChange={e => setRole(e.target.value)}>
                                {rolesAvailable.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setIsEditModalOpen(false)}>ABORT</button>
                            <button className="add-btn" style={{padding: '8px 16px'}} onClick={handleUpdateRole}>CONFIRM CHANGE</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
