const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface LeccionResponse {
  texto_voz: string;
  estado_pedagogico: 'EXPLICACION' | 'PREGUNTA' | 'EVALUACION';
  feedback?: string;
  es_correcta?: boolean;
  explicacion_extra?: string;
}

async function fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error ?? 'Request failed');
  }

  return response.json();
}

export const leccionApi = {
  async start(leccionId: string, userId: string): Promise<LeccionResponse> {
    return fetchWithAuth<LeccionResponse>('/api/leccion/start', {
      method: 'POST',
      body: JSON.stringify({ leccionId }),
      headers: { 'x-user-id': userId },
    });
  },

  async interact(
    leccionId: string,
    userInput: string,
    currentState: string,
    userId: string,
  ): Promise<LeccionResponse> {
    return fetchWithAuth<LeccionResponse>('/api/leccion/interact', {
      method: 'POST',
      body: JSON.stringify({ leccionId, userInput, currentState }),
      headers: { 'x-user-id': userId },
    });
  },
};
