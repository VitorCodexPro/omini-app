(function initOrcamentoUI() {
  const FORMA_PAGAMENTO_PADRAO = 'À VISTA NA ENTREGA DO SERVIÇO.';
  const VALIDADE_PADRAO = 'ORÇAMENTO VÁLIDO POR 15 DIAS.';

  const state = {
    orcamentos: [],
    clientes: [],
    filtroStatus: 'todos',
    detalhesCache: {}
  };

  function clienteFromRelation(rel) {
    if (!rel) {
      return null;
    }

    if (Array.isArray(rel)) {
      return rel[0] || null;
    }

    return rel;
  }

  function parseNumber(value) {
    return Number(window.AppUtils.normalizeMoneyInput(value) || 0);
  }

  function sortItens(itens) {
    return (Array.isArray(itens) ? itens : [])
      .slice()
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }

  function getClienteNome(orcamento) {
    if (!orcamento) {
      return 'Cliente não informado';
    }

    if (orcamento.cliente_nome) {
      return orcamento.cliente_nome;
    }

    const cliente = clienteFromRelation(orcamento.clientes);
    if (cliente && cliente.nome) {
      return cliente.nome;
    }

    return 'Cliente não informado';
  }

  function getCidadeCliente(orcamento) {
    const cliente = clienteFromRelation(orcamento?.clientes);
    return cliente?.cidade || 'Belo Horizonte';
  }

  function buildStatusBadge(status) {
    const meta = window.AppUtils.getStatusMeta(status);
    return `<span class="status-badge" data-status="${status}">${window.AppUtils.escapeHtml(meta.label)}</span>`;
  }

  function defaultLocalData(cidade) {
    const nomeCidade = (cidade || 'Belo Horizonte').toUpperCase();
    return `${nomeCidade}, ${window.AppUtils.todayPTBR()}`;
  }

  async function carregarClientes(forceReload) {
    if (!forceReload && state.clientes.length) {
      return state.clientes;
    }

    const response = await window.ClientesAPI.listar();
    if (response.error) {
      throw new Error(response.error);
    }

    state.clientes = Array.isArray(response.data) ? response.data : [];
    return state.clientes;
  }

  async function carregarOrcamentos(forceReload) {
    if (!forceReload && state.orcamentos.length) {
      return state.orcamentos;
    }

    const response = await window.OrcamentosAPI.listar();
    if (response.error) {
      throw new Error(response.error);
    }

    state.orcamentos = Array.isArray(response.data) ? response.data : [];
    return state.orcamentos;
  }

  function summaryTotals(orcamentos) {
    const total = orcamentos.length;
    const pendentes = orcamentos.filter((item) => item.status === 'pendente').length;

    const now = new Date();
    const valorMes = orcamentos
      .filter((item) => {
        const date = new Date(item.criado_em);
        if (Number.isNaN(date.getTime())) {
          return false;
        }
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      })
      .reduce((acc, item) => acc + parseNumber(item.total), 0);

    return {
      total,
      pendentes,
      valorMes
    };
  }

  function orcamentoCard(orcamento) {
    const clienteNome = getClienteNome(orcamento);
    const dataLocal = orcamento.local_data || window.AppUtils.formatDatePTBR(orcamento.criado_em);
    const numero = orcamento.numero ? `OMI-${new Date(orcamento.criado_em).getFullYear()}-${String(orcamento.numero).padStart(4,'0')}` : '';

    return `
      <article class="card orcamento-card card-clickable" data-orcamento-id="${orcamento.id}">
        <div class="orcamento-head">
          <div>
            ${numero ? `<p style="font-family:'IBM Plex Mono',monospace;font-size:0.7rem;color:var(--accent);margin-bottom:3px;">${numero}</p>` : ''}
            <h3 class="orcamento-title">${window.AppUtils.escapeHtml(orcamento.titulo || 'Sem título')}</h3>
            <p class="orcamento-sub">${window.AppUtils.escapeHtml(clienteNome)}</p>
          </div>
          <span class="orcamento-total">${window.AppUtils.formatCurrencyBRL(orcamento.total || 0)}</span>
        </div>

        <div class="badge-row">
          ${buildStatusBadge(orcamento.status || 'pendente')}
          <span class="muted-text">${window.AppUtils.escapeHtml(dataLocal)}</span>
        </div>
      </article>
    `;
  }

  function getOrcamentoById(id) {
    return state.orcamentos.find((item) => item.id === id) || null;
  }

  async function renderDashboard() {
    const container = document.getElementById('view-container');
    if (!container) {
      return;
    }

    container.innerHTML = `
      <section class="view-section" id="dashboard-view">
        <div class="section-header">
          <h2 class="section-title">Resumo do Mês</h2>
        </div>

        <div class="summary-grid">
          <article class="summary-card">
            <p class="summary-label">Orçamentos</p>
            <p class="summary-value" id="dash-total-orcamentos">--</p>
          </article>
          <article class="summary-card">
            <p class="summary-label">Valor no Mês</p>
            <p class="summary-value" id="dash-valor-mes">--</p>
          </article>
          <article class="summary-card">
            <p class="summary-label">Pendentes</p>
            <p class="summary-value" id="dash-pendentes">--</p>
          </article>
        </div>

        <div class="section-header">
          <h2 class="section-title">Últimos 5 Orçamentos</h2>
        </div>

        <div id="dashboard-ultimos">${window.AppUtils.renderSkeletonCards(3)}</div>

        <a href="#/novo" class="fab-new" aria-label="Criar novo orçamento">+</a>
      </section>
    `;

    try {
      const orcamentos = await carregarOrcamentos(true);
      const resumo = summaryTotals(orcamentos);

      const totalTarget = document.getElementById('dash-total-orcamentos');
      const valorMesTarget = document.getElementById('dash-valor-mes');
      const pendentesTarget = document.getElementById('dash-pendentes');

      if (totalTarget) {
        totalTarget.textContent = String(resumo.total);
      }
      if (valorMesTarget) {
        valorMesTarget.textContent = window.AppUtils.formatCurrencyBRL(resumo.valorMes);
      }
      if (pendentesTarget) {
        pendentesTarget.textContent = String(resumo.pendentes);
      }

      const listaTarget = document.getElementById('dashboard-ultimos');
      if (!listaTarget) {
        return;
      }

      const ultimos = orcamentos.slice(0, 5);

      if (!ultimos.length) {
        listaTarget.innerHTML = `
          <div class="empty-state">
            Nenhum orçamento ainda. Crie o primeiro!
          </div>
        `;
      } else {
        listaTarget.innerHTML = `<div class="list-stack">${ultimos.map(orcamentoCard).join('')}</div>`;
      }

      listaTarget.addEventListener('click', (event) => {
        const card = event.target.closest('[data-orcamento-id]');
        if (!card) {
          return;
        }
        abrirDetalhesOrcamento(card.dataset.orcamentoId);
      });
    } catch (error) {
      const listaTarget = document.getElementById('dashboard-ultimos');
      if (listaTarget) {
        listaTarget.innerHTML = `
          <div class="empty-state">
            Não foi possível carregar o dashboard no momento.
          </div>
        `;
      }
      window.AppUtils.showToast(error.message || 'Erro ao carregar dashboard.', 'error');
    }
  }

  function renderOrcamentosFiltrados() {
    const listTarget = document.getElementById('orcamentos-lista');
    if (!listTarget) {
      return;
    }

    const filtrados =
      state.filtroStatus === 'todos'
        ? state.orcamentos
        : state.orcamentos.filter((item) => item.status === state.filtroStatus);

    if (!filtrados.length) {
      listTarget.innerHTML = `
        <div class="empty-state">
          Nenhum orçamento encontrado para o filtro selecionado.
        </div>
      `;
      return;
    }

    listTarget.innerHTML = `<div class="list-stack">${filtrados.map(orcamentoCard).join('')}</div>`;
  }

  function atualizarFiltroVisual() {
    document.querySelectorAll('.chip-filter').forEach((button) => {
      if (button.dataset.status === state.filtroStatus) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  async function renderListaOrcamentos() {
    const container = document.getElementById('view-container');
    if (!container) {
      return;
    }

    container.innerHTML = `
      <section class="view-section" id="orcamentos-view">
        <div class="section-header">
          <h2 class="section-title">Lista de Orçamentos</h2>
        </div>

        <div class="filter-row" id="orcamentos-filtro">
          <button class="chip-filter active" data-status="todos">Todos</button>
          <button class="chip-filter" data-status="pendente">Pendente</button>
          <button class="chip-filter" data-status="aprovado">Aprovado</button>
          <button class="chip-filter" data-status="recusado">Recusado</button>
        </div>

        <div id="orcamentos-lista">${window.AppUtils.renderSkeletonCards(4)}</div>
      </section>
    `;

    const filtroTarget = document.getElementById('orcamentos-filtro');
    if (filtroTarget) {
      filtroTarget.addEventListener('click', (event) => {
        const button = event.target.closest('[data-status]');
        if (!button) {
          return;
        }

        state.filtroStatus = button.dataset.status;
        atualizarFiltroVisual();
        renderOrcamentosFiltrados();
      });
    }

    const listTarget = document.getElementById('orcamentos-lista');
    if (listTarget) {
      listTarget.addEventListener('click', (event) => {
        const card = event.target.closest('[data-orcamento-id]');
        if (!card) {
          return;
        }
        abrirDetalhesOrcamento(card.dataset.orcamentoId);
      });
    }

    try {
      await carregarOrcamentos(true);
      renderOrcamentosFiltrados();
    } catch (error) {
      if (listTarget) {
        listTarget.innerHTML = `
          <div class="empty-state">
            Não foi possível carregar os orçamentos agora.
          </div>
        `;
      }
      window.AppUtils.showToast(error.message || 'Erro ao listar orçamentos.', 'error');
    }
  }

  function extractItens(orcamento) {
    return sortItens(orcamento.itens_orcamento || orcamento.itens || []);
  }

  function normalizePreviewData(source) {
    // Normaliza dados de diferentes origens (formulário ou API) para o mesmo template de preview.
    const cliente = clienteFromRelation(source.clientes);
    const itens = extractItens(source)
      .map((item, index) => ({
        descricao: item.descricao || '',
        quantidade: item.quantidade || '01',
        valor: parseNumber(item.valor),
        ordem: Number.isInteger(item.ordem) ? item.ordem : index
      }))
      .filter((item) => item.descricao.trim());

    const totalItens = itens.reduce((acc, item) => acc + parseNumber(item.valor), 0);
    const total = parseNumber(source.total) || totalItens;

    return {
      id: source.id || null,
      numero: source.numero ?? null,
      titulo: source.titulo || 'Sem título',
      cliente_nome: source.cliente_nome || cliente?.nome || 'Cliente não informado',
      local_data: source.local_data || defaultLocalData(cliente?.cidade),
      atencao: source.atencao || '',
      itens,
      total,
      forma_pagamento: source.forma_pagamento || FORMA_PAGAMENTO_PADRAO,
      validade: source.validade || VALIDADE_PADRAO
    };
  }

  function previewDocumentMarkup(data) {
    const itensMarkup = data.itens.length
      ? data.itens
          .map(
            (item) => `
            <div class="doc-item">
              <span class="doc-item-qtd">${window.AppUtils.escapeHtml(item.quantidade)}</span>
              <span>${window.AppUtils.escapeHtml(item.descricao.toUpperCase())}</span>
            </div>
          `
          )
          .join('')
      : '<p class="doc-line">SEM ITENS INFORMADOS</p>';

    return `
      <div class="preview-wrap">
        <div class="preview-scroll">
          <div class="doc-page" id="preview-document">
            <div class="doc-logo"><img src="/img/logo.png" alt="OMINI" style="height: 100px; width: auto;" /></div>

            <h2 class="doc-title">ORÇAMENTO</h2>
            ${data.numero ? `<p style="text-align:center;font-size:11px;color:#666;margin-bottom:16px;letter-spacing:1px;">Nº OMI-${new Date().getFullYear()}-${String(data.numero).padStart(4,'0')}</p>` : ''}

            <p class="doc-line">${window.AppUtils.escapeHtml(data.titulo.toUpperCase())}</p>
            <p class="doc-line">${window.AppUtils.escapeHtml(data.cliente_nome.toUpperCase())}</p>
            <p class="doc-line">${window.AppUtils.escapeHtml(data.local_data.toUpperCase())}</p>
            <p class="doc-line">AC. ${window.AppUtils.escapeHtml((data.atencao || '').toUpperCase())}</p>

            <div class="doc-items">
              ${itensMarkup}
            </div>

            <div class="doc-total">
              <span>TOTAL</span>
              <span>${window.AppUtils.formatCurrencyBRL(data.total)}</span>
            </div>

            <div class="doc-condicoes">
              <strong>FORMA DE PAGAMENTO:</strong>
              ${window.AppUtils.escapeHtml(data.forma_pagamento)}
              ${window.AppUtils.escapeHtml(data.validade)}
            </div>

            <div class="doc-footer">
              OMINI SISTEMAS INTEGRADOS<br />
              RUA AMARAJI, 372 - BAIRRO SÃO GABRIEL<br />
              BELO HORIZONTE - MG<br />
              TEL.: 99997-6648
            </div>
          </div>
        </div>

        <div class="btn-row">
          <button class="btn btn-primary" id="btn-preview-pdf">⬇ Baixar PDF</button>
          <button class="btn btn-secondary" id="btn-preview-share">↗ Compartilhar</button>
          <button class="btn btn-ghost" data-close>Fechar</button>
        </div>
      </div>
    `;
  }

  function sanitizeFileName(title) {
    const normalized = String(title || 'orcamento')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    return normalized || 'orcamento';
  }

async function baixarPreviewPdf(data, triggerButton) {
    window.AppUtils.setButtonLoading(triggerButton, true, 'Gerando PDF...');

    try {
      // Busca logo em base64
      let logoSrc = '/img/logo.png';
      try {
        const imgResponse = await fetch('/img/logo.png');
        const blob = await imgResponse.blob();
        logoSrc = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch (e) {}

      const itensMarkup = data.itens.length
        ? data.itens.map(item => `
            <div style="display:flex;gap:10px;font-size:13px;text-transform:uppercase;margin-bottom:6px;">
              <span style="width:38px;font-weight:bold;">${item.quantidade}</span>
              <span>${item.descricao.toUpperCase()}</span>
            </div>`).join('')
        : '<p>SEM ITENS</p>';

      const janela = window.open('', '_blank');
      janela.document.write(`<!DOCTYPE html>
        <html><head>
          <meta charset="UTF-8">
          <title>Orçamento - ${data.titulo}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background: white; font-family: Arial, sans-serif; }
            .doc { width: 100%; max-width: 794px; margin: 0 auto; padding: 42px 34px; color: #111; }
            @media print { body { margin: 0; } @page { margin: 10mm; size: A4; } }
          </style>
        </head><body>
          <div class="doc">
            <img src="${logoSrc}" style="height:100px;width:auto;margin-bottom:16px;display:block;" />
            <h2 style="text-align:center;font-size:18px;letter-spacing:1px;margin-bottom:24px;">ORÇAMENTO</h2>
            <p style="text-transform:uppercase;font-size:13px;margin-bottom:5px;font-weight:bold;">${data.titulo.toUpperCase()}</p>
            <p style="text-transform:uppercase;font-size:13px;margin-bottom:5px;font-weight:bold;">${data.cliente_nome.toUpperCase()}</p>
            <p style="text-transform:uppercase;font-size:13px;margin-bottom:5px;font-weight:bold;">${data.local_data.toUpperCase()}</p>
            <p style="text-transform:uppercase;font-size:13px;margin-bottom:20px;font-weight:bold;">AC. ${(data.atencao || '').toUpperCase()}</p>
            <div style="margin-bottom:20px;">${itensMarkup}</div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid #444;border-bottom:1px solid #444;padding:10px 0;margin-bottom:18px;font-weight:bold;font-size:14px;">
              <span>TOTAL</span>
              <span>${window.AppUtils.formatCurrencyBRL(data.total)}</span>
            </div>
            <div style="font-size:12px;margin-bottom:24px;">
              <strong>FORMA DE PAGAMENTO:</strong><br>
              ${data.forma_pagamento}<br>
              ${data.validade}
            </div>
            <div style="border-top:1px solid #666;padding-top:12px;text-align:center;font-size:11px;line-height:1.6;text-transform:uppercase;">
              OMINI SISTEMAS INTEGRADOS<br>
              RUA AMARAJI, 372 - BAIRRO SÃO GABRIEL<br>
              BELO HORIZONTE - MG<br>
              TEL.: 99997-6648
            </div>
          </div>
          <script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
        </body></html>`);
      janela.document.close();
      window.AppUtils.showToast('Use "Salvar como PDF" na janela de impressão.', 'success');
    } catch (error) {
      window.AppUtils.showToast(error.message || 'Erro ao gerar PDF.', 'error');
    } finally {
      window.AppUtils.setButtonLoading(triggerButton, false);
    }
  }

  async function compartilharPreview(data, triggerButton) {
    window.AppUtils.setButtonLoading(triggerButton, true, 'Preparando...');

    try {
      const itensTexto = data.itens.map(item => `• ${item.quantidade} ${item.descricao}`).join('\n');

      const mensagem = `
*ORÇAMENTO - OMINI SISTEMAS INTEGRADOS*

*Serviço:* ${data.titulo.toUpperCase()}
*Cliente:* ${data.cliente_nome.toUpperCase()}
*Data:* ${data.local_data.toUpperCase()}
*AC.:* ${(data.atencao || '').toUpperCase()}

*ITENS:*
${itensTexto}

*TOTAL: ${window.AppUtils.formatCurrencyBRL(data.total)}*

*Forma de Pagamento:* ${data.forma_pagamento}
${data.validade}

_OMINI SISTEMAS INTEGRADOS_
_Rua Amaraji, 372 – São Gabriel, BH/MG_
_Tel.: 99997-6648_
      `.trim();

      // Gera o PDF primeiro
      let logoSrc = '/img/logo.png';
      try {
        const imgResponse = await fetch('/img/logo.png');
        const blob = await imgResponse.blob();
        logoSrc = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch (e) {}

      const itensMarkup = data.itens.map(item => `
        <div style="display:flex;gap:10px;font-size:13px;text-transform:uppercase;margin-bottom:6px;">
          <span style="width:38px;font-weight:bold;">${item.quantidade}</span>
          <span>${item.descricao.toUpperCase()}</span>
        </div>`).join('');

      const janela = window.open('', '_blank');
      janela.document.write(`<!DOCTYPE html>
        <html><head>
          <meta charset="UTF-8">
          <title>Orçamento - ${data.titulo}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background: white; font-family: Arial, sans-serif; }
            .doc { width: 100%; max-width: 794px; margin: 0 auto; padding: 42px 34px; color: #111; }
            @media print { body { margin: 0; } @page { margin: 10mm; size: A4; } }
          </style>
        </head><body>
          <div class="doc">
            <img src="${logoSrc}" style="height:100px;width:auto;margin-bottom:16px;display:block;" />
            <h2 style="text-align:center;font-size:18px;letter-spacing:1px;margin-bottom:24px;">ORÇAMENTO</h2>
            <p style="text-transform:uppercase;font-size:13px;margin-bottom:5px;font-weight:bold;">${data.titulo.toUpperCase()}</p>
            <p style="text-transform:uppercase;font-size:13px;margin-bottom:5px;font-weight:bold;">${data.cliente_nome.toUpperCase()}</p>
            <p style="text-transform:uppercase;font-size:13px;margin-bottom:5px;font-weight:bold;">${data.local_data.toUpperCase()}</p>
            <p style="text-transform:uppercase;font-size:13px;margin-bottom:20px;font-weight:bold;">AC. ${(data.atencao || '').toUpperCase()}</p>
            <div style="margin-bottom:20px;">${itensMarkup}</div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid #444;border-bottom:1px solid #444;padding:10px 0;margin-bottom:18px;font-weight:bold;font-size:14px;">
              <span>TOTAL</span>
              <span>${window.AppUtils.formatCurrencyBRL(data.total)}</span>
            </div>
            <div style="font-size:12px;margin-bottom:24px;">
              <strong>FORMA DE PAGAMENTO:</strong><br>
              ${data.forma_pagamento}<br>
              ${data.validade}
            </div>
            <div style="border-top:1px solid #666;padding-top:12px;text-align:center;font-size:11px;line-height:1.6;text-transform:uppercase;">
              OMINI SISTEMAS INTEGRADOS<br>
              RUA AMARAJI, 372 - BAIRRO SÃO GABRIEL<br>
              BELO HORIZONTE - MG<br>
              TEL.: 99997-6648
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 400);
            };
          <\/script>
        </body></html>`);
      janela.document.close();

      // Aguarda 1 segundo e abre o WhatsApp
      await new Promise(resolve => setTimeout(resolve, 1000));
      const urlWhatsApp = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
      window.open(urlWhatsApp, '_blank');

      window.AppUtils.showToast('Salve o PDF e envie pelo WhatsApp!', 'success');
    } catch (error) {
      window.AppUtils.showToast(error.message || 'Erro ao compartilhar.', 'error');
    } finally {
      window.AppUtils.setButtonLoading(triggerButton, false);
    }
  }

  function abrirPreviewOrcamento(data) {
    const normalizado = normalizePreviewData(data);

    window.AppUtils.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Preview do Orçamento</h3>
        <button class="btn btn-ghost btn-small" data-close>Fechar</button>
      </div>
      ${previewDocumentMarkup(normalizado)}
    `);

    const btnPdf = document.getElementById('btn-preview-pdf');
    const btnShare = document.getElementById('btn-preview-share');

    if (btnPdf) {
      btnPdf.addEventListener('click', () => baixarPreviewPdf(normalizado, btnPdf));
    }

    if (btnShare) {
      btnShare.addEventListener('click', () => compartilharPreview(normalizado, btnShare));
    }
  }

  async function alterarStatusOrcamento(id, status, triggerButton) {
    window.AppUtils.setButtonLoading(triggerButton, true, 'Atualizando...');

    try {
      const response = await window.OrcamentosAPI.atualizarStatus(id, status);
      if (response.error) {
        throw new Error(response.error);
      }

      state.orcamentos = state.orcamentos.map((item) =>
        item.id === id ? { ...item, status } : item
      );

      if (state.detalhesCache[id]) {
        state.detalhesCache[id].status = status;
      }

      window.AppUtils.showToast('Status atualizado com sucesso.', 'success');
      window.AppUtils.closeModal();
      await window.AppRouter.renderCurrentRoute();
    } catch (error) {
      window.AppUtils.showToast(error.message || 'Erro ao atualizar status.', 'error');
    } finally {
      window.AppUtils.setButtonLoading(triggerButton, false);
    }
  }

  async function excluirOrcamento(id, triggerButton) {
    const confirmado = await window.AppUtils.confirmAction(
      'Tem certeza? Esta ação não pode ser desfeita.',
      'Excluir'
    );

    if (!confirmado) {
      return;
    }

    window.AppUtils.setButtonLoading(triggerButton, true, 'Excluindo...');

    try {
      const response = await window.OrcamentosAPI.excluir(id);
      if (response.error) {
        throw new Error(response.error);
      }

      delete state.detalhesCache[id];
      state.orcamentos = state.orcamentos.filter((item) => item.id !== id);

      window.AppUtils.showToast('Orçamento excluído com sucesso.', 'success');
      window.AppUtils.closeModal();
      await window.AppRouter.renderCurrentRoute();
    } catch (error) {
      window.AppUtils.showToast(error.message || 'Erro ao excluir orçamento.', 'error');
    } finally {
      window.AppUtils.setButtonLoading(triggerButton, false);
    }
  }

  function detailsItensMarkup(itens) {
    if (!itens.length) {
      return '<p class="muted-text">Nenhum item cadastrado neste orçamento.</p>';
    }

    return `
      <div class="list-stack">
        ${itens
          .map(
            (item) => `
              <div class="card">
                <div class="detail-row">
                  <strong>Qtd.</strong>
                  <span>${window.AppUtils.escapeHtml(item.quantidade || '01')}</span>
                </div>
                <p class="orcamento-sub" style="margin-top:8px;">${window.AppUtils.escapeHtml(
                  item.descricao
                )}</p>
                <p class="orcamento-total" style="margin-top:6px;">${window.AppUtils.formatCurrencyBRL(
                  item.valor || 0
                )}</p>
              </div>
            `
          )
          .join('')}
      </div>
    `;
  }

  async function abrirDetalhesOrcamento(id) {
    try {
      const response = await window.OrcamentosAPI.buscar(id);
      if (response.error) {
        throw new Error(response.error);
      }

      const data = response.data;
      state.detalhesCache[id] = data;

      const cliente = getClienteNome(data);
      const itens = extractItens(data);
      const numero = data.numero ? `OMI-${new Date(data.criado_em).getFullYear()}-${String(data.numero).padStart(4,'0')}` : '--';
      window.AppUtils.showModal(`
        <div class="modal-header">
          <h3 class="modal-title">Detalhes do Orçamento</h3>
          <button class="btn btn-ghost btn-small" data-close>Fechar</button>
        </div>

        <div class="detail-grid">
          <div class="detail-row">
            <strong>Nº Orçamento</strong>
            <span style="font-family:'IBM Plex Mono',monospace;color:var(--accent);">${numero}</span>
          </div>
          <div class="detail-row">
            <strong>Título</strong>
            <span>${window.AppUtils.escapeHtml(data.titulo || 'Sem título')}</span>
          </div>
          <div class="detail-row">
            <strong>Cliente</strong>
            <span>${window.AppUtils.escapeHtml(cliente)}</span>
          </div>
          <div class="detail-row">
            <strong>Local / Data</strong>
            <span>${window.AppUtils.escapeHtml(data.local_data || '--')}</span>
          </div>
          <div class="detail-row">
            <strong>Total</strong>
            <span>${window.AppUtils.formatCurrencyBRL(data.total || 0)}</span>
          </div>
          <div class="detail-row">
            <strong>Status</strong>
            <span>${buildStatusBadge(data.status || 'pendente')}</span>
          </div>
        </div>

        <div style="margin-top: 12px; margin-bottom: 12px;">
          <h4 class="section-title" style="font-size:0.92rem;">Itens</h4>
          ${detailsItensMarkup(itens)}
        </div>

        <h4 class="section-title" style="font-size:0.92rem;">Mudar Status</h4>
        <div class="status-actions" style="margin:10px 0 12px;">
          <button class="btn btn-secondary btn-small" data-status-change="pendente">Pendente</button>
          <button class="btn btn-success btn-small" data-status-change="aprovado">Aprovado</button>
          <button class="btn btn-danger btn-small" data-status-change="recusado">Recusado</button>
        </div>

        <div class="btn-row">
          <button class="btn btn-secondary" id="btn-detalhe-editar">Editar</button>
          <button class="btn btn-primary" id="btn-detalhe-pdf">PDF</button>
          <button class="btn btn-danger" id="btn-detalhe-excluir">Excluir</button>
        </div>
      `);

      const btnEditar = document.getElementById('btn-detalhe-editar');
      const btnPdf = document.getElementById('btn-detalhe-pdf');
      const btnExcluir = document.getElementById('btn-detalhe-excluir');

      if (btnEditar) {
        btnEditar.addEventListener('click', () => {
          window.AppUtils.closeModal();
          window.AppRouter.goTo(`#/editar/${id}`);
        });
      }

      if (btnPdf) {
        btnPdf.addEventListener('click', () => {
          abrirPreviewOrcamento(data);
        });
      }

      if (btnExcluir) {
        btnExcluir.addEventListener('click', () => {
          excluirOrcamento(id, btnExcluir);
        });
      }

      document.querySelectorAll('[data-status-change]').forEach((button) => {
        button.addEventListener('click', () => {
          alterarStatusOrcamento(id, button.dataset.statusChange, button);
        });
      });
    } catch (error) {
      window.AppUtils.showToast(error.message || 'Erro ao abrir detalhes do orçamento.', 'error');
    }
  }

  function itemRowHtml(item, ordem) {
    return `
      <div class="item-row" data-item-row data-ordem="${ordem}">
        <input
          class="input item-qtd"
          name="item_qtd"
          placeholder="Qtd"
          value="${window.AppUtils.escapeHtml(item.quantidade || '01')}"
        />
        <input
          class="input item-descricao"
          name="item_descricao"
          placeholder="Descrição do item"
          value="${window.AppUtils.escapeHtml(item.descricao || '')}"
        />
        <input
          class="input item-valor"
          name="item_valor"
          placeholder="Valor"
          inputmode="decimal"
          value="${window.AppUtils.escapeHtml(
            item.valor !== null && item.valor !== undefined && item.valor !== ''
              ? Number(item.valor).toFixed(2)
              : ''
          )}"
        />
        <button type="button" class="item-remove" data-remove-item aria-label="Remover item">×</button>
      </div>
    `;
  }

  function getItensFromForm(form) {
    const rows = Array.from(form.querySelectorAll('[data-item-row]'));

    return rows
      .map((row, index) => {
        const qtd = row.querySelector('.item-qtd')?.value.trim() || '01';
        const descricao = row.querySelector('.item-descricao')?.value.trim() || '';
        const valorRaw = row.querySelector('.item-valor')?.value || '';

        return {
          descricao,
          quantidade: qtd || '01',
          valor: valorRaw ? parseNumber(valorRaw) : null,
          ordem: index
        };
      })
      .filter((item) => item.descricao);
  }

  function updateItensOrder(form) {
    const rows = Array.from(form.querySelectorAll('[data-item-row]'));
    rows.forEach((row, index) => {
      row.dataset.ordem = String(index);
    });
  }

  function updateTotalDisplay(form) {
    const totalInput = form.querySelector('#total');
    const totalVisor = form.querySelector('#total-formatado');
    if (!totalInput || !totalVisor) {
      return;
    }

    const value = parseNumber(totalInput.value || 0);
    totalVisor.textContent = window.AppUtils.formatCurrencyBRL(value);
  }

  function recalculateTotalByItens(form) {
    const itens = getItensFromForm(form);
    const soma = itens.reduce((acc, item) => acc + parseNumber(item.valor), 0);

    const totalInput = form.querySelector('#total');
    if (totalInput) {
      totalInput.value = soma.toFixed(2);
    }

    updateTotalDisplay(form);
  }

  function extractCidadeFromLocalData(localData) {
    if (!localData) {
      return '';
    }

    const split = String(localData).split(',');
    return split[0] ? split[0].trim() : '';
  }

  async function resolverClienteId(form) {
    const clienteSelect = form.querySelector('#cliente_id');
    const clienteLivreInput = form.querySelector('#cliente_livre');

    const clienteId = clienteSelect ? clienteSelect.value : '';
    const clienteLivre = clienteLivreInput ? clienteLivreInput.value.trim() : '';

    if (clienteId) {
      return {
        cliente_id: clienteId,
        cliente_nome: clienteSelect.options[clienteSelect.selectedIndex]?.text || ''
      };
    }

    if (!clienteLivre) {
      return { cliente_id: null, cliente_nome: '' };
    }

    const cidade = extractCidadeFromLocalData(form.local_data?.value || '');
    const response = await window.ClientesAPI.criar({
      nome: clienteLivre,
      cidade,
      endereco: '',
      contato: ''
    });

    if (response.error) {
      throw new Error(response.error);
    }

    await carregarClientes(true);

    return {
      cliente_id: response.data.id,
      cliente_nome: response.data.nome
    };
  }

  function collectFormPreviewData(form) {
    const itens = getItensFromForm(form);

    const clienteSelect = form.querySelector('#cliente_id');
    const clienteLivreInput = form.querySelector('#cliente_livre');
    const clienteNomeSelecionado = clienteSelect?.value
      ? clienteSelect.options[clienteSelect.selectedIndex]?.text
      : '';

    return normalizePreviewData({
      titulo: form.titulo.value.trim(),
      cliente_nome: clienteNomeSelecionado || clienteLivreInput?.value.trim() || 'Cliente não informado',
      local_data: form.local_data.value.trim(),
      atencao: form.atencao.value.trim(),
      total: parseNumber(form.total.value || 0),
      forma_pagamento: form.forma_pagamento.value.trim(),
      validade: form.validade.value.trim(),
      itens
    });
  }

  function bindFormEvents(form, editingId) {
    const itensList = form.querySelector('#itens-list');
    const addItemBtn = form.querySelector('#btn-add-item');
    const previewBtn = form.querySelector('#btn-preview-orcamento');
    const totalInput = form.querySelector('#total');

    if (addItemBtn && itensList) {
      addItemBtn.addEventListener('click', () => {
        itensList.insertAdjacentHTML('beforeend', itemRowHtml({}, itensList.children.length));
        updateItensOrder(form);
      });
    }

    if (itensList) {
      itensList.addEventListener('click', (event) => {
        const removeButton = event.target.closest('[data-remove-item]');
        if (!removeButton) {
          return;
        }

        const rows = itensList.querySelectorAll('[data-item-row]');
        if (rows.length <= 1) {
          window.AppUtils.showToast('Pelo menos um item deve permanecer no orçamento.', 'warning');
          return;
        }

        removeButton.closest('[data-item-row]')?.remove();
        updateItensOrder(form);
        recalculateTotalByItens(form);
      });

      itensList.addEventListener('input', (event) => {
        if (event.target.classList.contains('item-valor')) {
          recalculateTotalByItens(form);
        }
      });
    }

    if (totalInput) {
      totalInput.addEventListener('input', () => updateTotalDisplay(form));
      updateTotalDisplay(form);
    }

    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        const data = collectFormPreviewData(form);

        if (!data.titulo) {
          window.AppUtils.showToast('Preencha o título antes de gerar o preview.', 'warning');
          return;
        }

        if (!data.itens.length) {
          window.AppUtils.showToast('Adicione ao menos um item para visualizar o preview.', 'warning');
          return;
        }

        abrirPreviewOrcamento(data);
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const submitButton = form.querySelector('#btn-salvar-orcamento');
      window.AppUtils.setButtonLoading(submitButton, true, 'Salvando...');

      try {
        const titulo = form.titulo.value.trim();
        if (!titulo) {
          throw new Error('Informe o título do orçamento.');
        }

        const itens = getItensFromForm(form);
        if (!itens.length) {
          throw new Error('Adicione ao menos um item com descrição.');
        }

        const cliente = await resolverClienteId(form);
        if (!cliente.cliente_id) {
          throw new Error('Selecione um cliente cadastrado ou informe um cliente livre.');
        }

        const payload = {
          cliente_id: cliente.cliente_id,
          titulo,
          local_data: form.local_data.value.trim() || defaultLocalData(),
          atencao: form.atencao.value.trim(),
          total: parseNumber(form.total.value || 0),
          forma_pagamento: form.forma_pagamento.value.trim() || FORMA_PAGAMENTO_PADRAO,
          validade: form.validade.value.trim() || VALIDADE_PADRAO,
          itens
        };

        const response = editingId
          ? await window.OrcamentosAPI.editar(editingId, payload)
          : await window.OrcamentosAPI.criar(payload);

        if (response.error) {
          throw new Error(response.error);
        }

        window.AppUtils.showToast(
          editingId ? 'Orçamento atualizado com sucesso.' : 'Orçamento criado com sucesso.',
          'success'
        );

        state.orcamentos = [];
        window.AppRouter.goTo('#/orcamentos');
      } catch (error) {
        window.AppUtils.showToast(error.message || 'Erro ao salvar orçamento.', 'error');
      } finally {
        window.AppUtils.setButtonLoading(submitButton, false);
      }
    });
  }

  function clienteOptionsMarkup(selectedId) {
    const options = state.clientes
      .map(
        (cliente) =>
          `<option value="${cliente.id}" ${
            selectedId && selectedId === cliente.id ? 'selected' : ''
          }>${window.AppUtils.escapeHtml(cliente.nome)}</option>`
      )
      .join('');

    return `<option value="">Selecione um cliente...</option>${options}`;
  }

  async function carregarDadosEdicao(id) {
    const response = await window.OrcamentosAPI.buscar(id);
    if (response.error) {
      throw new Error(response.error);
    }

    return response.data;
  }

  async function renderFormOrcamento(options) {
    const editingId = options?.id || null;
    const container = document.getElementById('view-container');
    if (!container) {
      return;
    }

    container.innerHTML = `
      <section class="view-section">
        <div class="empty-state">Carregando formulário...</div>
      </section>
    `;

    try {
      await carregarClientes(true);

      let dadosEdicao = null;
      if (editingId) {
        dadosEdicao = await carregarDadosEdicao(editingId);
      }

      const clienteSelecionado = dadosEdicao?.cliente_id || '';
      const clienteLivre =
        !clienteSelecionado && dadosEdicao ? getClienteNome(dadosEdicao).replace('Cliente não informado', '') : '';

      const itens =
        dadosEdicao && extractItens(dadosEdicao).length
          ? extractItens(dadosEdicao)
          : [{ quantidade: '01', descricao: '', valor: null, ordem: 0 }];

      const totalInicial = dadosEdicao
        ? parseNumber(dadosEdicao.total)
        : itens.reduce((acc, item) => acc + parseNumber(item.valor), 0);

      const localDataInicial =
        dadosEdicao?.local_data || defaultLocalData(dadosEdicao ? getCidadeCliente(dadosEdicao) : 'Belo Horizonte');

      container.innerHTML = `
        <section class="view-section">
          <form id="orcamento-form" class="form-shell">
            <div class="form-section">
              <h2 class="form-legend">1. Dados do Serviço</h2>
              <div class="form-group">
                <label for="titulo">Título do orçamento *</label>
                <input
                  class="input"
                  id="titulo"
                  name="titulo"
                  value="${window.AppUtils.escapeHtml(dadosEdicao?.titulo || '')}"
                  placeholder="Ex.: Instalação de sistema CFTV"
                  required
                />
              </div>
            </div>

            <div class="form-section">
              <h2 class="form-legend">2. Cliente</h2>
              <div class="form-group">
                <label for="cliente_id">Cliente cadastrado</label>
                <select class="select" id="cliente_id" name="cliente_id">
                  ${clienteOptionsMarkup(clienteSelecionado)}
                </select>
              </div>
              <div class="form-group">
                <label for="cliente_livre">Ou cliente livre</label>
                <input
                  class="input"
                  id="cliente_livre"
                  name="cliente_livre"
                  value="${window.AppUtils.escapeHtml(clienteLivre)}"
                  placeholder="Digite um nome de cliente"
                />
              </div>
            </div>

            <div class="form-section">
              <h2 class="form-legend">3. Local e Data</h2>
              <div class="form-group">
                <label for="local_data">Local e data</label>
                <input
                  class="input"
                  id="local_data"
                  name="local_data"
                  value="${window.AppUtils.escapeHtml(localDataInicial)}"
                  placeholder="BELO HORIZONTE, ${window.AppUtils.todayPTBR()}"
                />
              </div>
            </div>

            <div class="form-section">
              <h2 class="form-legend">4. Atenção (AC.)</h2>
              <div class="form-group">
                <label for="atencao">Responsável</label>
                <input
                  class="input"
                  id="atencao"
                  name="atencao"
                  value="${window.AppUtils.escapeHtml(dadosEdicao?.atencao || '')}"
                  placeholder="Nome do responsável"
                />
              </div>
            </div>

            <div class="form-section">
              <h2 class="form-legend">5. Itens</h2>
              <div id="itens-list" class="items-list">
                ${itens.map((item, index) => itemRowHtml(item, index)).join('')}
              </div>
              <button type="button" id="btn-add-item" class="btn btn-secondary">+ Adicionar Item</button>
            </div>

            <div class="form-section">
              <h2 class="form-legend">6. Total</h2>
              <div class="form-group">
                <label for="total">Valor total</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  class="input"
                  id="total"
                  name="total"
                  value="${Number(totalInicial || 0).toFixed(2)}"
                />
              </div>
              <div class="total-line">
                <span class="muted-text">Total formatado:</span>
                <strong id="total-formatado" class="total-display">${window.AppUtils.formatCurrencyBRL(
                  totalInicial
                )}</strong>
              </div>
            </div>

            <div class="form-section">
              <h2 class="form-legend">7. Condições</h2>
              <div class="form-group">
                <label for="forma_pagamento">Forma de pagamento</label>
                <textarea class="textarea" id="forma_pagamento" name="forma_pagamento">${window.AppUtils.escapeHtml(
                  dadosEdicao?.forma_pagamento || FORMA_PAGAMENTO_PADRAO
                )}</textarea>
              </div>
              <div class="form-group">
                <label for="validade">Validade</label>
                <input
                  class="input"
                  id="validade"
                  name="validade"
                  value="${window.AppUtils.escapeHtml(dadosEdicao?.validade || VALIDADE_PADRAO)}"
                />
              </div>
            </div>

            <div class="btn-row">
              <button type="submit" id="btn-salvar-orcamento" class="btn btn-primary">Salvar Orçamento</button>
              <button type="button" id="btn-preview-orcamento" class="btn btn-secondary">Ver Preview</button>
            </div>
          </form>
        </section>
      `;

      const form = document.getElementById('orcamento-form');
      if (form) {
        // Registra listeners de itens dinâmicos, preview e submit.
        bindFormEvents(form, editingId);
      }
    } catch (error) {
      container.innerHTML = `
        <section class="view-section">
          <div class="empty-state">
            Não foi possível carregar o formulário no momento.
          </div>
        </section>
      `;
      window.AppUtils.showToast(error.message || 'Erro ao montar formulário.', 'error');
    }
  }

  window.OrcamentoUI = {
    renderDashboard,
    renderListaOrcamentos,
    renderFormOrcamento,
    abrirPreviewOrcamento
  };
})();
