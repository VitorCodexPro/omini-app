const supabase = require('./_supabase');

const STATUS_VALIDOS = ['pendente', 'aprovado', 'recusado', 'pago'];
const FORMA_PAGAMENTO_PADRAO = 'À VISTA NA ENTREGA DO SERVIÇO.';
const VALIDADE_PADRAO = 'ORÇAMENTO VÁLIDO POR 15 DIAS.';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendResponse(res, status, data = null, error = null) {
  setCorsHeaders(res);
  return res.status(status).json({ data, error });
}

function getQueryId(req) {
  if (req.query && req.query.id) {
    return req.query.id;
  }

  const baseUrl = `http://${req.headers.host || 'localhost'}`;
  const url = new URL(req.url, baseUrl);
  return url.searchParams.get('id');
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return null;
    }
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    return null;
  }
}

// Normaliza valores monetários aceitando entradas como 1000, 1000.5 ou 1.000,50.
function parseValorMonetario(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }

  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return Number(valor.toFixed(2));
  }

  if (typeof valor !== 'string') {
    return null;
  }

  const limpo = valor.trim().replace(/\s+/g, '');
  if (!limpo) {
    return null;
  }

  let normalizado = limpo;
  if (normalizado.includes(',') && normalizado.includes('.')) {
    normalizado = normalizado.replace(/\./g, '').replace(',', '.');
  } else if (normalizado.includes(',')) {
    normalizado = normalizado.replace(',', '.');
  }

  normalizado = normalizado.replace(/[^0-9.-]/g, '');

  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) {
    return null;
  }

  return Number(numero.toFixed(2));
}

function normalizeItens(itens) {
  if (!Array.isArray(itens)) {
    return [];
  }

  return itens
    .map((item, index) => {
      const descricao = typeof item.descricao === 'string' ? item.descricao.trim() : '';
      if (!descricao) {
        return null;
      }

      const quantidade =
        typeof item.quantidade === 'string' && item.quantidade.trim()
          ? item.quantidade.trim()
          : item.quantidade !== undefined && item.quantidade !== null
            ? String(item.quantidade)
            : '01';

      const valor = parseValorMonetario(item.valor);
      const ordem = Number.isInteger(item.ordem) ? item.ordem : index;

      return {
        descricao,
        quantidade,
        valor,
        ordem
      };
    })
    .filter(Boolean);
}

function montarPayloadOrcamento(body, itens) {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  const localData = typeof body.local_data === 'string' ? body.local_data.trim() : null;
  const atencao = typeof body.atencao === 'string' ? body.atencao.trim() : null;

  const totalInformado = parseValorMonetario(body.total);
  const totalCalculado = itens.reduce((acc, item) => acc + (item.valor || 0), 0);
  const total = Number((totalInformado !== null ? totalInformado : totalCalculado).toFixed(2));

  return {
    cliente_id: body.cliente_id || null,
    titulo,
    local_data: localData,
    atencao,
    total,
    forma_pagamento:
      typeof body.forma_pagamento === 'string' && body.forma_pagamento.trim()
        ? body.forma_pagamento.trim()
        : FORMA_PAGAMENTO_PADRAO,
    validade:
      typeof body.validade === 'string' && body.validade.trim()
        ? body.validade.trim()
        : VALIDADE_PADRAO,
    status:
      typeof body.status === 'string' && STATUS_VALIDOS.includes(body.status)
        ? body.status
        : 'pendente'
  };
}

function extrairCamposBase(orcamento) {
  return {
    cliente_id: orcamento.cliente_id,
    titulo: orcamento.titulo,
    local_data: orcamento.local_data,
    atencao: orcamento.atencao,
    total: orcamento.total,
    forma_pagamento: orcamento.forma_pagamento,
    validade: orcamento.validade,
    status: orcamento.status
  };
}

function ordenarItens(itens) {
  return (itens || []).slice().sort((a, b) => {
    if (a.ordem !== b.ordem) {
      return a.ordem - b.ordem;
    }
    return a.descricao.localeCompare(b.descricao, 'pt-BR');
  });
}

