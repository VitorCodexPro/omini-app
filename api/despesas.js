const supabase = require('./_supabase');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendResponse(res, status, data = null, error = null) {
  setCorsHeaders(res);
  return res.status(status).json({ data, error });
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

function getParam(req, param) {
  if (req.query && req.query[param]) return req.query[param];
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  return url.searchParams.get(param);
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const tipo = getParam(req, 'tipo');

    // CATEGORIAS
    if (tipo === 'categorias') {
      if (req.method === 'GET') {
        const { data, error } = await supabase.from('categorias_despesa').select('*').order('nome');
        if (error) return sendResponse(res, 500, null, error.message);
        return sendResponse(res, 200, data || []);
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        if (!body?.nome) return sendResponse(res, 400, null, 'Nome obrigatório.');
        const { data, error } = await supabase.from('categorias_despesa').insert({ nome: body.nome.trim() }).select('*').maybeSingle();
        if (error) return sendResponse(res, 500, null, error.message);
        return sendResponse(res, 201, data);
      }
      if (req.method === 'DELETE') {
        const id = getParam(req, 'id');
        if (!id) return sendResponse(res, 400, null, 'Informe o id.');
        const { error } = await supabase.from('categorias_despesa').delete().eq('id', id);
        if (error) return sendResponse(res, 500, null, error.message);
        return sendResponse(res, 200, { deleted: true });
      }
    }

    // DESPESAS
    if (req.method === 'GET') {
      const id = getParam(req, 'id');
      if (id) {
        const { data, error } = await supabase.from('despesas').select('*').eq('id', id).maybeSingle();
        if (error) return sendResponse(res, 500, null, error.message);
        return sendResponse(res, 200, data);
      }
      const semana = getParam(req, 'semana');
      const inicio = getParam(req, 'inicio');
      const fim = getParam(req, 'fim');
      let query = supabase.from('despesas').select('*').order('data_despesa', { ascending: true });
      if (semana) query = query.eq('semana_inicio', semana);
      else if (inicio && fim) query = query.gte('data_despesa', inicio).lte('data_despesa', fim);
      const { data, error } = await query;
      if (error) return sendResponse(res, 500, null, error.message);
      return sendResponse(res, 200, data || []);
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      if (!body?.descricao) return sendResponse(res, 400, null, 'Descrição obrigatória.');
      if (!body?.valor) return sendResponse(res, 400, null, 'Valor obrigatório.');
      const dataDespesa = body.data_despesa || new Date().toISOString().split('T')[0];
      const d = new Date(dataDespesa + 'T12:00:00');
      const diaSemana = d.getDay();
      const inicio = new Date(d); inicio.setDate(d.getDate() - diaSemana);
      const fim = new Date(d); fim.setDate(d.getDate() + (6 - diaSemana));
      const fmt = dt => dt.toISOString().split('T')[0];
      const payload = {
        categoria_id: body.categoria_id || null,
        categoria_nome: body.categoria_nome || 'Outros',
        descricao: body.descricao.trim(),
        valor: parseFloat(body.valor),
        data_despesa: dataDespesa,
        semana_inicio: fmt(inicio),
        semana_fim: fmt(fim)
      };
      const { data, error } = await supabase.from('despesas').insert(payload).select('*').maybeSingle();
      if (error) return sendResponse(res, 500, null, error.message);
      return sendResponse(res, 201, data);
    }

    if (req.method === 'PUT') {
      const id = getParam(req, 'id');
      if (!id) return sendResponse(res, 400, null, 'Informe o id.');
      const body = await parseBody(req);
      const { data, error } = await supabase.from('despesas').update(body).eq('id', id).select('*').maybeSingle();
      if (error) return sendResponse(res, 500, null, error.message);
      return sendResponse(res, 200, data);
    }

    if (req.method === 'DELETE') {
      const id = getParam(req, 'id');
      if (!id) return sendResponse(res, 400, null, 'Informe o id.');
      const { error } = await supabase.from('despesas').delete().eq('id', id);
      if (error) return sendResponse(res, 500, null, error.message);
      return sendResponse(res, 200, { deleted: true });
    }

    return sendResponse(res, 400, null, 'Método não suportado.');
  } catch (error) {
    return sendResponse(res, 500, null, error.message || 'Erro interno.');
  }
};
