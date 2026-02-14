import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const initialState = {
    user: null,
    isAuthenticated: false,
    loading: true,
};

function authReducer(state, action) {
    switch (action.type) {
        case 'AUTH_SUCCESS':
            return { user: action.payload, isAuthenticated: true, loading: false };
        case 'AUTH_FAIL':
        case 'LOGOUT':
            return { user: null, isAuthenticated: false, loading: false };
        case 'SET_LOADING':
            return { ...state, loading: true };
        default:
            return state;
    }
}

export function AuthProvider({ children }) {
    const [state, dispatch] = useReducer(authReducer, initialState);

    // Check if user is already authenticated on mount (cookie-based)
    const loadUser = useCallback(async () => {
        try {
            const res = await api.get('/user/me');
            dispatch({ type: 'AUTH_SUCCESS', payload: res.data.user });
        } catch {
            dispatch({ type: 'AUTH_FAIL' });
        }
    }, []);

    useEffect(() => {
        loadUser();
    }, [loadUser]);

    const register = async (name, email, password) => {
        const res = await api.post('/auth/register', { name, email, password });
        dispatch({ type: 'AUTH_SUCCESS', payload: res.data.user });
        return res.data;
    };

    const login = async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        dispatch({ type: 'AUTH_SUCCESS', payload: res.data.user });
        return res.data;
    };

    const logout = async () => {
        await api.post('/auth/logout');
        dispatch({ type: 'LOGOUT' });
    };

    return (
        <AuthContext.Provider value={{ ...state, register, login, logout, loadUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
