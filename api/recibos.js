const supabase = require('./_supabase');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendResponse(res, status, data = null, error = null) {
  setCorsHeaders(res);
  return res.status(status).json({ data, error });
}

function getQueryId(req) {
  if (req.query && req.query.id) return req.query.id;
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  return url.searchParams.get('id');
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const id = getQueryId(req);
      if (id) {
        const { data, error } = await supabase.from('recibos').select('*').eq('id', id).maybeSingle();
        if (error) return sendResponse(res, 500, null, error.message);
        if (!data) return sendResponse(res, 404, null, 'Recibo não encontrado.');
        return sendResponse(res, 200, data);
      }
      const { data, error } = await supabase.from('recibos').select('*').order('criado_em', { ascending: false });
      if (error) return sendResponse(res, 500, null, error.message);
      return sendResponse(res, 200, data || []);
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      if (!body) return sendResponse(res, 400, null, 'JSON inválido.');
      if (!body.cliente_nome) return sendResponse(res, 400, null, 'Nome do cliente obrigatório.');
      if (!body.motivo) return sendResponse(res, 400, null, 'Motivo obrigatório.');
      const payload = {
        cliente_nome: body.cliente_nome.trim(),
        endereco: body.endereco ? body.endereco.trim() : null,
        motivo: body.motivo.trim(),
        valor: parseFloat(body.valor || 0),
        data_recibo: body.data_recibo || new Date().toISOString().split('T')[0]
      };
      const { data, error } = await supabase.from('recibos').insert(payload).select('*').maybeSingle();
      if (error) return sendResponse(res, 500, null, error.message);
      return sendResponse(res, 201, data);
    }

    if (req.method === 'DELETE') {
      const id = getQueryId(req);
      if (!id) return sendResponse(res, 400, null, 'Informe o id.');
      const { data, error } = await supabase.from('recibos').delete().eq('id', id).select('id').maybeSingle();
      if (error) return sendResponse(res, 500, null, error.message);
      if (!data) return sendResponse(res, 404, null, 'Recibo não encontrado.');
      return sendResponse(res, 200, data);
    }

    return sendResponse(res, 400, null, `Método ${req.method} não suportado.`);
  } catch (error) {
    return sendResponse(res, 500, null, error.message || 'Erro interno.');
  }
};
