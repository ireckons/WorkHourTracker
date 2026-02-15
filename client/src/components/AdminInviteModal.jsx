import { useState } from 'react';
import api from '../api/axios';

function AdminInviteModal({ onClose }) {
    const [email, setEmail] = useState('');
    const [expiresInHours, setExpiresInHours] = useState(48);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/admin/invite', { email, expiresInHours });
            setResult(res.data.invite);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create invite');
        } finally {
            setLoading(false);
        }
    };

    const copyLink = async () => {
        if (result?.inviteLink) {
            await navigator.clipboard.writeText(result.inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>✉️ Invite New Admin</h2>
                    <button className="modal-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {!result ? (
                    <form onSubmit={handleSubmit} className="invite-form">
                        {error && <div className="alert alert-error">{error}</div>}

                        <div className="form-group">
                            <label htmlFor="inviteEmail">Email Address</label>
                            <input
                                id="inviteEmail"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="newadmin@example.com"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="inviteExpiry">Expires In</label>
                            <select
                                id="inviteExpiry"
                                value={expiresInHours}
                                onChange={(e) => setExpiresInHours(Number(e.target.value))}
                            >
                                <option value={24}>24 hours</option>
                                <option value={48}>48 hours</option>
                                <option value={72}>72 hours</option>
                                <option value={168}>7 days</option>
                            </select>
                        </div>

                        <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                            {loading ? 'Creating...' : 'Generate Invite Link'}
                        </button>
                    </form>
                ) : (
                    <div className="invite-result">
                        <div className="invite-success">
                            <span className="invite-success-icon">✅</span>
                            <p>Invite created for <strong>{result.email}</strong></p>
                            <p className="invite-expiry">
                                Expires: {new Date(result.expiresAt).toLocaleString()}
                            </p>
                        </div>

                        <div className="invite-link-box">
                            <label>Invite Link</label>
                            <div className="invite-link-row">
                                <input
                                    type="text"
                                    readOnly
                                    value={result.inviteLink}
                                    className="invite-link-input"
                                />
                                <button className="btn btn-accent" onClick={copyLink}>
                                    {copied ? '✓ Copied' : '📋 Copy'}
                                </button>
                            </div>
                        </div>

                        <button className="btn btn-ghost btn-full" onClick={onClose}>
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminInviteModal;