async function listarOrcamentosComJoin() {
  // Tenta JOIN direto via relacionamento do Supabase.
  const tentativaJoin = await supabase
    .from('orcamentos')
    .select(`
      id,
      cliente_id,
      titulo,
      local_data,
      atencao,
      total,
      forma_pagamento,
      validade,
      status,
      criado_em,
      clientes (
        id,
        nome,
        cidade,
        contato
      )
    `)
    .order('criado_em', { ascending: false });

  if (!tentativaJoin.error) {
    return { data: tentativaJoin.data || [], error: null };
  }

  // Fallback manual em duas consultas caso o relacionamento não esteja disponível.
  const { data: orcamentos, error: erroOrcamentos } = await supabase
    .from('orcamentos')
    .select('*')
    .order('criado_em', { ascending: false });

  if (erroOrcamentos) {
    return { data: null, error: erroOrcamentos };
  }

  const clienteIds = [...new Set((orcamentos || []).map((item) => item.cliente_id).filter(Boolean))];
  let clientesPorId = {};

  if (clienteIds.length) {
    const { data: clientes, error: erroClientes } = await supabase
      .from('clientes')
      .select('id, nome, cidade, contato')
      .in('id', clienteIds);

    if (erroClientes) {
      return { data: null, error: erroClientes };
    }

    clientesPorId = (clientes || []).reduce((acc, cliente) => {
      acc[cliente.id] = cliente;
      return acc;
    }, {});
  }

  const data = (orcamentos || []).map((orcamento) => ({
    ...orcamento,
    clientes: orcamento.cliente_id ? clientesPorId[orcamento.cliente_id] || null : null
  }));

  return { data, error: null };
}

