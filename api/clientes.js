const supabase = require('./_supabase');

// Configura CORS para permitir consumo do frontend SPA em qualquer origem.

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
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

// Faz parsing seguro do body para suportar diferentes formatos de entrada do Vercel.
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

function sanitizeClientePayload(body) {
  return {
    nome: typeof body.nome === 'string' ? body.nome.trim() : '',
    endereco: typeof body.endereco === 'string' && body.endereco.trim() ? body.endereco.trim() : null,
    cidade: typeof body.cidade === 'string' && body.cidade.trim() ? body.cidade.trim() : null,
    contato: typeof body.contato === 'string' && body.contato.trim() ? body.contato.trim() : null
  };
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET com id retorna cliente único, sem id retorna lista completa ordenada por nome.
    if (req.method === 'GET') {
      const id = getQueryId(req);

      if (id) {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          return sendResponse(res, 500, null, error.message || 'Erro ao buscar cliente.');
        }

        if (!data) {
          return sendResponse(res, 404, null, 'Cliente não encontrado.');
        }

        return sendResponse(res, 200, data, null);
      }

      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        return sendResponse(res, 500, null, error.message || 'Erro ao listar clientes.');
      }

      return sendResponse(res, 200, data || [], null);
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);

      if (!body) {
        return sendResponse(res, 400, null, 'JSON inválido no corpo da requisição.');
      }

      const payload = sanitizeClientePayload(body);
      if (!payload.nome) {
        return sendResponse(res, 400, null, 'O campo nome é obrigatório.');
      }

      const { data, error } = await supabase
        .from('clientes')
        .insert(payload)
        .select('*')
        .maybeSingle();

      if (error) {
        return sendResponse(res, 500, null, error.message || 'Erro ao criar cliente.');
      }

      return sendResponse(res, 201, data, null);
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

      const payload = sanitizeClientePayload(body);
      if (!payload.nome) {
        return sendResponse(res, 400, null, 'O campo nome é obrigatório.');
      }

      const { data, error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error) {
        return sendResponse(res, 500, null, error.message || 'Erro ao editar cliente.');
      }

      if (!data) {
        return sendResponse(res, 404, null, 'Cliente não encontrado.');
      }

      return sendResponse(res, 200, data, null);
    }

    if (req.method === 'DELETE') {
      const id = getQueryId(req);
      if (!id) {
        return sendResponse(res, 400, null, 'Informe o parâmetro id para excluir.');
      }

      const { data, error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) {
        return sendResponse(res, 500, null, error.message || 'Erro ao excluir cliente.');
      }

      if (!data) {
        return sendResponse(res, 404, null, 'Cliente não encontrado.');
      }

      return sendResponse(res, 200, data, null);
    }

    return sendResponse(res, 400, null, `Método ${req.method} não suportado.`);
  } catch (error) {
    return sendResponse(res, 500, null, error.message || 'Erro interno no servidor.');
  }
};
