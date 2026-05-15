(function initCaixaUI() {

  let categorias = [];
  let periodoAtivo = 'semana';
  let filtroPeriodo = null;

  const API = {
    categorias: {
      listar: () => window.API.get('/api/despesas?tipo=categorias'),
      criar: (nome) => window.API.post('/api/despesas?tipo=categorias', { nome }),
      excluir: (id) => window.API.delete(`/api/despesas?tipo=categorias&id=${id}`)
    },
    entradas: {
      listar: (params) => window.API.get('/api/despesas?tipo=entradas' + (params ? '&' + params.replace(/^&/, '') : '')),
      criar: (data) => window.API.post('/api/despesas?tipo=entradas', data),
      editar: (id, data) => window.API.put(`/api/despesas?tipo=entradas&id=${id}`, data),
      excluir: (id) => window.API.delete(`/api/despesas?tipo=entradas&id=${id}`)
    },
    despesas: {
      listar: (params) => window.API.get('/api/despesas' + (params ? '?' + params.replace(/^&/, '') : '')),
      criar: (data) => window.API.post('/api/despesas', data),
      editar: (id, data) => window.API.put(`/api/despesas?id=${id}`, data),
      excluir: (id) => window.API.delete(`/api/despesas?id=${id}`)
    }
  };

  function hoje() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

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

  function nomeMes(num) {
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return meses[num - 1] || '';
  }

  function periodoLabel(item, tipo) {
    if (tipo === 'semana') return `${formatarData(item.semana_inicio)} a ${formatarData(item.semana_fim)}`;
    return `${nomeMes(item.mes)} ${item.ano}`;
  }

  function periodosDisponiveis(entradas, despesas, tipo) {
    const map = {};
    [...entradas, ...despesas].forEach(d => {
      const key = tipo === 'semana'
        ? d.semana_inicio
        : `${d.ano}-${String(d.mes).padStart(2,'0')}`;
      if (key && !map[key]) {
        map[key] = tipo === 'semana'
          ? { label: `${formatarData(d.semana_inicio)} a ${formatarData(d.semana_fim)}`, semana: d.semana_inicio }
          : { label: `${nomeMes(d.mes)} ${d.ano}`, mes: d.mes, ano: d.ano };
      }
    });
    return Object.entries(map).sort((a,b) => b[0].localeCompare(a[0])).map(([,v]) => v);
  }

  async function gerarPDF(entradas, despesas, periodo) {
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

    const totalEntradas = entradas.reduce((acc, e) => acc + parseFloat(e.valor || 0), 0);
    const totalDespesas = despesas.reduce((acc, d) => acc + parseFloat(d.valor || 0), 0);
    const saldo = totalEntradas - totalDespesas;

    const linhasEntradas = entradas.map(e => `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:7px 4px;font-size:11px;">${formatarData(e.data_entrada)}</td>
        <td style="padding:7px 4px;font-size:11px;">${e.categoria_nome || 'Outros'}</td>
        <td style="padding:7px 4px;font-size:11px;">${e.descricao}</td>
        <td style="padding:7px 4px;font-size:11px;text-align:right;color:#2a7a2a;font-weight:bold;">+ R$ ${parseFloat(e.valor).toFixed(2).replace('.',',')}</td>
      </tr>`).join('');

    const linhasDespesas = despesas.map(d => `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:7px 4px;font-size:11px;">${formatarData(d.data_despesa)}</td>
        <td style="padding:7px 4px;font-size:11px;">${d.categoria_nome || 'Outros'}</td>
        <td style="padding:7px 4px;font-size:11px;">${d.descricao}</td>
        <td style="padding:7px 4px;font-size:11px;text-align:right;color:#a32d2d;font-weight:bold;">- R$ ${parseFloat(d.valor).toFixed(2).replace('.',',')}</td>
      </tr>`).join('');

    const janela = window.open('', '_blank');
    janela.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Relatório de Caixa</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:white; font-family:Arial,sans-serif; }
.doc { width:100%; max-width:794px; margin:0 auto; padding:42px 34px; color:#111; position:relative; }
.watermark { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:65%;opacity:0.07;pointer-events:none; }
.content { position:relative;z-index:1; }
.resumo { display:flex;gap:16px;margin:20px 0; }
.resumo-card { flex:1;padding:12px;border-radius:6px;text-align:center; }
@media print { body{margin:0;} @page{margin:10mm;size:A4;} }
</style>
</head><body>
<div class="doc">
  <img src="${logoWatermark}" class="watermark" />
  <div class="content">
    <img src="${logoSrc}" style="height:80px;width:auto;margin-bottom:16px;display:block;" />
    <h2 style="text-align:center;font-size:18px;letter-spacing:1px;margin-bottom:4px;">RELATÓRIO DE CAIXA</h2>
    <p style="text-align:center;font-size:12px;color:#666;margin-bottom:20px;">${periodo}</p>

    <div class="resumo">
      <div class="resumo-card" style="background:#e8f5e9;">
        <p style="font-size:11px;color:#2a7a2a;margin-bottom:4px;">TOTAL ENTRADAS</p>
        <p style="font-size:16px;font-weight:bold;color:#2a7a2a;">R$ ${totalEntradas.toFixed(2).replace('.',',')}</p>
      </div>
      <div class="resumo-card" style="background:#fce8e8;">
        <p style="font-size:11px;color:#a32d2d;margin-bottom:4px;">TOTAL DESPESAS</p>
        <p style="font-size:16px;font-weight:bold;color:#a32d2d;">R$ ${totalDespesas.toFixed(2).replace('.',',')}</p>
      </div>
      <div class="resumo-card" style="background:${saldo >= 0 ? '#e8f5e9' : '#fce8e8'};">
        <p style="font-size:11px;color:${saldo >= 0 ? '#2a7a2a' : '#a32d2d'};margin-bottom:4px;">SALDO</p>
        <p style="font-size:16px;font-weight:bold;color:${saldo >= 0 ? '#2a7a2a' : '#a32d2d'};">R$ ${saldo.toFixed(2).replace('.',',')}</p>
      </div>
    </div>

    ${entradas.length ? `
    <h3 style="font-size:13px;font-weight:bold;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #2a7a2a;color:#2a7a2a;">ENTRADAS</h3>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#e8f5e9;">
        <th style="padding:8px 4px;font-size:11px;text-align:left;width:15%;">Data</th>
        <th style="padding:8px 4px;font-size:11px;text-align:left;width:20%;">Categoria</th>
        <th style="padding:8px 4px;font-size:11px;text-align:left;">Descrição</th>
        <th style="padding:8px 4px;font-size:11px;text-align:right;width:15%;">Valor</th>
      </tr></thead>
      <tbody>${linhasEntradas}</tbody>
    </table>` : ''}

    ${despesas.length ? `
    <h3 style="font-size:13px;font-weight:bold;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #a32d2d;color:#a32d2d;">DESPESAS</h3>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#fce8e8;">
        <th style="padding:8px 4px;font-size:11px;text-align:left;width:15%;">Data</th>
        <th style="padding:8px 4px;font-size:11px;text-align:left;width:20%;">Categoria</th>
        <th style="padding:8px 4px;font-size:11px;text-align:left;">Descrição</th>
        <th style="padding:8px 4px;font-size:11px;text-align:right;width:15%;">Valor</th>
      </tr></thead>
      <tbody>${linhasDespesas}</tbody>
    </table>` : ''}

    <div style="display:flex;justify-content:flex-end;border-top:2px solid #111;padding-top:12px;margin-top:20px;">
      <div style="text-align:right;">
        <p style="font-size:12px;color:#555;margin-bottom:4px;">Saldo Final</p>
        <p style="font-size:22px;font-weight:bold;color:${saldo >= 0 ? '#2a7a2a' : '#a32d2d'};">R$ ${saldo.toFixed(2).replace('.',',')}</p>
      </div>
    </div>

    <div style="border-top:1px solid #666;padding-top:12px;text-align:center;font-size:11px;line-height:1.6;text-transform:uppercase;margin-top:40px;">
      OMINI SISTEMAS INTEGRADOS · RUA AMARAJI, 372 · SÃO GABRIEL · BH/MG · TEL.: 99997-6648
    </div>
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
</body></html>`);
    janela.document.close();
    window.AppUtils.showToast('Na impressão: desmarque "Cabeçalhos e rodapés".', 'success');
  }

  function abrirFormMovimento(tipo, item) {
    const isEdit = Boolean(item);
    const isEntrada = tipo === 'entrada';
    const modalId = `mov-form-${Date.now()}`;
    const opsCats = categorias.map(c =>
      `<option value="${window.AppUtils.escapeHtml(c.nome)}" ${item?.categoria_nome === c.nome ? 'selected' : ''}>${window.AppUtils.escapeHtml(c.nome)}</option>`
    ).join('');

    window.AppUtils.showModal(`
      <div class="modal-header">
        <h3 class="modal-title" style="color:${isEntrada ? 'var(--success)' : 'var(--danger)'};">
          ${isEdit ? 'Editar' : 'Nova'} ${isEntrada ? 'Entrada' : 'Despesa'}
        </h3>
        <button class="btn btn-ghost btn-small" data-close>Fechar</button>
      </div>
      <form id="${modalId}" class="form-shell" style="gap:10px;">
        <div class="form-group">
          <label>Categoria *</label>
          <select class="input" id="mov-categoria">${opsCats}</select>
        </div>
        <div class="form-group">
          <label>Descrição *</label>
          <input class="input" id="mov-descricao" placeholder="${isEntrada ? 'Ex: Pagamento cliente João' : 'Ex: Abastecimento'}" value="${window.AppUtils.escapeHtml(item?.descricao || '')}" required />
        </div>
        <div class="form-group">
          <label>Valor (R$) *</label>
          <input type="number" step="0.01" class="input" id="mov-valor" placeholder="0,00" value="${item?.valor || ''}" required />
        </div>
        <div class="form-group">
          <label>Data</label>
          <input type="date" class="input" id="mov-data" value="${item?.data_entrada || item?.data_despesa || hoje()}" />
        </div>
        <div class="btn-row" style="margin-top:8px;">
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary" id="btn-salvar-mov">Salvar</button>
        </div>
      </form>
    `);

    const form = document.getElementById(modalId);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-salvar-mov');
      window.AppUtils.setButtonLoading(btn, true, 'Salvando...');
      try {
        const payload = {
          categoria_nome: document.getElementById('mov-categoria').value,
          descricao: document.getElementById('mov-descricao').value.trim(),
          valor: parseFloat(document.getElementById('mov-valor').value),
          [isEntrada ? 'data_entrada' : 'data_despesa']: document.getElementById('mov-data').value
        };
        const response = isEdit
          ? (isEntrada ? await API.entradas.editar(item.id, payload) : await API.despesas.editar(item.id, payload))
          : (isEntrada ? await API.entradas.criar(payload) : await API.despesas.criar(payload));
        if (response.error) throw new Error(response.error);
        window.AppUtils.showToast('Salvo com sucesso!', 'success');
        window.AppUtils.closeModal();
        await renderCaixaView();
      } catch (err) {
        window.AppUtils.showToast(err.message || 'Erro ao salvar.', 'error');
      } finally {
        window.AppUtils.setButtonLoading(btn, false);
      }
    });
  }

  function cardMovimento(item, tipo) {
    const isEntrada = tipo === 'entrada';
    const data = isEntrada ? item.data_entrada : item.data_despesa;
    return `
      <article class="card card-clickable" data-mov-id="${item.id}" data-mov-tipo="${tipo}" style="display:grid;gap:6px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <p style="font-size:0.7rem;font-weight:600;margin-bottom:2px;color:${isEntrada ? 'var(--success)' : 'var(--danger)'};">
              ${isEntrada ? '▲' : '▼'} ${window.AppUtils.escapeHtml(item.categoria_nome || 'Outros')}
            </p>
            <h3 class="orcamento-title" style="font-size:0.88rem;">${window.AppUtils.escapeHtml(item.descricao)}</h3>
          </div>
          <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:0.92rem;color:${isEntrada ? 'var(--success)' : 'var(--danger)'};">
            ${isEntrada ? '+' : '-'} ${window.AppUtils.formatCurrencyBRL(item.valor)}
          </span>
        </div>
        <span class="muted-text">${formatarData(data)}</span>
      </article>
    `;
  }

  async function renderCaixaView() {
    const container = document.getElementById('view-container');
    if (!container) return;

    const resCats = await API.categorias.listar();
    categorias = resCats.data || [];

    const [resEnt, resDes] = await Promise.all([
      API.entradas.listar(),
      API.despesas.listar()
    ]);

    const todasEntradas = resEnt.data || [];
    const todasDespesas = resDes.data || [];

    const periodos = periodosDisponiveis(todasEntradas, todasDespesas, periodoAtivo);
    const periodoSel = filtroPeriodo || (periodos.length ? (periodoAtivo === 'semana' ? periodos[0].semana : `${periodos[0].mes}-${periodos[0].ano}`) : null);

    const opsPeriodos = periodos.map(p => {
      const val = periodoAtivo === 'semana' ? p.semana : `${p.mes}-${p.ano}`;
      const sel = val === periodoSel ? 'selected' : '';
      return `<option value="${val}" ${sel}>${p.label}</option>`;
    }).join('');

    container.innerHTML = `
      <section class="view-section">
        <div class="section-header">
          <h2 class="section-title">Caixa</h2>
          <button class="btn btn-ghost btn-small" id="btn-cats-caixa">Categorias</button>
        </div>

        <div class="filter-row" style="margin-bottom:10px;">
          <button class="chip-filter ${periodoAtivo === 'semana' ? 'active' : ''}" data-periodo="semana">Semanal</button>
          <button class="chip-filter ${periodoAtivo === 'mes' ? 'active' : ''}" data-periodo="mes">Mensal</button>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <select class="input" id="periodo-select">${opsPeriodos || '<option>Nenhum período</option>'}</select>
        </div>

        <div id="caixa-resumo"></div>

        <div class="filter-row" style="margin:10px 0;">
          <button class="chip-filter active" data-tab="todos">Todos</button>
          <button class="chip-filter" data-tab="entradas">Entradas</button>
          <button class="chip-filter" data-tab="despesas">Despesas</button>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <button class="btn btn-primary btn-small" id="btn-nova-entrada" style="flex:1;background:rgba(92,184,92,0.2);color:var(--success);border-color:rgba(92,184,92,0.45);">+ Entrada</button>
          <button class="btn btn-danger btn-small" id="btn-nova-despesa" style="flex:1;">+ Despesa</button>
        </div>

        <div id="caixa-lista">${window.AppUtils.renderSkeletonCards(3)}</div>

        <button class="btn btn-outline btn-small" id="btn-pdf-caixa" style="width:100%;margin-top:12px;border:1.5px solid var(--accent);color:var(--accent);background:transparent;">
          Gerar Relatório PDF
        </button>
      </section>
    `;

    document.getElementById('btn-cats-caixa')?.addEventListener('click', abrirGerenciarCategorias);
    document.getElementById('btn-nova-entrada')?.addEventListener('click', () => abrirFormMovimento('entrada', null));
    document.getElementById('btn-nova-despesa')?.addEventListener('click', () => abrirFormMovimento('despesa', null));

    document.querySelectorAll('[data-periodo]').forEach(btn => {
      btn.addEventListener('click', () => {
        periodoAtivo = btn.dataset.periodo;
        filtroPeriodo = null;
        renderCaixaView();
      });
    });

    let tabAtiva = 'todos';

    async function carregarMovimentos(periodo) {
      let params = '';
      if (periodoAtivo === 'semana') params = `semana=${periodo}`;
      else { const [mes, ano] = periodo.split('-'); params = `mes=${mes}&ano=${ano}`; }

      const [resE, resD] = await Promise.all([
        API.entradas.listar(params),
        API.despesas.listar(params)
      ]);

      const entradas = resE.data || [];
      const despesas = resD.data || [];
      const totalEnt = entradas.reduce((acc, e) => acc + parseFloat(e.valor || 0), 0);
      const totalDes = despesas.reduce((acc, d) => acc + parseFloat(d.valor || 0), 0);
      const saldo = totalEnt - totalDes;

      // Resumo
      const resumo = document.getElementById('caixa-resumo');
      if (resumo) {
        resumo.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
            <div class="summary-card" style="border-left:3px solid var(--success);">
              <p class="summary-label">Entradas</p>
              <p class="summary-value" style="color:var(--success);font-size:0.9rem;">${window.AppUtils.formatCurrencyBRL(totalEnt)}</p>
            </div>
            <div class="summary-card" style="border-left:3px solid var(--danger);">
              <p class="summary-label">Despesas</p>
              <p class="summary-value" style="color:var(--danger);font-size:0.9rem;">${window.AppUtils.formatCurrencyBRL(totalDes)}</p>
            </div>
            <div class="summary-card" style="border-left:3px solid ${saldo >= 0 ? 'var(--success)' : 'var(--danger)'};">
              <p class="summary-label">Saldo</p>
              <p class="summary-value" style="color:${saldo >= 0 ? 'var(--success)' : 'var(--danger)'};font-size:0.9rem;">${window.AppUtils.formatCurrencyBRL(saldo)}</p>
            </div>
          </div>
        `;
      }

      function renderLista() {
        const lista = document.getElementById('caixa-lista');
        if (!lista) return;

        let items = [];
        if (tabAtiva === 'todos') {
          const e = entradas.map(x => ({ ...x, _tipo: 'entrada' }));
          const d = despesas.map(x => ({ ...x, _tipo: 'despesa' }));
          items = [...e, ...d].sort((a, b) => {
            const da = a.data_entrada || a.data_despesa;
            const db = b.data_entrada || b.data_despesa;
            return da.localeCompare(db);
          });
        } else if (tabAtiva === 'entradas') {
          items = entradas.map(x => ({ ...x, _tipo: 'entrada' }));
        } else {
          items = despesas.map(x => ({ ...x, _tipo: 'despesa' }));
        }

        if (!items.length) {
          lista.innerHTML = `<div class="empty-state">Nenhuma movimentação neste período.</div>`;
          return;
        }

        lista.innerHTML = `<div class="list-stack">${items.map(i => cardMovimento(i, i._tipo)).join('')}</div>`;

        lista.querySelectorAll('[data-mov-id]').forEach(card => {
          card.addEventListener('click', () => {
            const tipo = card.dataset.movTipo;
            const item = tipo === 'entrada'
              ? entradas.find(e => e.id === card.dataset.movId)
              : despesas.find(d => d.id === card.dataset.movId);
            if (!item) return;

            const isEntrada = tipo === 'entrada';
            const data = isEntrada ? item.data_entrada : item.data_despesa;

            window.AppUtils.showModal(`
              <div class="modal-header">
                <h3 class="modal-title" style="color:${isEntrada ? 'var(--success)' : 'var(--danger)'};">
                  ${isEntrada ? '▲ Entrada' : '▼ Despesa'}
                </h3>
                <button class="btn btn-ghost btn-small" data-close>Fechar</button>
              </div>
              <div class="detail-grid" style="margin-bottom:14px;">
                <div class="detail-row"><strong>Categoria</strong><span>${window.AppUtils.escapeHtml(item.categoria_nome || 'Outros')}</span></div>
                <div class="detail-row"><strong>Descrição</strong><span>${window.AppUtils.escapeHtml(item.descricao)}</span></div>
                <div class="detail-row"><strong>Valor</strong><span style="color:${isEntrada ? 'var(--success)' : 'var(--danger)'};font-weight:bold;">${isEntrada ? '+' : '-'} ${window.AppUtils.formatCurrencyBRL(item.valor)}</span></div>
                <div class="detail-row"><strong>Data</strong><span>${formatarData(data)}</span></div>
              </div>
              <div class="btn-row">
                <button class="btn btn-secondary" id="btn-mov-editar">Editar</button>
                <button class="btn btn-danger" id="btn-mov-excluir">Excluir</button>
              </div>
            `);

            document.getElementById('btn-mov-editar')?.addEventListener('click', () => {
              window.AppUtils.closeModal();
              abrirFormMovimento(tipo, item);
            });

            document.getElementById('btn-mov-excluir')?.addEventListener('click', async () => {
              const ok = await window.AppUtils.confirmAction('Excluir esta movimentação?', 'Excluir');
              if (!ok) return;
              const res = isEntrada ? await API.entradas.excluir(item.id) : await API.despesas.excluir(item.id);
              if (res.error) { window.AppUtils.showToast(res.error, 'error'); return; }
              window.AppUtils.showToast('Excluído!', 'success');
              window.AppUtils.closeModal();
              await carregarMovimentos(periodo);
            });
          });
        });
      }

      document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          tabAtiva = btn.dataset.tab;
          document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tabAtiva));
          renderLista();
        });
      });

      document.getElementById('btn-pdf-caixa')?.addEventListener('click', () => {
        const periodoLabel = periodoAtivo === 'semana'
          ? `Semana ${formatarData(entradas[0]?.semana_inicio || despesas[0]?.semana_inicio)} a ${formatarData(entradas[0]?.semana_fim || despesas[0]?.semana_fim)}`
          : `${nomeMes(parseInt(periodo.split('-')[0]))} ${periodo.split('-')[1]}`;
        gerarPDF(entradas, despesas, periodoLabel);
      });

      renderLista();
    }

    const periodoSelect = document.getElementById('periodo-select');
    periodoSelect?.addEventListener('change', () => {
      filtroPeriodo = periodoSelect.value;
      carregarMovimentos(periodoSelect.value);
    });

    if (periodoSel) await carregarMovimentos(periodoSel);
    else {
      const lista = document.getElementById('caixa-lista');
      if (lista) lista.innerHTML = `<div class="empty-state">Nenhuma movimentação ainda. Registre a primeira!</div>`;
    }
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
      bindExcluir();
    });

    function bindExcluir() {
      document.querySelectorAll('[data-cat-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const res = await API.categorias.excluir(btn.dataset.catId);
          if (res.error) { window.AppUtils.showToast(res.error, 'error'); return; }
          categorias = categorias.filter(c => c.id !== btn.dataset.catId);
          document.getElementById('lista-cats').innerHTML = renderLista();
          bindExcluir();
        });
      });
    }
    bindExcluir();
  }

  window.CaixaUI = { renderCaixaView };
})();
