/**
 * Netlify Function: Trigger Excel Processing
 * POST /api/procesar-excel
 *
 * Esta función solo dispara el GitHub Action para procesar el Excel
 * y retorna inmediatamente (sin timeout)
 */

const { createClient } = require('@supabase/supabase-js');
const { verifyAuth, getCorsHeaders } = require('./lib/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event, context) => {
  const origin = event.headers.origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Verificar autenticación
  const auth = await verifyAuth(event);
  if (!auth.authenticated) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Unauthorized'
      })
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { filePath } = JSON.parse(event.body);

    if (!filePath) {
      throw new Error('filePath requerido');
    }

    // Verificar que el archivo existe
    const { data: fileData, error: checkError } = await supabase.storage
      .from('excel-uploads')
      .download(filePath);

    if (checkError) {
      throw new Error(`Archivo no encontrado: ${checkError.message}`);
    }

    // Disparar GitHub Action
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPOSITORY || 'bustillosmorales-lgtm/sistemadegestion';

    if (!githubToken) {
      console.error('GITHUB_TOKEN no configurado');
      throw new Error('GITHUB_TOKEN no configurado en variables de entorno');
    }

    const [owner, repo] = githubRepo.split('/');
    const workflowUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/process-excel.yml/dispatches`;

    console.log('Disparando GitHub Action:', { owner, repo, filePath });

    const response = await fetch(workflowUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          file_path: filePath
        }
      })
    });

    console.log('GitHub API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API error:', { status: response.status, error: errorText });
      throw new Error(`Error disparando GitHub Action (${response.status}): ${errorText || 'Sin detalles'}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Procesamiento iniciado en segundo plano',
        info: 'Revisa el progreso en: https://github.com/' + githubRepo + '/actions',
        file_path: filePath
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
