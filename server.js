const express = require('express');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json({ limit: '15mb' }));

const API_KEY = process.env.DASHSCOPE_API_KEY;
// IMPORTANTE: usar el endpoint correcto de DashScope para Wan 2.1
const BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';

// Healthcheck simple
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'FotoRestauradorX backend OK' });
});

// Endpoint principal de restauración
// Body esperado: { imageBase64: "...", mode: "super" | "color" }
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
          ? { upscale_factor: 2, n: 1 }
          : { n: 1 }
    };

    console.log('Llamando a DashScope con function =', func);

    const createResp = await fetch(
      BASE_URL + '/services/aigc/image2image/image-synthesis',
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

    const createText = await createResp.text();
    let createJson = {};
    try {
      createJson = JSON.parse(createText);
    } catch (e) {
      console.error('No se pudo parsear JSON de DashScope:', createText);
    }

    if (!createResp.ok) {
      console.error('DashScope create error status=', createResp.status, createJson);
      return res.status(500).json({
        error: 'dashscope_create',
        status: createResp.status,
        detail: createJson
      });
    }

    const taskId =
      createJson.output && (createJson.output.task_id || createJson.output.taskId);
    if (!taskId) {
      console.error('No task_id en respuesta:', createJson);
      return res.status(500).json({ error: 'no_task_id', detail: createJson });
    }

    console.log('Task creada. ID =', taskId);

    let finalUrl = null;

    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000)); // esperar 2 segundos

      const taskResp = await fetch(BASE_URL + '/tasks/' + taskId, {
        headers: {
          Authorization: `Bearer ${API_KEY}`
        }
      });

      const taskText = await taskResp.text();
      let taskJson = {};
      try {
        taskJson = JSON.parse(taskText);
      } catch (e) {
        console.error('No se pudo parsear JSON de task:', taskText);
      }

      const status =
        taskJson.output && (taskJson.output.task_status || taskJson.output.taskStatus);

      console.log('Task status:', status);

      if (status === 'SUCCEEDED') {
        const results =
          (taskJson.output && (taskJson.output.results || taskJson.output.results_list)) ||
          [];
        const result = results.find((r) => r.url || r.image_url) || results[0];
        finalUrl = (result && (result.url || result.image_url)) || null;
        break;
      } else if (status === 'FAILED' || status === 'CANCELED') {
        console.error('Task failed:', taskJson);
        return res.status(500).json({ error: 'task_failed', detail: taskJson });
      }
      // si sigue en PENDING/RUNNING, el loop continúa
    }

    if (!finalUrl) {
      console.error('Timeout o sin URL final en task');
      return res.status(504).json({
        error: 'timeout',
        detail: 'La tarea tardó demasiado o no devolvió URL'
      });
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