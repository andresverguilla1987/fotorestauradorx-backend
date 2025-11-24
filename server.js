// server.js
// Backend de FotoRestauradorX – puente entre la app y Qwen-Image-Edit-Plus

const express = require('express');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Aceptar JSON grande (foto en base64)
app.use(express.json({ limit: '20mb' }));

// ====== CONFIG ======

const API_KEY = process.env.DASHSCOPE_API_KEY;

// Endpoint INTL recomendado por Alibaba para Model Studio (región Singapore)
const BASE_URL =
  process.env.DASHSCOPE_BASE_URL ||
  'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

if (!API_KEY) {
  console.warn('⚠️ [FotoRestauradorX] DASHSCOPE_API_KEY NO está configurada. La IA va a fallar.');
}

// ====== RUTAS BÁSICAS ======

app.get('/', (req, res) => {
  res.json({
    ok: true,
    app: 'FotoRestauradorX-backend',
    health: '/api/health',
    restore: '/api/restore'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'FotoRestauradorX backend OK (Qwen-Image-Edit-Plus)',
    dashscopeBaseUrl: BASE_URL ? 'SET' : 'MISSING',
    hasApiKey: !!API_KEY
  });
});

// ====== ENDPOINT PRINCIPAL: /api/restore ======
/**
 * POST /api/restore
 * Body JSON:
 * {
 *   "imageBase64": "....",          // SIN el prefijo "data:image/jpeg;base64,"
 *   "mode": "auto" | "super" | "color"
 * }
 *
 * Respuesta 200:
 * { "url": "https://...." }         // URL de la foto restaurada en DashScope
 */
app.post('/api/restore', async (req, res) => {
  try {
    const { imageBase64, mode } = req.body || {};

    if (!API_KEY) {
      return res.status(500).json({
        error: 'missing_api_key',
        message: 'DASHSCOPE_API_KEY no está configurada en Render'
      });
    }

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({
        error: 'imageBase64_required',
        message: 'Falta imageBase64 (string base64) en el body'
      });
    }

    // Para debug suave
    console.log(
      `[RESTORE] peticion recibida. base64 length=${imageBase64.length}, mode=${mode || 'auto'}`
    );

    // Qwen pide el formato "data:..."
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

    // Prompt según modo
    let instruction =
      'Restore old or low-quality photo, increase sharpness and details, remove noise, keep faces natural and realistic.';
    if (mode === 'color') {
      instruction =
        'Restore and colorize old black and white photo, keep skin tones and faces natural, do not over-smooth.';
    } else if (mode === 'super') {
      instruction =
        'Super-resolution and enhancement for an old or low-quality photo, keep original style and faces natural.';
    }

    const body = {
      model: 'qwen-image-edit-plus',
      input: {
        messages: [
          {
            role: 'user',
            content: [
              { image: dataUrl },
              { text: instruction }
            ]
          }
        ]
      },
      parameters: {
        n: 1,
        watermark: false,
        prompt_extend: true
      }
    };

    console.log('[RESTORE] Llamando a Qwen-Image-Edit-Plus en', BASE_URL);

    const resp = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const rawText = await resp.text();
    let json;

    try {
      json = JSON.parse(rawText);
    } catch (e) {
      console.error('[RESTORE] No se pudo parsear JSON de Qwen:', rawText);
      return res.status(500).json({
        error: 'invalid_json_from_qwen',
        status: resp.status,
        raw: rawText
      });
    }

    if (!resp.ok) {
      console.error('[RESTORE] Error Qwen status =', resp.status, json);
      return res.status(500).json({
        error: 'qwen_error',
        status: resp.status,
        detail: json
      });
    }

    // Extraer URL de la imagen generada
    try {
      const choices = json.output?.choices || [];
      const firstChoice = choices[0];
      const content = firstChoice?.message?.content || [];
      const firstImageBlock = content.find((c) => c.image) || content[0];
      const imageUrl = firstImageBlock?.image;

      if (!imageUrl) {
        console.error('[RESTORE] No se encontró image URL en respuesta Qwen:', json);
        return res.status(500).json({
          error: 'no_image_url_in_qwen_output',
          detail: json
        });
      }

      console.log('[RESTORE] Imagen restaurada OK:', imageUrl);
      return res.json({ url: imageUrl });
    } catch (e) {
      console.error('[RESTORE] Error al extraer URL de respuesta Qwen:', e, json);
      return res.status(500).json({
        error: 'parse_output_error',
        message: e.message
      });
    }
  } catch (err) {
    console.error('[RESTORE] Server error:', err);
    return res.status(500).json({
      error: 'server_error',
      message: err.message
    });
  }
});

// ====== ARRANQUE SERVIDOR ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('FotoRestauradorX backend escuchando en puerto', PORT);
});
