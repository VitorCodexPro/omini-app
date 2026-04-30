(function initApiLayer() {

  const API = {
    baseUrl: window.location.origin,

    async request(method, endpoint, body) {
      try {
        const options = {
          method,
          headers: { 'Content-Type': 'application/json' }
        };

        if (body !== undefined) {
          options.body = JSON.stringify(body);
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, options);
        const payload = await response.json().catch(() => ({
          data: null,
          error: 'Resposta inválida do servidor.'
        }));

        if (!response.ok) {
          return { data: null, error: payload.error || `Erro HTTP ${response.status}` };
        }

        return { data: payload.data ?? null, error: payload.error ?? null };

      } catch (error) {
        return { data: null, error: 'Falha de conexão. Verifique sua internet e tente novamente.' };
      }
    },

    async get(endpoint)          { return this.request('GET',    endpoint); },
    async post(endpoint, body)   { return this.request('POST',   endpoint, body); },
    async put(endpoint, body)    { return this.request('PUT',    endpoint, body); },
    async patch(endpoint, body)  { return this.request('PATCH',  endpoint, body); },
    async delete(endpoint)       { return this.request('DELETE', endpoint); }
  };

  const OrcamentosAPI = {
    listar:          ()         => API.get('/api/orcamentos'),
    buscar:          (id)       => API.get(`/api/orcamentos?id=${encodeURIComponent(id)}`),
    criar:           (data)     => API.post('/api/orcamentos', data),
    editar:          (id, data) => API.put(`/api/orcamentos?id=${encodeURIComponent(id)}`, data),
    atualizarStatus: (id, status) => API.patch(`/api/orcamentos?id=${encodeURIComponent(id)}`, { status }),
    excluir:         (id)       => API.delete(`/api/orcamentos?id=${encodeURIComponent(id)}`)
  };

  const ClientesAPI = {
    listar:  ()         => API.get('/api/clientes'),
    buscar:  (id)       => API.get(`/api/clientes?id=${encodeURIComponent(id)}`),
    criar:   (data)     => API.post('/api/clientes', data),
    editar:  (id, data) => API.put(`/api/clientes?id=${encodeURIComponent(id)}`, data),
    excluir: (id)       => API.delete(`/api/clientes?id=${encodeURIComponent(id)}`)
  };

  window.API = API;
  window.OrcamentosAPI = OrcamentosAPI;
  window.ClientesAPI = ClientesAPI;

})();