# FotoRestauradorX Backend v1.2 (Qwen-Image-Edit, región Singapore)

Este backend usa **Qwen-Image-Edit-Plus** en la región **Singapore** (`dashscope-intl`)
para restaurar / mejorar fotos.

## Endpoints

### GET /api/health

```bash
curl https://TU-RENDER-URL.onrender.com/api/health
```

### POST /api/restore

Body (JSON):

```json
{
  "imageBase64": "BASE64_SIN_PREFIX",
  "mode": "super"
}
```

- `imageBase64`: el JPEG en Base64 **sin** `data:image/jpeg;base64,`.
- `mode`: opcional. `"super"` para más nitidez, `"color"` para colorizar,
  cualquier otro valor = restauración general.

Respuesta:

```json
{ "url": "https://..." }
```

## Variables de entorno (Render)

- `DASHSCOPE_API_KEY` → tu key `sk-...` de Alibaba (región Singapore).
- `DASHSCOPE_BASE_URL` → (opcional) deja el default:
  `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
- `PORT` → 3000

## Comandos

```bash
npm install
npm start
```