import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function AuthCallbackPage() {
    const [searchParams] = useSearchParams();
    const { loginWithToken } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    useEffect(() => {
        const token = searchParams.get('token');
        const errorParam = searchParams.get('error');

        if (errorParam) {
            const messages: Record<string, string> = {
                google_cancelled: 'Cancelaste el login con Google.',
                google_failed: 'Ocurrió un error al iniciar sesión con Google. Intentá de nuevo.',
                email_not_verified: 'Tu cuenta de Google no tiene el email verificado.',
            };
            setError(messages[errorParam] ?? 'Error desconocido.');
            setTimeout(() => navigate('/login'), 3000);
            return;
        }

        if (!token) {
            navigate('/login');
            return;
        }

        loginWithToken(token)
            .then(() => navigate('/'))
            .catch(() => {
                setError('No se pudo validar el token. Intentá de nuevo.');
                setTimeout(() => navigate('/login'), 3000);
            });
    }, [searchParams, loginWithToken, navigate]);

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
                    <p className="text-red-600 text-sm">{error}</p>
                    <p className="text-gray-400 text-xs mt-2">Redirigiendo al login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-600">Iniciando sesión con Google...</p>
            </div>
        </div>
    );
}
