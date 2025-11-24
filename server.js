const express = require('express');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json({ limit: '15mb' }));

const API_KEY = process.env.DASHSCOPE_API_KEY;
const BASE_URL = 'https://dashscope-intl.aliyuncs.com/api/v1';

// Sencillo healthcheck
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'FotoRestauradorX backend OK' });
});

// Endpoint principal de restauración
// Body esperado: { imageBase64: "...", mode: "super" | "color" }
app.post('/api/restore', async (req, res) => {
  try {
    const { imageBase64, mode } = req.body || {};

    if (!API_KEY) {
      return res.status(500).json({ error: 'missing_api_key', message: 'DASHSCOPE_API_KEY no está configurada' });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64_required' });
    }

    const func = mode === 'color' ? 'colorization' : 'super_resolution';

    const body = {
      model: 'wanx2.1-imageedit',
      input: {
        function: func,
        prompt:
          func === 'colorization'
            ? 'Restore and colorize the old photo, keep faces natural.'
            : 'Restore and enhance photo quality, keep faces natural.',
        base_image_url: `data:image/jpeg;base64,${imageBase64}`
      },
      parameters:
        func === 'super_resolution'
          ? { upscale_factor: 2, watermark: false, n: 1 }
          : { watermark: false, n: 1 }
    };

    // 1) Crear tarea asíncrona en DashScope
    const createResp = await fetch(
      `${BASE_URL}/services/aigc/image2image/image-synthesis`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
          'X-DashScope-Async': 'enable'
        },
        body: JSON.stringify(body)
      }
    );

    const createJson = await createResp.json().catch(() => ({}));

    if (!createResp.ok) {
      console.error('DashScope create error:', createJson);
      return res
        .status(500)
        .json({ error: 'dashscope_create', detail: createJson });
    }

    const taskId = createJson.output && createJson.output.task_id;
    if (!taskId) {
      console.error('No task_id en respuesta:', createJson);
      return res.status(500).json({ error: 'no_task_id', detail: createJson });
    }

    // 2) Polling de la tarea
    let finalUrl = null;

    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000)); // esperar 2 segundos

      const taskResp = await fetch(`${BASE_URL}/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${API_KEY}`
        }
      });

      const taskJson = await taskResp.json().catch(() => ({}));
      const status = taskJson.output && taskJson.output.task_status;

      console.log('Task status:', status);

      if (status === 'SUCCEEDED') {
        const results = (taskJson.output && taskJson.output.results) || [];
        const result = results.find(r => r.url);
        finalUrl = result && result.url;
        break;
      } else if (status === 'FAILED' || status === 'CANCELED') {
        console.error('Task failed:', taskJson);
        return res.status(500).json({ error: 'task_failed', detail: taskJson });
      }
      // si sigue en PENDING/RUNNING, el loop continúa
    }

    if (!finalUrl) {
      return res
        .status(504)
        .json({ error: 'timeout', detail: 'La tarea tardó demasiado o no devolvió URL' });
    }

    return res.json({ url: finalUrl });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('FotoRestauradorX backend escuchando en puerto', PORT);
});