# FotoRestauradorX Backend v1.1

Backend en Node/Express para la app **FotoRestauradorX**, usando el modelo
**wanx2.1-imageedit** de Alibaba Model Studio (DashScope).

## Endpoint de prueba

GET `/api/health`

```bash
curl https://fotorestauradorx-backend.onrender.com/api/health
```

## Endpoint de restauración

POST `/api/restore`

Body (JSON):

```json
{
  "imageBase64": "BASE64_SIN_PREFIX",
  "mode": "super" // o "color"
}
```

- `mode = "super"` → usa `super_resolution` (más nitidez / HD).
- `mode = "color"` → usa `colorization` (colorea fotos en blanco y negro).

Respuesta:

```json
{
  "url": "https://..."
}
```

Esta URL es la imagen generada por Wan 2.1. Es temporal (24h aprox).

## Configuración

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env` basado en `.env.example`:

```env
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
PORT=3000
```

3. Ejecutar en local:

```bash
npm start
```

## Despliegue en Render

- Build command: `npm install`
- Start command: `npm start`
- Env vars:
  - `DASHSCOPE_API_KEY` → tu API key.
  - `PORT` → `3000` (Render la ajusta internamente).