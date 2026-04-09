import { useEffect, useState } from 'react';
import { env } from './config/env';
import { getHealth, type HealthResponse } from './services/api';
import './App.css';

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkBackend() {
      try {
        setLoading(true);
        setError(null);
        const data = await getHealth();
        setHealth(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setHealth(null);
      } finally {
        setLoading(false);
      }
    }

    void checkBackend();
  }, []);

  return (
    <main className="app-shell">
      <section className="app-card">
        <h1>App Gestion Demo</h1>
        <p className="subtitle">Frontend conectado a backend Node.js + TypeScript</p>

        <div className="row">
          <span className="label">API URL</span>
          <code>{env.apiUrl}</code>
        </div>

        <div className="row">
          <span className="label">Estado backend</span>
          {loading && <span className="pill pending">Verificando...</span>}
          {!loading && !error && <span className="pill ok">Conectado</span>}
          {!loading && error && <span className="pill error">Sin conexión</span>}
        </div>

        {health && (
          <div className="details">
            <div>
              <strong>Servicio:</strong> {health.service}
            </div>
            <div>
              <strong>Timestamp:</strong> {new Date(health.timestamp).toLocaleString()}
            </div>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <p className="hint">
          Configura <code>VITE_API_URL</code> en Railway para apuntar al dominio público del backend.
        </p>
      </section>
    </main>
  );
}

export default App;
