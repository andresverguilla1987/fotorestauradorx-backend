const express = require('express');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json({ limit: '15mb' }));

// IMPORTANTE: esta API KEY es la de Alibaba Model Studio (región Singapore)
const API_KEY = process.env.DASHSCOPE_API_KEY;

// Endpoint para SINGAPORE (intl)
const BASE_URL =
  process.env.DASHSCOPE_BASE_URL ||
  'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'FotoRestauradorX backend OK (Qwen-Image-Edit)' });
});

/**
 * POST /api/restore
 * Body:
 * {
 *   "imageBase64": ".....",   // SIN "data:image/jpeg;base64,"
 *   "mode": "super" | "color" // opcional, solo para cambiar el prompt
 * }
 *
 * Respuesta:
 * { "url": "https://....png" }
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

    if (!imageBase64) {
      return res.status(400).json({
        error: 'imageBase64_required',
        message: 'Falta imageBase64 en el body'
      });
    }

    // Armamos el "data:..." como pide Qwen-Image-Edit
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

    // Prompt según modo
    let instruction = 'Restore old photo, increase sharpness and details, keep faces natural.';
    if (mode === 'color') {
      instruction =
        'Restore and colorize old black and white photo, keep skin tones and faces natural.';
    } else if (mode === 'super') {
      instruction =
        'Super-resolution and enhancement for an old or low-quality photo, keep faces natural.';
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

    console.log('Llamando a Qwen-Image-Edit-Plus en', BASE_URL);

    const resp = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const text = await resp.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error('No se pudo parsear JSON de Qwen:', text);
      return res.status(500).json({
        error: 'invalid_json',
        status: resp.status,
        raw: text
      });
    }

    if (!resp.ok) {
      console.error('Error Qwen status=', resp.status, json);
      return res.status(500).json({
        error: 'qwen_error',
        status: resp.status,
        detail: json
      });
    }

    // Sacar URL de la imagen
    try {
      const choices = json.output?.choices || [];
      const firstChoice = choices[0];
      const content = firstChoice?.message?.content || [];
      const firstImageBlock = content.find((c) => c.image) || content[0];
      const imageUrl = firstImageBlock?.image;

      if (!imageUrl) {
        console.error('No se encontró image URL en respuesta Qwen:', json);
        return res.status(500).json({
          error: 'no_image_url',
          detail: json
        });
      }

      return res.json({ url: imageUrl });
    } catch (e) {
      console.error('Error al extraer URL de respuesta Qwen:', e, json);
      return res.status(500).json({
        error: 'parse_output_error',
        message: e.message
      });
    }
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('FotoRestauradorX backend escuchando en puerto', PORT);
});