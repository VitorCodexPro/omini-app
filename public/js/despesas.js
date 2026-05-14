(function initDespesasUI() {

  const API = {
    categorias: {
      listar: () => window.API.get('/api/despesas?tipo=categorias'),
      criar: (nome) => window.API.post('/api/despesas?tipo=categorias', { nome }),
      excluir: (id) => window.API.delete(`/api/despesas?tipo=categorias&id=${id}`)
    },
    despesas: {
      listar: (semana) => window.API.get(`/api/despesas${semana ? '?semana='+semana : ''}`),
      criar: (data) => window.API.post('/api/despesas', data),
      editar: (id, data) => window.API.put(`/api/despesas?id=${id}`, data),
      excluir: (id) => window.API.delete(`/api/despesas?id=${id}`)
    }
  };

  let categorias = [];

  function semanaAtual() {
    const d = new Date();
    const dia = d.getDay();
    const inicio = new Date(d);
    inicio.setDate(d.getDate() - dia);
    return inicio.toISOString().split('T')[0];
  }

  function formatarData(data) {
    if (!data) return '--';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  function semanaLabel(inicio, fim) {
    return `${formatarData(inicio)} a ${formatarData(fim)}`;
  }

  function semanasDisponiveis(despesas) {
    const semanas = {};
    despesas.forEach(d => {
      if (d.semana_inicio) semanas[d.semana_inicio] = d.semana_fim;
    });
    return Object.entries(semanas).sort((a, b) => b[0].localeCompare(a[0]));
  }

  async function gerarPDFSemana(despesas, inicioSemana, fimSemana) {
    let logoSrc = '/img/logo.png';
    let logoWatermark = '/img/logo-transpa.png';
    try {
      const r = await fetch('/img/logo.png');
      const b = await r.blob();
      logoSrc = await new Promise(res => { const fr = new FileReader(); fr.onloadend = () => res(fr.result); fr.readAsDataURL(b); });
    } catch(e) {}
    try {
      const r = await fetch('/img/logo-transpa.png');
      const b = await r.blob();
      logoWatermark = await new Promise(res => { const fr = new FileReader(); fr.onloadend = () => res(fr.result); fr.readAsDataURL(b); });
    } catch(e) {}

    const total = despesas.reduce((acc, d) => acc + parseFloat(d.valor || 0), 0);
    const linhas = despesas.map(d => `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px 4px;font-size:12px;">${formatarData(d.data_despesa)}</td>
        <td style="padding:8px 4px;font-size:12px;">${d.categoria_nome || 'Outros'}</td>
        <td style="padding:8px 4px;font-size:12px;">${d.descricao}</td>
        <td style="padding:8px 4px;font-size:12px;text-align:right;font-weight:bold;">R$ ${parseFloat(d.valor).toFixed(2).replace('.',',')}</td>
      </tr>
    `).join('');

    const janela = window.open('', '_blank');
    janela.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Despesas - Semana ${formatarData(inicioSemana)}</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:white; font-family:Arial,sans-serif; }
.doc { width:100%; max-width:794px; margin:0 auto; padding:42px 34px; color:#111; position:relative; }
.watermark { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:65%;opacity:0.07;pointer-events:none; }
.content { position:relative;z-index:1; }
@media print { body{margin:0;} @page{margin:10mm;size:A4;} }
</style>
</head><body>
<div class="doc">
  <img src="${logoWatermark}" class="watermark" />
  <div class="content">
    <img src="${logoSrc}" style="height:80px;width:auto;margin-bottom:20px;display:block;" />
    <h2 style="text-align:center;font-size:18px;letter-spacing:1px;margin-bottom:6px;">RELATÓRIO DE DESPESAS</h2>
    <p style="text-align:center;font-size:12px;color:#666;margin-bottom:24px;">Semana: ${formatarData(inicioSemana)} a ${formatarData(fimSemana)}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr style="background:#f5f5f5;border-bottom:2px solid #111;">
          <th style="padding:10px 4px;font-size:12px;text-align:left;width:15%;">Data</th>
          <th style="padding:10px 4px;font-size:12px;text-align:left;width:20%;">Categoria</th>
          <th style="padding:10px 4px;font-size:12px;text-align:left;">Descrição</th>
          <th style="padding:10px 4px;font-size:12px;text-align:right;width:15%;">Valor</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;border-top:2px solid #111;padding-top:12px;">
      <div style="text-align:right;">
        <p style="font-size:13px;color:#555;margin-bottom:4px;">Total da Semana</p>
        <p style="font-size:20px;font-weight:bold;">R$ ${total.toFixed(2).replace('.',',')}</p>
      </div>
    </div>
    <div style="border-top:1px solid #666;padding-top:12px;text-align:center;font-size:11px;line-height:1.6;text-transform:uppercase;margin-top:40px;">
      OMINI SISTEMAS INTEGRADOS<br>
      RUA AMARAJI, 372 - BAIRRO SÃO GABRIEL<br>
      BELO HORIZONTE - MG · TEL.: 99997-6648
    </div>
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
</body></html>`);
    janela.document.close();
    window.AppUtils.showToast('Na impressão: desmarque "Cabeçalhos e rodapés".', 'success');
  }

  async function abrirFormDespesa(despesa) {
    const isEdit = Boolean(despesa);
    const modalId = `desp-form-${Date.now()}`;
    const opcoesCategoria = categorias.map(c =>
      `<option value="${c.id}" data-nome="${window.AppUtils.escapeHtml(c.nome)}" ${despesa?.categoria_id === c.id ? 'selected' : ''}>${window.AppUtils.escapeHtml(c.nome)}</option>`
    ).join('');

    window.AppUtils.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Editar Despesa' : 'Nova Despesa'}</h3>
        <button class="btn btn-ghost btn-small" data-close>Fechar</button>
      </div>
      <form id="${modalId}" class="form-shell" style="gap:10px;">
        <div class="form-group">
          <label>Categoria *</label>
          <select class="input" id="desp-categoria">${opcoesCategoria}</select>
        </div>
        <div class="form-group">
          <label>Descrição *</label>
          <input class="input" id="desp-descricao" placeholder="Ex: Abastecimento posto Shell" value="${window.AppUtils.escapeHtml(despesa?.descricao || '')}" required />
        </div>
        <div class="form-group">
          <label>Valor (R$) *</label>
          <input type="number" step="0.01" class="input" id="desp-valor" placeholder="0,00" value="${despesa?.valor || ''}" required />
        </div>
        <div class="form-group">
          <label>Data</label>
          <input type="date" class="input" id="desp-data" value="${despesa?.data_despesa || new Date().toISOString().split('T')[0]}" />
        </div>
        <div class="btn-row" style="margin-top:8px;">
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary" id="btn-salvar-desp">Salvar</button>
        </div>
      </form>
    `);

    const form = document.getElementById(modalId);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-salvar-desp');
      window.AppUtils.setButtonLoading(btn, true, 'Salvando...');
      try {
        const select = document.getElementById('desp-categoria');
        const opt = select.options[select.selectedIndex];
        const payload = {
          categoria_id: select.value,
          categoria_nome: opt.dataset.nome,
          descricao: document.getElementById('desp-descricao').value.trim(),
          valor: parseFloat(document.getElementById('desp-valor').value),
          data_despesa: document.getElementById('desp-data').value
        };
        const response = isEdit
          ? await API.despesas.editar(despesa.id, payload)
          : await API.despesas.criar(payload);
        if (response.error) throw new Error(response.error);
        window.AppUtils.showToast(isEdit ? 'Despesa atualizada!' : 'Despesa registrada!', 'success');
        window.AppUtils.closeModal();
        await renderDespesasView();
      } catch (err) {
        window.AppUtils.showToast(err.message || 'Erro ao salvar.', 'error');
      } finally {
        window.AppUtils.setButtonLoading(btn, false);
      }
    });
  }

  async function abrirGerenciarCategorias() {
    const renderLista = () => categorias.map(c => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:0.5px solid var(--border);">
        <span style="font-size:14px;">${window.AppUtils.escapeHtml(c.nome)}</span>
        <button class="btn btn-danger btn-small" data-cat-id="${c.id}" style="min-height:32px;padding:0 10px;font-size:12px;">Excluir</button>
      </div>
    `).join('');

    window.AppUtils.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Categorias</h3>
        <button class="btn btn-ghost btn-small" data-close>Fechar</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:14px;">
        <input class="input" id="nova-cat-input" placeholder="Nova categoria..." style="flex:1;" />
        <button class="btn btn-primary btn-small" id="btn-add-cat">Adicionar</button>
      </div>
      <div id="lista-cats">${renderLista()}</div>
    `);

    document.getElementById('btn-add-cat')?.addEventListener('click', async () => {
      const input = document.getElementById('nova-cat-input');
      const nome = input?.value.trim();
      if (!nome) return;
      const res = await API.categorias.criar(nome);
      if (res.error) { window.AppUtils.showToast(res.error, 'error'); return; }
      categorias.push(res.data);
      input.value = '';
      document.getElementById('lista-cats').innerHTML = renderLista();
      bindExcluirCat();
    });

    function bindExcluirCat() {
      document.querySelectorAll('[data-cat-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.catId;
          const res = await API.categorias.excluir(id);
          if (res.error) { window.AppUtils.showToast(res.error, 'error'); return; }
          categorias = categorias.filter(c => c.id !== id);
          document.getElementById('lista-cats').innerHTML = renderLista();
          bindExcluirCat();
        });
      });
    }
    bindExcluirCat();
  }

  async function renderDespesasView() {
    const container = document.getElementById('view-container');
    if (!container) return;

    const [resCats, resDespesas] = await Promise.all([
      API.categorias.listar(),
      API.despesas.listar()
    ]);

    categorias = resCats.data || [];
    const todasDespesas = resDespesas.data || [];
    const semanas = semanasDisponiveis(todasDespesas);
    const semanaAtiva = semanas.length ? semanas[0][0] : semanaAtual();
    const semanaFim = semanas.length ? semanas[0][1] : '';

    const optsSemanas = semanas.map(([ini, fim]) =>
      `<option value="${ini}" ${ini === semanaAtiva ? 'selected' : ''}>${semanaLabel(ini, fim)}</option>`
    ).join('');

    container.innerHTML = `
      <section class="view-section">
        <div class="section-header">
          <h2 class="section-title">Despesas</h2>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-ghost btn-small" id="btn-cats">Categorias</button>
            <button class="btn btn-primary btn-small" id="btn-nova-desp">+ Nova</button>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:10px;">
          <select class="input" id="semana-select">${optsSemanas || '<option value="">Nenhuma semana</option>'}</select>
        </div>
        <div id="despesas-lista">${window.AppUtils.renderSkeletonCards(3)}</div>
      </section>
    `;

    document.getElementById('btn-nova-desp')?.addEventListener('click', () => abrirFormDespesa(null));
    document.getElementById('btn-cats')?.addEventListener('click', abrirGerenciarCategorias);

    async function carregarDespesas(semana) {
      const lista = document.getElementById('despesas-lista');
      if (!lista) return;
      lista.innerHTML = window.AppUtils.renderSkeletonCards(3);
      const res = await API.despesas.listar(semana);
      const despesas = res.data || [];

      if (!despesas.length) {
        lista.innerHTML = `<div class="empty-state">Nenhuma despesa nesta semana.</div>`;
        return;
      }

      const total = despesas.reduce((acc, d) => acc + parseFloat(d.valor || 0), 0);
      const semFim = despesas[0]?.semana_fim || '';

      lista.innerHTML = `
        <div class="summary-card" style="margin-bottom:12px;">
          <p class="summary-label">Total da semana</p>
          <p class="summary-value">${window.AppUtils.formatCurrencyBRL(total)}</p>
        </div>
        <button class="btn btn-outline btn-small" id="btn-pdf-semana" style="width:100%;margin-bottom:12px;border:1.5px solid var(--accent);color:var(--accent);background:transparent;">
          Gerar Relatório PDF
        </button>
        <div class="list-stack">
          ${despesas.map(d => `
            <article class="card card-clickable" data-desp-id="${d.id}" style="display:grid;gap:6px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <p style="font-size:0.72rem;color:var(--accent);font-weight:600;margin-bottom:3px;">${window.AppUtils.escapeHtml(d.categoria_nome || 'Outros')}</p>
                  <h3 class="orcamento-title" style="font-size:0.9rem;">${window.AppUtils.escapeHtml(d.descricao)}</h3>
                </div>
                <span class="orcamento-total">${window.AppUtils.formatCurrencyBRL(d.valor)}</span>
              </div>
              <span class="muted-text">${formatarData(d.data_despesa)}</span>
            </article>
          `).join('')}
        </div>
      `;

      document.getElementById('btn-pdf-semana')?.addEventListener('click', () => gerarPDFSemana(despesas, semana, semFim));

      lista.querySelectorAll('[data-desp-id]').forEach(card => {
        card.addEventListener('click', async () => {
          const desp = despesas.find(d => d.id === card.dataset.despId);
          if (!desp) return;
          window.AppUtils.showModal(`
            <div class="modal-header">
              <h3 class="modal-title">Despesa</h3>
              <button class="btn btn-ghost btn-small" data-close>Fechar</button>
            </div>
            <div class="detail-grid" style="margin-bottom:14px;">
              <div class="detail-row"><strong>Categoria</strong><span>${window.AppUtils.escapeHtml(desp.categoria_nome || 'Outros')}</span></div>
              <div class="detail-row"><strong>Descrição</strong><span>${window.AppUtils.escapeHtml(desp.descricao)}</span></div>
              <div class="detail-row"><strong>Valor</strong><span style="color:var(--accent);font-weight:bold;">${window.AppUtils.formatCurrencyBRL(desp.valor)}</span></div>
              <div class="detail-row"><strong>Data</strong><span>${formatarData(desp.data_despesa)}</span></div>
            </div>
            <div class="btn-row">
              <button class="btn btn-secondary" id="btn-desp-editar">Editar</button>
              <button class="btn btn-danger" id="btn-desp-excluir">Excluir</button>
            </div>
          `);
          document.getElementById('btn-desp-editar')?.addEventListener('click', () => {
            window.AppUtils.closeModal();
            abrirFormDespesa(desp);
          });
          document.getElementById('btn-desp-excluir')?.addEventListener('click', async () => {
            const ok = await window.AppUtils.confirmAction('Excluir esta despesa?', 'Excluir');
            if (!ok) return;
            await API.despesas.excluir(desp.id);
            window.AppUtils.showToast('Despesa excluída!', 'success');
            window.AppUtils.closeModal();
            await renderDespesasView();
          });
        });
      });
    }

    const semanaSelect = document.getElementById('semana-select');
    semanaSelect?.addEventListener('change', () => carregarDespesas(semanaSelect.value));
    await carregarDespesas(semanaAtiva);
  }

  window.DespesasUI = { renderDespesasView };
})();