async function buscarOrcamentoCompleto(id) {
  // Tenta buscar orçamento + cliente + itens em uma consulta.
  const tentativaJoin = await supabase
    .from('orcamentos')
    .select(`
      *,
      clientes (
        id,
        nome,
        endereco,
        cidade,
        contato
      ),
      itens_orcamento (
        id,
        orcamento_id,
        descricao,
        quantidade,
        valor,
        ordem
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (!tentativaJoin.error) {
    if (!tentativaJoin.data) {
      return { data: null, error: null };
    }

    return {
      data: {
        ...tentativaJoin.data,
        itens_orcamento: ordenarItens(tentativaJoin.data.itens_orcamento)
      },
      error: null
    };
  }

  // Fallback manual garantindo retorno completo mesmo sem JOIN automático.
  const { data: orcamento, error: erroOrcamento } = await supabase
    .from('orcamentos')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (erroOrcamento) {
    return { data: null, error: erroOrcamento };
  }

  if (!orcamento) {
    return { data: null, error: null };
  }

  let cliente = null;
  if (orcamento.cliente_id) {
    const { data: clienteData, error: erroCliente } = await supabase
      .from('clientes')
      .select('id, nome, endereco, cidade, contato')
      .eq('id', orcamento.cliente_id)
      .maybeSingle();

    if (erroCliente) {
      return { data: null, error: erroCliente };
    }

    cliente = clienteData || null;
  }

  const { data: itens, error: erroItens } = await supabase
    .from('itens_orcamento')
    .select('id, orcamento_id, descricao, quantidade, valor, ordem')
    .eq('orcamento_id', id);

  if (erroItens) {
    return { data: null, error: erroItens };
  }

  return {
    data: {
      ...orcamento,
      clientes: cliente,
      itens_orcamento: ordenarItens(itens)
    },
    error: null
  };
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const id = getQueryId(req);

      if (id) {
        const { data, error } = await buscarOrcamentoCompleto(id);
        if (error) {
          return sendResponse(res, 500, null, error.message || 'Erro ao buscar orçamento.');
        }

        if (!data) {
          return sendResponse(res, 404, null, 'Orçamento não encontrado.');
        }

        return sendResponse(res, 200, data, null);
      }

      const { data, error } = await listarOrcamentosComJoin();
      if (error) {
        return sendResponse(res, 500, null, error.message || 'Erro ao listar orçamentos.');
      }

      return sendResponse(res, 200, data || [], null);
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      if (!body) {
        return sendResponse(res, 400, null, 'JSON inválido no corpo da requisição.');
      }

      const itens = normalizeItens(body.itens || []);
      const payload = montarPayloadOrcamento(body, itens);

      if (!payload.titulo) {
        return sendResponse(res, 400, null, 'O campo titulo é obrigatório.');
      }

      const { data: novoOrcamento, error: erroCriacao } = await supabase
        .from('orcamentos')
        .insert(payload)
        .select('*')
        .maybeSingle();

      if (erroCriacao) {
        return sendResponse(res, 500, null, erroCriacao.message || 'Erro ao criar orçamento.');
      }

      if (itens.length) {
        const itensComId = itens.map((item) => ({
          ...item,
          orcamento_id: novoOrcamento.id
        }));

        const { error: erroItens } = await supabase.from('itens_orcamento').insert(itensComId);
        if (erroItens) {
          // Rollback manual do cabeçalho caso falhe a gravação dos itens.
          await supabase.from('orcamentos').delete().eq('id', novoOrcamento.id);
          return sendResponse(
            res,
            500,
            null,
            'Erro ao salvar itens do orçamento. Operação revertida automaticamente.'
          );
        }
      }

      const { data: completo, error: erroBusca } = await buscarOrcamentoCompleto(novoOrcamento.id);
      if (erroBusca) {
        return sendResponse(res, 201, novoOrcamento, null);
      }

      return sendResponse(res, 201, completo, null);
    }

    if (req.method === 'PUT') {
      const id = getQueryId(req);
      if (!id) {
        return sendResponse(res, 400, null, 'Informe o parâmetro id para editar.');
      }

      const body = await parseBody(req);
      if (!body) {
        return sendResponse(res, 400, null, 'JSON inválido no corpo da requisição.');
      }

      const itens = normalizeItens(body.itens || []);
      const payload = montarPayloadOrcamento(body, itens);

      if (!payload.titulo) {
        return sendResponse(res, 400, null, 'O campo titulo é obrigatório.');
      }

      const { data: existente, error: erroExistente } = await buscarOrcamentoCompleto(id);
      if (erroExistente) {
        return sendResponse(res, 500, null, erroExistente.message || 'Erro ao carregar orçamento atual.');
      }

      if (!existente) {
        return sendResponse(res, 404, null, 'Orçamento não encontrado.');
      }

      const backupCabecalho = extrairCamposBase(existente);
      const backupItens = (existente.itens_orcamento || []).map((item) => ({
        orcamento_id: id,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor: item.valor,
        ordem: item.ordem
      }));

      const { data: atualizado, error: erroUpdate } = await supabase
        .from('orcamentos')
        .update(payload)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (erroUpdate) {
        return sendResponse(res, 500, null, erroUpdate.message || 'Erro ao atualizar orçamento.');
      }

      if (!atualizado) {
        return sendResponse(res, 404, null, 'Orçamento não encontrado.');
      }

      const { error: erroDeleteItens } = await supabase
        .from('itens_orcamento')
        .delete()
        .eq('orcamento_id', id);

      if (erroDeleteItens) {
        await supabase.from('orcamentos').update(backupCabecalho).eq('id', id);
        return sendResponse(res, 500, null, 'Erro ao substituir itens do orçamento.');
      }

      if (itens.length) {
        const itensComId = itens.map((item) => ({
          ...item,
          orcamento_id: id
        }));

        const { error: erroInsertItens } = await supabase.from('itens_orcamento').insert(itensComId);
        if (erroInsertItens) {
          // Rollback manual: restaura cabeçalho e itens anteriores.
          await supabase.from('itens_orcamento').delete().eq('orcamento_id', id);
          if (backupItens.length) {
            await supabase.from('itens_orcamento').insert(backupItens);
          }
          await supabase.from('orcamentos').update(backupCabecalho).eq('id', id);
          return sendResponse(
            res,
            500,
            null,
            'Erro ao salvar itens atualizados. Alterações foram revertidas.'
          );
        }
      }

      const { data: completo, error: erroCompleto } = await buscarOrcamentoCompleto(id);
      if (erroCompleto) {
        return sendResponse(res, 200, atualizado, null);
      }

      return sendResponse(res, 200, completo, null);
    }

    if (req.method === 'PATCH') {
      const id = getQueryId(req);
      if (!id) {
        return sendResponse(res, 400, null, 'Informe o parâmetro id para atualizar status.');
      }

      const body = await parseBody(req);
      if (!body) {
        return sendResponse(res, 400, null, 'JSON inválido no corpo da requisição.');
      }

      const status = typeof body.status === 'string' ? body.status : '';
      if (!STATUS_VALIDOS.includes(status)) {
        return sendResponse(res, 400, null, 'Status inválido. Use pendente, aprovado ou recusado.');
      }

      const { data, error } = await supabase
        .from('orcamentos')
        .update({ status, atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error) {
        return sendResponse(res, 500, null, error.message || 'Erro ao atualizar status.');
      }

      if (!data) {
        return sendResponse(res, 404, null, 'Orçamento não encontrado.');
      }

      return sendResponse(res, 200, data, null);
    }

    if (req.method === 'DELETE') {
      const id = getQueryId(req);
      if (!id) {
        return sendResponse(res, 400, null, 'Informe o parâmetro id para excluir.');
      }

      const { data, error } = await supabase
        .from('orcamentos')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) {
        return sendResponse(res, 500, null, error.message || 'Erro ao excluir orçamento.');
      }

      if (!data) {
        return sendResponse(res, 404, null, 'Orçamento não encontrado.');
      }

      return sendResponse(res, 200, data, null);
    }

    return sendResponse(res, 400, null, `Método ${req.method} não suportado.`);
  } catch (error) {
    return sendResponse(res, 500, null, error.message || 'Erro interno no servidor.');
  }
};
