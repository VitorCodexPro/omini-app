const supabase = require('./_supabase');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
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

    // LOGIN
    if (req.method === 'POST' && !tipo) {
      const body = await parseBody(req);
      if (!body?.login || !body?.senha) return sendResponse(res, 400, null, 'Login e senha obrigatórios.');
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, login, nome, perfil')
        .eq('login', body.login.trim())
        .eq('senha', body.senha.trim())
        .maybeSingle();
      if (error) return sendResponse(res, 500, null, error.message);
      if (!data) return sendResponse(res, 401, null, 'Login ou senha incorretos.');
      return sendResponse(res, 200, data);
    }

    // ALTERAR SENHA
    if (req.method === 'PUT') {
      const body = await parseBody(req);
      if (!body?.id || !body?.senha_atual || !body?.senha_nova) return sendResponse(res, 400, null, 'Campos obrigatórios.');
      const { data: user } = await supabase
        .from('usuarios')
        .select('id')
        .eq('id', body.id)
        .eq('senha', body.senha_atual.trim())
        .maybeSingle();
      if (!user) return sendResponse(res, 401, null, 'Senha atual incorreta.');
      const { error } = await supabase
        .from('usuarios')
        .update({ senha: body.senha_nova.trim() })
        .eq('id', body.id);
      if (error) return sendResponse(res, 500, null, error.message);
      return sendResponse(res, 200, { success: true });
    }

    return sendResponse(res, 400, null, 'Método não suportado.');
  } catch (error) {
    return sendResponse(res, 500, null, error.message || 'Erro interno.');
  }
};
