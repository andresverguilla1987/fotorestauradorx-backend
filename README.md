# FotoRestauradorX Backend

Backend sencillo en Node/Express para la app **FotoRestauradorX**.  
Expone un endpoint `/api/restore` que recibe una foto en base64, la manda al modelo de Alibaba Cloud (DashScope) `wanx2.1-imageedit` y devuelve una URL de la imagen restaurada.

## Endpoints

### `GET /api/health`
Devuelve un JSON simple para comprobar que el backend está vivo.

### `POST /api/restore`

Body esperado (JSON):

```json
{
  "imageBase64": "BASE64_SIN_PREFIX",
  "mode": "super" // o "color"
}
```

- `mode = "super"` → usa `super_resolution` (mejora nitidez/calidad).
- `mode = "color"` → usa `colorization` (colorea fotos en blanco y negro).

Respuesta exitosa:

```json
{
  "url": "https://..."
}
```

Esa URL es la imagen restaurada generada por el servicio de Alibaba.

## Configuración

1. Instala dependencias:

```bash
npm install
```

2. Crea un archivo `.env` a partir de `.env.example`:

```env
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
PORT=3000
```

3. Ejecuta en local:

```bash
npm start
```

El backend se levantará en `http://localhost:3000`.

Comprueba:

```bash
curl http://localhost:3000/api/health
```

## Despliegue en Render

- Build command: `npm install`
- Start command: `npm start`
- Variables de entorno:
  - `DASHSCOPE_API_KEY` → tu API Key de DashScope.
  - `PORT` → `3000` (Render la sobreescribe internamente, pero no estorba).