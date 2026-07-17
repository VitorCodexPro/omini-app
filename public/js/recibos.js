(function initRecibosUI() {

  const RecibosAPI = {
    listar: () => window.API.get('/api/recibos'),
    criar: (data) => window.API.post('/api/recibos', data),
    excluir: (id) => window.API.delete(`/api/recibos?id=${id}`)
  };

  function hoje() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function formatarData(data) {
    if (!data) return '--';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  function formatarNumero(numero) {
    return `REC-${new Date().getFullYear()}-${String(numero).padStart(4,'0')}`;
  }

  async function gerarPDFRecibo(recibo) {
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

    let assinaturaSrc = '/img/assinatura.png';
    try {
      const r = await fetch('/img/assinatura.png');
      const b = await r.blob();
      assinaturaSrc = await new Promise(res => { const fr = new FileReader(); fr.onloadend = () => res(fr.result); fr.readAsDataURL(b); });
    } catch(e) {}

    const janela = window.open('', '_blank');
    janela.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Recibo - ${recibo.cliente_nome}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: white; font-family: Arial, sans-serif; }
.doc { width: 100%; max-width: 794px; margin: 0 auto; padding: 42px 34px; color: #111; position:relative; }
.watermark { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:65%;opacity:0.07;pointer-events:none; }
.content { position:relative;z-index:1; }
.divider { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
.divider-bold { border: none; border-top: 2px solid #111; margin: 20px 0; }
@media print { body { margin:0; } @page { margin:10mm; size:A4; } }
</style>
</head><body>
<div class="doc">
  <img src="${logoWatermark}" class="watermark" />
  <div class="content">
    <img src="${logoSrc}" style="height:80px;width:auto;margin-bottom:20px;display:block;" />
    <h2 style="text-align:center;font-size:20px;letter-spacing:2px;margin-bottom:4px;">RECIBO</h2>
    <p style="text-align:center;font-size:11px;color:#666;margin-bottom:20px;letter-spacing:1px;">Nº ${formatarNumero(recibo.numero)}</p>
    <hr class="divider-bold" />
    <p style="font-size:22px;font-weight:bold;text-align:center;margin:20px 0;">
      ${window.AppUtils.formatCurrencyBRL(recibo.valor)}
    </p>
    <hr class="divider-bold" />
    <table style="width:100%;font-size:13px;margin-top:20px;border-collapse:collapse;">
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px 0;color:#555;width:30%;">Recebi de</td>
        <td style="padding:10px 0;font-weight:bold;text-transform:uppercase;">${recibo.cliente_nome}</td>
      </tr>
      ${recibo.endereco ? `<tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px 0;color:#555;">Endereço</td>
        <td style="padding:10px 0;">${recibo.endereco}</td>
      </tr>` : ''}
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px 0;color:#555;">Referente a</td>
        <td style="padding:10px 0;">${recibo.motivo}</td>
      </tr>
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px 0;color:#555;">Valor</td>
        <td style="padding:10px 0;font-weight:bold;">${window.AppUtils.formatCurrencyBRL(recibo.valor)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#555;">Data</td>
        <td style="padding:10px 0;">${formatarData(recibo.data_recibo)}</td>
      </tr>
    </table>
    <div style="margin-top:30px;text-align:center;">
      <div style="height:60px;position:relative;width:280px;margin:0 auto;overflow:visible;">
        <img src="${assinaturaSrc}" style="height:140px;width:auto;position:absolute;bottom:-45px;left:50%;transform:translateX(-50%);" />
      </div>
      <div style="border-top:1px solid #111;width:280px;margin:0 auto;padding-top:8px;font-size:12px;">
        OMINI SISTEMAS INTEGRADOS
      </div>
    </div>
    <div style="border-top:1px solid #666;padding-top:12px;text-align:center;font-size:11px;line-height:1.6;text-transform:uppercase;margin-top:40px;">
      OMINI SISTEMAS INTEGRADOS<br>
      RUA AMARAJI, 372 - BAIRRO SÃO GABRIEL<br>
      BELO HORIZONTE - MG<br>
      TEL.: 99997-6648
    </div>
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
</body></html>`);
    janela.document.close();
    window.AppUtils.showToast('Na impressão: desmarque "Cabeçalhos e rodapés".', 'success');
  }

  async function compartilharRecibo(recibo) {
    const mensagem = `
*RECIBO - OMINI SISTEMAS INTEGRADOS*
*Nº:* ${formatarNumero(recibo.numero)}

*Cliente:* ${recibo.cliente_nome.toUpperCase()}
*Referente a:* ${recibo.motivo}
*Valor:* ${window.AppUtils.formatCurrencyBRL(recibo.valor)}
*Data:* ${formatarData(recibo.data_recibo)}

_OMINI SISTEMAS INTEGRADOS_
_Rua Amaraji, 372 – São Gabriel, BH/MG_
_Tel.: 99997-6648_
    `.trim();

    await gerarPDFRecibo(recibo);
    await new Promise(r => setTimeout(r, 1000));
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank');
    window.AppUtils.showToast('Salve o PDF e envie pelo WhatsApp!', 'success');
  }

  function abrirNovoRecibo() {
    const modalId = `recibo-form-${Date.now()}`;
    window.AppUtils.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Novo Recibo</h3>
        <button class="btn btn-ghost btn-small" data-close>Fechar</button>
      </div>
      <form id="${modalId}" class="form-shell" style="gap:10px;">
        <div class="form-group">
          <label>Cliente *</label>
          <input class="input" id="rec-cliente" placeholder="Nome do cliente" required />
        </div>
        <div class="form-group">
          <label>Endereço</label>
          <input class="input" id="rec-endereco" placeholder="Endereço (opcional)" />
        </div>
        <div class="form-group">
          <label>Serviço / Motivo *</label>
          <textarea class="input" id="rec-motivo" rows="3" placeholder="Descreva o serviço prestado..."></textarea>
        </div>
        <div class="form-group">
          <label>Valor (R$) *</label>
          <input type="number" step="0.01" class="input" id="rec-valor" placeholder="0,00" required />
        </div>
        <div class="form-group">
          <label>Data</label>
          <input type="date" class="input" id="rec-data" value="${hoje()}" />
        </div>
        <div class="btn-row" style="margin-top:8px;">
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary" id="btn-salvar-recibo">Salvar</button>
        </div>
      </form>
    `);

    const form = document.getElementById(modalId);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-salvar-recibo');
      window.AppUtils.setButtonLoading(btn, true, 'Salvando...');
      try {
        const payload = {
          cliente_nome: document.getElementById('rec-cliente').value.trim(),
          endereco: document.getElementById('rec-endereco').value.trim(),
          motivo: document.getElementById('rec-motivo').value.trim(),
          valor: parseFloat(document.getElementById('rec-valor').value || 0),
          data_recibo: document.getElementById('rec-data').value
        };
        const response = await RecibosAPI.criar(payload);
        if (response.error) throw new Error(response.error);
        window.AppUtils.showToast('Recibo criado!', 'success');
        window.AppUtils.closeModal();
        await renderRecibosView();
      } catch (err) {
        window.AppUtils.showToast(err.message || 'Erro ao salvar.', 'error');
      } finally {
        window.AppUtils.setButtonLoading(btn, false);
      }
    });
  }

  function abrirDetalhesRecibo(recibo) {
    window.AppUtils.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${formatarNumero(recibo.numero)}</h3>
        <button class="btn btn-ghost btn-small" data-close>Fechar</button>
      </div>
      <div class="detail-grid" style="margin-bottom:14px;">
        <div class="detail-row"><strong>Cliente</strong><span>${window.AppUtils.escapeHtml(recibo.cliente_nome)}</span></div>
        ${recibo.endereco ? `<div class="detail-row"><strong>Endereço</strong><span>${window.AppUtils.escapeHtml(recibo.endereco)}</span></div>` : ''}
        <div class="detail-row"><strong>Serviço</strong><span>${window.AppUtils.escapeHtml(recibo.motivo)}</span></div>
        <div class="detail-row"><strong>Valor</strong><span style="color:var(--accent);font-weight:bold;">${window.AppUtils.formatCurrencyBRL(recibo.valor)}</span></div>
        <div class="detail-row"><strong>Data</strong><span>${formatarData(recibo.data_recibo)}</span></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="btn-rec-pdf">Baixar PDF</button>
        <button class="btn btn-secondary" id="btn-rec-share">WhatsApp</button>
        <button class="btn btn-danger" id="btn-rec-excluir">Excluir</button>
      </div>
    `);

    document.getElementById('btn-rec-pdf')?.addEventListener('click', () => gerarPDFRecibo(recibo));
    document.getElementById('btn-rec-share')?.addEventListener('click', () => compartilharRecibo(recibo));
    document.getElementById('btn-rec-excluir')?.addEventListener('click', async () => {
      const ok = await window.AppUtils.confirmAction('Excluir este recibo?', 'Excluir');
      if (!ok) return;
      const res = await RecibosAPI.excluir(recibo.id);
      if (res.error) { window.AppUtils.showToast(res.error, 'error'); return; }
      window.AppUtils.showToast('Recibo excluído!', 'success');
      window.AppUtils.closeModal();
      await renderRecibosView();
    });
  }

  async function renderRecibosView() {
    const container = document.getElementById('view-container');
    if (!container) return;

    container.innerHTML = `
      <section class="view-section">
        <div class="section-header">
          <h2 class="section-title">Recibos</h2>
          <button class="btn btn-primary btn-small" id="btn-novo-recibo">+ Novo Recibo</button>
        </div>
        <div id="recibos-lista">${window.AppUtils.renderSkeletonCards(3)}</div>
      </section>
    `;

    document.getElementById('btn-novo-recibo')?.addEventListener('click', abrirNovoRecibo);

    const response = await RecibosAPI.listar();
    const lista = document.getElementById('recibos-lista');
    if (!lista) return;

    if (response.error) {
      lista.innerHTML = `<div class="empty-state">Erro ao carregar recibos.</div>`;
      return;
    }

    const recibos = response.data || [];
    if (!recibos.length) {
      lista.innerHTML = `<div class="empty-state">Nenhum recibo ainda. Crie o primeiro!</div>`;
      return;
    }

    lista.innerHTML = `<div class="list-stack">${recibos.map(r => `
      <article class="card card-clickable" data-recibo-id="${r.id}" style="display:grid;gap:6px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <p style="font-family:'IBM Plex Mono',monospace;font-size:0.7rem;color:var(--accent);margin-bottom:3px;">${formatarNumero(r.numero)}</p>
            <h3 class="orcamento-title">${window.AppUtils.escapeHtml(r.cliente_nome)}</h3>
            <p class="orcamento-sub">${window.AppUtils.escapeHtml(r.motivo)}</p>
          </div>
          <span class="orcamento-total">${window.AppUtils.formatCurrencyBRL(r.valor)}</span>
        </div>
        <span class="muted-text">${formatarData(r.data_recibo)}</span>
      </article>
    `).join('')}</div>`;

    lista.querySelectorAll('[data-recibo-id]').forEach(card => {
      card.addEventListener('click', () => {
        const recibo = recibos.find(r => r.id === card.dataset.reciboId);
        if (recibo) abrirDetalhesRecibo(recibo);
      });
    });
  }

  window.RecibosUI = { renderRecibosView };
})();
