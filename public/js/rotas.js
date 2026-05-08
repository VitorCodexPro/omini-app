(function initRotasUI() {

  const RotasAPI = {
    listar: (data) => window.API.get('/api/rotas' + (data ? `?data=${data}` : '')),
    criar: (data) => window.API.post('/api/rotas', data),
    atualizar: (id, data) => window.API.patch(`/api/rotas?id=${id}`, data),
    excluir: (id) => window.API.delete(`/api/rotas?id=${id}`)
  };

  function hoje() {
    return new Date().toISOString().split('T')[0];
  }

  function formatarData(data) {
    if (!data) return '--';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  function buildStatusBadge(status) {
    const cor = status === 'finalizada' ? 'aprovado' : 'pendente';
    const label = status === 'finalizada' ? 'Finalizada' : 'Pendente';
    return `<span class="status-badge" data-status="${cor}">${label}</span>`;
  }

  function rotaCard(rota) {
    const cobrarBadge = rota.cobrar
      ? `<span style="font-size:0.72rem;color:var(--accent);font-weight:600;">Cobrar: ${rota.valor ? window.AppUtils.formatCurrencyBRL(rota.valor) : 'Sim'}</span>`
      : `<span style="font-size:0.72rem;color:var(--muted);">Sem cobrança</span>`;

    return `
      <article class="card card-clickable" data-rota-id="${rota.id}" style="display:grid;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <h3 class="orcamento-title">${window.AppUtils.escapeHtml(rota.cliente_nome)}</h3>
            <p class="orcamento-sub">${window.AppUtils.escapeHtml(rota.endereco)}</p>
          </div>
          ${buildStatusBadge(rota.status)}
        </div>
        <p style="font-size:0.82rem;color:var(--text);">${window.AppUtils.escapeHtml(rota.motivo)}</p>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          ${cobrarBadge}
          <span style="font-size:0.72rem;color:var(--muted);">${formatarData(rota.data_visita)}</span>
        </div>
      </article>
    `;
  }

  function abrirModalRota(rota) {
    const isEdit = Boolean(rota);
    const modalId = `rota-form-${Date.now()}`;

    window.AppUtils.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Editar Visita' : 'Nova Visita'}</h3>
        <button class="btn btn-ghost btn-small" data-close>Fechar</button>
      </div>
      <form id="${modalId}" class="form-shell" style="gap:10px;">
        <div class="form-group">
          <label>Cliente *</label>
          <input class="input" id="rota-cliente" placeholder="Nome do cliente" value="${window.AppUtils.escapeHtml(rota?.cliente_nome || '')}" required />
        </div>
        <div class="form-group">
          <label>Endereço *</label>
          <input class="input" id="rota-endereco" placeholder="Endereço completo" value="${window.AppUtils.escapeHtml(rota?.endereco || '')}" required />
        </div>
        <div class="form-group">
          <label>Motivo da visita *</label>
          <textarea class="input" id="rota-motivo" rows="3" placeholder="Descreva o motivo da visita...">${window.AppUtils.escapeHtml(rota?.motivo || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Data da visita</label>
          <input type="date" class="input" id="rota-data" value="${rota?.data_visita || hoje()}" />
        </div>
        <div class="form-group">
          <label>Cobrar visita?</label>
          <select class="input" id="rota-cobrar">
            <option value="false" ${!rota?.cobrar ? 'selected' : ''}>Não</option>
            <option value="true" ${rota?.cobrar ? 'selected' : ''}>Sim</option>
          </select>
        </div>
        <div class="form-group" id="rota-valor-group" style="${rota?.cobrar ? '' : 'display:none;'}">
          <label>Valor da visita (R$)</label>
          <input type="number" step="0.01" class="input" id="rota-valor" placeholder="0,00" value="${rota?.valor || ''}" />
        </div>
        <div class="btn-row" style="margin-top:8px;">
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary" id="btn-salvar-rota">Salvar</button>
        </div>
      </form>
    `);

    // Toggle valor
    const cobrarSelect = document.getElementById('rota-cobrar');
    const valorGroup = document.getElementById('rota-valor-group');
    cobrarSelect.addEventListener('change', () => {
      valorGroup.style.display = cobrarSelect.value === 'true' ? '' : 'none';
    });

    const form = document.getElementById(modalId);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-salvar-rota');
      window.AppUtils.setButtonLoading(btn, true, 'Salvando...');
      try {
        const payload = {
          cliente_nome: document.getElementById('rota-cliente').value.trim(),
          endereco: document.getElementById('rota-endereco').value.trim(),
          motivo: document.getElementById('rota-motivo').value.trim(),
          data_visita: document.getElementById('rota-data').value,
          cobrar: cobrarSelect.value === 'true',
          valor: cobrarSelect.value === 'true' ? parseFloat(document.getElementById('rota-valor').value || 0) : null
        };
        const response = isEdit
          ? await RotasAPI.atualizar(rota.id, payload)
          : await RotasAPI.criar(payload);
        if (response.error) throw new Error(response.error);
        window.AppUtils.showToast(isEdit ? 'Visita atualizada!' : 'Visita criada!', 'success');
        window.AppUtils.closeModal();
        await renderRotasView();
      } catch (err) {
        window.AppUtils.showToast(err.message || 'Erro ao salvar.', 'error');
      } finally {
        window.AppUtils.setButtonLoading(btn, false);
      }
    });
  }

  async function abrirDetalhesRota(id, rotas) {
    const rota = rotas.find(r => r.id === id);
    if (!rota) return;

    const cobrarInfo = rota.cobrar
      ? `Sim — ${rota.valor ? window.AppUtils.formatCurrencyBRL(rota.valor) : 'valor não informado'}`
      : 'Não';

    window.AppUtils.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Detalhes da Visita</h3>
        <button class="btn btn-ghost btn-small" data-close>Fechar</button>
      </div>
      <div class="detail-grid" style="margin-bottom:14px;">
        <div class="detail-row"><strong>Cliente</strong><span>${window.AppUtils.escapeHtml(rota.cliente_nome)}</span></div>
        <div class="detail-row"><strong>Endereço</strong><span>${window.AppUtils.escapeHtml(rota.endereco)}</span></div>
        <div class="detail-row"><strong>Motivo</strong><span>${window.AppUtils.escapeHtml(rota.motivo)}</span></div>
        <div class="detail-row"><strong>Data</strong><span>${formatarData(rota.data_visita)}</span></div>
        <div class="detail-row"><strong>Cobrança</strong><span>${cobrarInfo}</span></div>
        <div class="detail-row"><strong>Status</strong><span>${buildStatusBadge(rota.status)}</span></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary" id="btn-rota-editar">Editar</button>
        ${rota.status === 'pendente'
          ? `<button class="btn btn-primary" id="btn-rota-finalizar">Visita Finalizada</button>`
          : `<button class="btn btn-ghost" id="btn-rota-reabrir">Reabrir</button>`
        }
        <button class="btn btn-danger" id="btn-rota-excluir">Excluir</button>
      </div>
    `);

    document.getElementById('btn-rota-editar')?.addEventListener('click', () => {
      window.AppUtils.closeModal();
      abrirModalRota(rota);
    });

    document.getElementById('btn-rota-finalizar')?.addEventListener('click', async (e) => {
      window.AppUtils.setButtonLoading(e.target, true, 'Finalizando...');
      const res = await RotasAPI.atualizar(id, { status: 'finalizada' });
      if (res.error) { window.AppUtils.showToast(res.error, 'error'); return; }
      window.AppUtils.showToast('Visita finalizada!', 'success');
      window.AppUtils.closeModal();
      await renderRotasView();
    });

    document.getElementById('btn-rota-reabrir')?.addEventListener('click', async (e) => {
      window.AppUtils.setButtonLoading(e.target, true, 'Reabrindo...');
      const res = await RotasAPI.atualizar(id, { status: 'pendente' });
      if (res.error) { window.AppUtils.showToast(res.error, 'error'); return; }
      window.AppUtils.showToast('Visita reaberta!', 'success');
      window.AppUtils.closeModal();
      await renderRotasView();
    });

    document.getElementById('btn-rota-excluir')?.addEventListener('click', async () => {
      const ok = await window.AppUtils.confirmAction('Excluir esta visita?', 'Excluir');
      if (!ok) return;
      const res = await RotasAPI.excluir(id);
      if (res.error) { window.AppUtils.showToast(res.error, 'error'); return; }
      window.AppUtils.showToast('Visita excluída!', 'success');
      window.AppUtils.closeModal();
      await renderRotasView();
    });
  }

  async function renderRotasView() {
    const container = document.getElementById('view-container');
    if (!container) return;

    container.innerHTML = `
      <section class="view-section">
        <div class="section-header">
          <h2 class="section-title">Rotas do Dia</h2>
          <button class="btn btn-primary btn-small" id="btn-nova-rota">+ Nova Visita</button>
        </div>
        <div class="form-group">
          <input type="date" class="input" id="rotas-data" value="${hoje()}" />
        </div>
        <div id="rotas-lista">${window.AppUtils.renderSkeletonCards(3)}</div>
      </section>
    `;

    document.getElementById('btn-nova-rota')?.addEventListener('click', () => abrirModalRota(null));

    async function carregarRotas(data) {
      const lista = document.getElementById('rotas-lista');
      if (!lista) return;
      lista.innerHTML = window.AppUtils.renderSkeletonCards(3);
      const response = await RotasAPI.listar(data);
      if (response.error) {
        lista.innerHTML = `<div class="empty-state">Erro ao carregar rotas.</div>`;
        return;
      }
      const rotas = response.data || [];
      if (!rotas.length) {
        lista.innerHTML = `<div class="empty-state">Nenhuma visita para esta data. Crie a primeira!</div>`;
        return;
      }

      // Resumo
      const total = rotas.length;
      const finalizadas = rotas.filter(r => r.status === 'finalizada').length;
      const totalCobrar = rotas.filter(r => r.cobrar).reduce((acc, r) => acc + (r.valor || 0), 0);

      lista.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">
          <div class="summary-card"><p class="summary-label">Visitas</p><p class="summary-value">${total}</p></div>
          <div class="summary-card"><p class="summary-label">Finalizadas</p><p class="summary-value">${finalizadas}</p></div>
          <div class="summary-card"><p class="summary-label">A Cobrar</p><p class="summary-value" style="font-size:0.85rem;">${window.AppUtils.formatCurrencyBRL(totalCobrar)}</p></div>
        </div>
        <div class="list-stack">${rotas.map(rotaCard).join('')}</div>
      `;

      lista.querySelectorAll('[data-rota-id]').forEach(card => {
        card.addEventListener('click', () => abrirDetalhesRota(card.dataset.rotaId, rotas));
      });
    }

    const dataInput = document.getElementById('rotas-data');
    dataInput?.addEventListener('change', () => carregarRotas(dataInput.value));
    await carregarRotas(hoje());
  }

  window.RotasUI = { renderRotasView };
})();
