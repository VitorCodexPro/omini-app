(function initApplication() {
  const LOGO_OMINI = `
    <svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="30" r="27" stroke="currentColor" stroke-width="3" fill="none"/>
      <circle cx="30" cy="30" r="14" stroke="currentColor" stroke-width="2.5" fill="none"/>
      <circle cx="30" cy="30" r="4" fill="currentColor"/>
      <text x="65" y="26" font-family="Arial" font-weight="bold" font-size="16"
            fill="currentColor" letter-spacing="1">OMINI</text>
      <text x="65" y="40" font-family="Arial" font-size="8"
            fill="currentColor" letter-spacing="1" opacity="0.6">SISTEMAS INTEGRADOS</text>
    </svg>
  `;

  const statusMeta = {
    pendente: { label: 'Pendente', color: 'warning' },
    aprovado: { label: 'Aprovado', color: 'success' },
    recusado: { label: 'Recusado', color: 'danger' },
    pago: { label: 'Pago', color: 'aprovado' }
  };

  const AppState = {
    currentRoute: '#/',
    // Callback opcional para finalizar fluxos que dependem do fechamento do modal.
    onModalClose: null
  };

  function logoSvg() {
    return LOGO_OMINI;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatCurrencyBRL(value) {
    const numeric = Number(value || 0);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number.isFinite(numeric) ? numeric : 0);
  }

  function formatDatePTBR(value) {
    if (!value) {
      return '--';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat('pt-BR').format(date);
  }

  function todayPTBR() {
    return formatDatePTBR(new Date());
  }

  function normalizeMoneyInput(value) {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value !== 'string') {
      return 0;
    }

    const cleaned = value.trim().replace(/\s+/g, '');
    if (!cleaned) {
      return 0;
    }

    let normalized = cleaned;
    if (normalized.includes(',') && normalized.includes('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else if (normalized.includes(',')) {
      normalized = normalized.replace(',', '.');
    }

    normalized = normalized.replace(/[^0-9.-]/g, '');

    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function getStatusMeta(status) {
    return statusMeta[status] || { label: 'Desconhecido', color: 'warning' };
  }

  function renderSkeletonCards(quantity) {
    const cards = Array.from({ length: quantity || 3 })
      .map(
        () => `
          <div class="skeleton-card">
            <div class="skeleton-line" style="width: 55%;"></div>
            <div class="skeleton-line" style="width: 95%;"></div>
            <div class="skeleton-line" style="width: 70%;"></div>
          </div>
        `
      )
      .join('');

    return `<div class="skeleton">${cards}</div>`;
  }

  function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) {
      return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type || 'success'}`;
    toast.textContent = message;
    container.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  function closeModal() {
    const container = document.getElementById('modal-container');
    if (!container) {
      return;
    }

    if (typeof AppState.onModalClose === 'function') {
      const onClose = AppState.onModalClose;
      AppState.onModalClose = null;
      onClose();
    }

    container.classList.remove('active');
    container.innerHTML = '';
  }

  function showModal(contentHtml, options) {
    const container = document.getElementById('modal-container');
    if (!container) {
      return null;
    }

    const closeOnOverlay = options?.closeOnOverlay !== false;

    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-sheet">${contentHtml}</div>
      </div>
    `;
    container.classList.add('active');

    const overlay = container.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (event) => {
        if (closeOnOverlay && event.target === overlay) {
          closeModal();
        }
      });
    }

    container.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', () => closeModal());
    });

    return container;
  }

  function setButtonLoading(button, isLoading, loadingText) {
    if (!button) {
      return;
    }

    if (isLoading) {
      if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
      }
      button.disabled = true;
      button.innerHTML = `<span class="btn-spinner"></span>${escapeHtml(loadingText || 'Processando...')}`;
      return;
    }

    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }

  function confirmAction(message, confirmLabel) {
    return new Promise((resolve) => {
      const modalId = `confirm-${Date.now()}`;
      let settled = false;

      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        AppState.onModalClose = null;
        closeModal();
        resolve(value);
      };

      showModal(
        `
        <div class="modal-header">
          <h3 class="modal-title">Confirmação</h3>
          <button class="btn btn-ghost btn-small" id="${modalId}-fechar">Fechar</button>
        </div>
        <p class="muted-text" style="margin-bottom: 14px;">${escapeHtml(message)}</p>
        <div class="btn-row">
          <button class="btn btn-secondary" id="${modalId}-cancelar">Cancelar</button>
          <button class="btn btn-danger" id="${modalId}-confirmar">${escapeHtml(
            confirmLabel || 'Confirmar'
          )}</button>
        </div>
      `,
        { closeOnOverlay: false }
      );

      AppState.onModalClose = () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      };

      const close = document.getElementById(`${modalId}-fechar`);
      const cancel = document.getElementById(`${modalId}-cancelar`);
      const confirm = document.getElementById(`${modalId}-confirmar`);

      if (close) {
        close.addEventListener('click', () => finish(false));
      }

      if (cancel) {
        cancel.addEventListener('click', () => finish(false));
      }

      if (confirm) {
        confirm.addEventListener('click', () => finish(true));
      }
    });
  }

  function setScreenTitle(title) {
    const target = document.getElementById('screen-title');
    if (target) {
      target.textContent = title;
    }
  }

  function normalizeHash(hash) {
    if (!hash || hash === '#') {
      return '#/';
    }

    if (!hash.startsWith('#')) {
      return `#/${hash.replace(/^\//, '')}`;
    }

    return hash;
  }

  function matchRoute(hash) {
    const route = normalizeHash(hash);

    if (route === '#/') {
      return {
        key: '#/',
        title: 'Início',
        navKey: '#/',
        handler: () => window.OrcamentoUI.renderDashboard(),
        params: {}
      };
    }

    if (route === '#/orcamentos') {
      return {
        key: '#/orcamentos',
        title: 'Orçamentos',
        navKey: '#/orcamentos',
        handler: () => window.OrcamentoUI.renderListaOrcamentos(),
        params: {}
      };
    }

    if (route === '#/novo') {
      return {
        key: '#/novo',
        title: 'Novo Orçamento',
        navKey: '#/novo',
        handler: () => window.OrcamentoUI.renderFormOrcamento(),
        params: {}
      };
    }

    const editMatch = route.match(/^#\/editar\/([^/]+)$/);
    if (editMatch) {
      return {
        key: '#/editar/:id',
        title: 'Editar Orçamento',
        navKey: '#/novo',
        handler: () => window.OrcamentoUI.renderFormOrcamento({ id: editMatch[1] }),
        params: { id: editMatch[1] }
      };
    }

    if (route === '#/clientes') {
      return {
        key: '#/clientes',
        title: 'Clientes',
        navKey: '#/clientes',
        handler: () => window.ClientesUI.renderClientesView(),
        params: {}
      };
    }

    if (route === '#/rotas') {
      return {
        key: '#/rotas',
        title: 'Rotas',
        navKey: '#/rotas',
        handler: () => window.RotasUI.renderRotasView(),
        params: {}
      };
    }

    if (route === '#/pagos') {
      return {
        key: '#/pagos',
        title: 'Orçamentos Pagos',
        navKey: '#/pagos',
        handler: () => window.OrcamentoUI.renderOrcamentosPagos(),
        params: {}
      };
    }

    if (route === '#/arquivados') {
      return {
        key: '#/arquivados',
        title: 'Orçamentos Arquivados',
        navKey: '#/arquivados',
        handler: () => window.OrcamentoUI.renderOrcamentosArquivados(),
        params: {}
      };
    }

    if (route === '#/caixa') {
      return {
        key: '#/caixa',
        title: 'Caixa',
        navKey: '#/caixa',
        handler: () => window.CaixaUI.renderCaixaView(),
        params: {}
      };
    }

    if (route === '#/recibos') {
      return {
        key: '#/recibos',
        title: 'Recibos',
        navKey: '#/recibos',
        handler: () => window.RecibosUI.renderRecibosView(),
        params: {}
      };
    }

    return null;
  }

  function setActiveNavigation(navKey) {
    document.querySelectorAll('#side-menu .nav-item').forEach((item) => {
      if (item.dataset.nav === navKey) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  async function renderCurrentRoute() {
    const routeMatch = matchRoute(window.location.hash);

    if (!routeMatch) {
      window.location.hash = '#/';
      return;
    }

    AppState.currentRoute = routeMatch.key;
    setScreenTitle(routeMatch.title);
    setActiveNavigation(routeMatch.navKey);

    try {
      await routeMatch.handler(routeMatch.params);
    } catch (error) {
      const container = document.getElementById('view-container');
      if (container) {
        container.innerHTML = `
          <section class="view-section">
            <div class="empty-state">
              Ocorreu um erro ao carregar a tela. Tente novamente em instantes.
            </div>
          </section>
        `;
      }
      showToast(error.message || 'Falha ao renderizar a tela.', 'error');
    }
  }

  function goTo(route) {
    window.location.hash = route;
  }

  function initialize() {
    if (!window.location.hash) {
      window.location.hash = '#/';
    }

    window.addEventListener('hashchange', renderCurrentRoute);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    });

    // Splash screen
    const splash = document.getElementById('splash-screen');
    if (splash) {
      setTimeout(() => {
        splash.classList.add('hide');
        setTimeout(() => splash.remove(), 400);
      }, 1200);
    }

    renderCurrentRoute();
  }

  window.AppState = AppState;
  window.AppRouter = {
    goTo,
    renderCurrentRoute
  };

  window.AppUtils = {
    logoSvg,
    escapeHtml,
    formatCurrencyBRL,
    formatDatePTBR,
    todayPTBR,
    normalizeMoneyInput,
    getStatusMeta,
    renderSkeletonCards,
    showToast,
    showModal,
    closeModal,
    confirmAction,
    setButtonLoading
  };

  window.showToast = showToast;
  window.showModal = showModal;
  window.closeModal = closeModal;

  window.addEventListener('DOMContentLoaded', initialize);
})();
