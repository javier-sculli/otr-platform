const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as any)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    const result = await this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(result.token);
    return result;
  }

  getGoogleAuthUrl() {
    return `${API_URL}/auth/google`;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {
      // ignorar errores — siempre limpiar el token local
    }
    this.setToken(null);
  }

  async getMe() {
    return this.request<{ user: any }>('/auth/me');
  }

  // Guarda un token JWT obtenido externamente (ej: Google OAuth callback)
  async loginWithToken(token: string) {
    this.setToken(token);
    return this.getMe();
  }

  // Tickets
  async getTickets(filters?: Record<string, string>) {
    const params = new URLSearchParams(filters);
    return this.request<{ data: any[] }>(`/tickets?${params}`);
  }

  async getTicket(id: string) {
    return this.request<{ data: any }>(`/tickets/${id}`);
  }

  async createTicket(data: any) {
    return this.request<{ data: any }>('/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTicket(id: string, data: any) {
    return this.request<{ data: any }>(`/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTicket(id: string) {
    return this.request(`/tickets/${id}`, { method: 'DELETE' });
  }

  // Catalogs
  async getClients() {
    return this.request<{ data: any[] }>('/catalogs/clients');
  }

  async getClientsStats() {
    return this.request<{ data: any[] }>('/catalogs/clients/stats');
  }

  async createClient(data: { name: string; ownerId?: string; canales?: string[] }) {
    return this.request<{ data: any }>('/catalogs/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteClient(id: string) {
    return this.request(`/catalogs/clients/${id}`, { method: 'DELETE' });
  }

  async getBrandVoice(clientId: string) {
    return this.request<{ data: Record<string, string> }>(`/catalogs/clients/${clientId}/brand-voice`);
  }

  async saveBrandVoice(clientId: string, content: Record<string, string>) {
    return this.request<{ data: Record<string, string> }>(`/catalogs/clients/${clientId}/brand-voice`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async getUsers() {
    return this.request<{ data: any[] }>('/catalogs/users');
  }

  async getAreas() {
    return this.request<{ data: any[] }>('/catalogs/areas');
  }

  async getTicketTypes() {
    return this.request<{ data: any[] }>('/catalogs/ticket-types');
  }

  async chatWithAI(ticketId: string, payload: {
    instruction: string;
    currentContent: string;
    brief: string;
    tone: string;
    keywords: string;
    outputLength: string;
  }) {
    return this.request<{ newContent: string | null; summary: string }>(`/ai/${ticketId}/chat`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const api = new ApiClient();
