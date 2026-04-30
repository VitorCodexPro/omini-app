(function initClientesUI() {
  // Estado local da tela de clientes para evitar chamadas repetidas desnecessárias.
  const state = {
    clientes: []
  };

  function renderClienteCard(cliente) {
    const endereco = cliente.endereco || 'Endereço não informado';
    const cidade = cliente.cidade || 'Cidade não informada';
    const contato = cliente.contato || 'Contato não informado';

    return `
      <article class="card">
        <div class="orcamento-head">
          <div>
            <h3 class="orcamento-title">${window.AppUtils.escapeHtml(cliente.nome)}</h3>
            <p class="orcamento-sub">${window.AppUtils.escapeHtml(cidade)}</p>
          </div>
        </div>
        <p class="card-meta">${window.AppUtils.escapeHtml(endereco)}</p>
        <p class="card-meta">${window.AppUtils.escapeHtml(contato)}</p>
        <div class="btn-row">
          <button class="btn btn-secondary btn-small" data-action="editar" data-id="${cliente.id}">
            Editar
          </button>
          <button class="btn btn-danger btn-small" data-action="excluir" data-id="${cliente.id}">
            Excluir
          </button>
        </div>
      </article>
    `;
  }

  async function carregarClientes() {
    const response = await window.ClientesAPI.listar();
    if (response.error) {
      throw new Error(response.error);
    }

    state.clientes = Array.isArray(response.data) ? response.data : [];
    return state.clientes;
  }

  function clientePorId(id) {
    return state.clientes.find((item) => item.id === id) || null;
  }

  async function renderListaClientes() {
    const listTarget = document.getElementById('clientes-lista');
    if (!listTarget) {
      return;
    }

    listTarget.innerHTML = window.AppUtils.renderSkeletonCards(4);

    try {
      const clientes = await carregarClientes();

      if (!clientes.length) {
        listTarget.innerHTML = `
          <div class="empty-state">
            Nenhum cliente cadastrado ainda. Use o botão de novo cliente para começar.
          </div>
        `;
        return;
      }

      listTarget.innerHTML = `<div class="list-stack">${clientes.map(renderClienteCard).join('')}</div>`;
    } catch (error) {
      listTarget.innerHTML = `
        <div class="empty-state">
          Não foi possível carregar os clientes agora. Tente novamente.
        </div>
      `;
      window.AppUtils.showToast(error.message || 'Erro ao carregar clientes.', 'error');
    }
  }

  function abrirModalCliente(cliente) {
    // Mesmo modal atende criação e edição, mudando apenas o payload final.
    const isEdit = Boolean(cliente);
    const modalUid = `cliente-form-${Date.now()}`;

    window.AppUtils.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h3>
        <button class="btn btn-ghost btn-small" data-close>Fechar</button>
      </div>

      <form id="${modalUid}" class="form-shell">
        <div class="form-group">
          <label for="cliente-nome">Nome *</label>
          <input class="input" id="cliente-nome" name="nome" value="${window.AppUtils.escapeHtml(
            cliente?.nome || ''
          )}" placeholder="Nome completo" required />
        </div>

        <div class="form-group">
          <label for="cliente-endereco">Endereço</label>
          <input class="input" id="cliente-endereco" name="endereco" value="${window.AppUtils.escapeHtml(
            cliente?.endereco || ''
          )}" placeholder="Rua, número, bairro" />
        </div>

        <div class="form-group">
          <label for="cliente-cidade">Cidade</label>
          <input class="input" id="cliente-cidade" name="cidade" value="${window.AppUtils.escapeHtml(
            cliente?.cidade || ''
          )}" placeholder="Cidade" />
        </div>

        <div class="form-group">
          <label for="cliente-contato">Contato</label>
          <input class="input" id="cliente-contato" name="contato" value="${window.AppUtils.escapeHtml(
            cliente?.contato || ''
          )}" placeholder="Telefone, e-mail ou responsável" />
        </div>

        <div class="btn-row">
          <button type="button" class="btn btn-secondary" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary" id="btn-salvar-cliente">
            ${isEdit ? 'Salvar Alterações' : 'Salvar Cliente'}
          </button>
        </div>
      </form>
    `);

    const form = document.getElementById(modalUid);
    if (!form) {
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const nome = form.nome.value.trim();
      if (!nome) {
        window.AppUtils.showToast('Informe o nome do cliente.', 'warning');
        return;
      }

      const payload = {
        nome,
        endereco: form.endereco.value.trim(),
        cidade: form.cidade.value.trim(),
        contato: form.contato.value.trim()
      };

      const submitButton = form.querySelector('#btn-salvar-cliente');
      window.AppUtils.setButtonLoading(submitButton, true, 'Salvando...');

      try {
        const response = isEdit
          ? await window.ClientesAPI.editar(cliente.id, payload)
          : await window.ClientesAPI.criar(payload);

        if (response.error) {
          throw new Error(response.error);
        }

        window.AppUtils.showToast(
          isEdit ? 'Cliente atualizado com sucesso.' : 'Cliente criado com sucesso.',
          'success'
        );

        window.AppUtils.closeModal();
        await renderListaClientes();
      } catch (error) {
        window.AppUtils.showToast(error.message || 'Falha ao salvar cliente.', 'error');
      } finally {
        window.AppUtils.setButtonLoading(submitButton, false);
      }
    });
  }

  async function excluirCliente(id, triggerButton) {
    const confirmado = await window.AppUtils.confirmAction(
      'Tem certeza? Esta ação não pode ser desfeita.',
      'Excluir'
    );

    if (!confirmado) {
      return;
    }

    window.AppUtils.setButtonLoading(triggerButton, true, 'Excluindo...');

    try {
      const response = await window.ClientesAPI.excluir(id);
      if (response.error) {
        throw new Error(response.error);
      }

      window.AppUtils.showToast('Cliente excluído com sucesso.', 'success');
      await renderListaClientes();
    } catch (error) {
      window.AppUtils.showToast(error.message || 'Erro ao excluir cliente.', 'error');
    } finally {
      window.AppUtils.setButtonLoading(triggerButton, false);
    }
  }

  function bindClientesActions() {
    const addButton = document.getElementById('btn-novo-cliente');
    if (addButton) {
      addButton.addEventListener('click', () => abrirModalCliente(null));
    }

    const listTarget = document.getElementById('clientes-lista');
    if (!listTarget) {
      return;
    }

    listTarget.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-action][data-id]');
      if (!actionButton) {
        return;
      }

      const { action, id } = actionButton.dataset;
      const cliente = clientePorId(id);

      if (!cliente) {
        window.AppUtils.showToast('Cliente não encontrado na lista atual.', 'warning');
        return;
      }

      if (action === 'editar') {
        abrirModalCliente(cliente);
      }

      if (action === 'excluir') {
        excluirCliente(id, actionButton);
      }
    });
  }

  async function renderClientesView() {
    const container = document.getElementById('view-container');
    if (!container) {
      return;
    }

    container.innerHTML = `
      <section class="view-section">
        <div class="section-header">
          <h2 class="section-title">Clientes Cadastrados</h2>
          <button class="btn btn-primary btn-small" id="btn-novo-cliente">+ Novo Cliente</button>
        </div>

        <div id="clientes-lista"></div>
      </section>
    `;

    bindClientesActions();
    await renderListaClientes();
  }

  window.ClientesUI = {
    renderClientesView,
    getCachedClientes: () => state.clientes.slice()
  };
})();
