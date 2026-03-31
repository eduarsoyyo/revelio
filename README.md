# 🔄 RetroFlow

Retrospectiva colaborativa en tiempo real. Sin base de datos, sin cuentas. Al terminar, descarga el informe en PDF.

## Desplegar en Netlify

1. Crea un repo en GitHub llamado `retroflow`
2. Sube el archivo `index.html`
3. Ve a [app.netlify.com](https://app.netlify.com) → Add new site → Import from GitHub
4. Selecciona el repo → Deploy
5. Comparte la URL con tu equipo

## Uso

1. Cada persona abre la URL → pone su nombre, avatar y color
2. **📋 Repaso Inicial** — objetivo + tareas del sprint
3. **✍️ Análisis Individual** — notas en Good / Bad / Start / Stop (arrastrables entre columnas)
4. **💬 Puesta en Común** — filtrar por persona o categoría, votar
5. **🎯 Accionables** — crear acciones con responsable, fecha y prioridad
6. **📊 Dashboard** → clic en **📄 Descargar informe PDF**

## Tecnología

- **Preact + htm** desde CDN (sin build step)
- **Supabase Broadcast + Presence** para tiempo real (sin tablas ni SQL)
- **window.print()** para exportar a PDF
- Un solo archivo HTML, cero dependencias locales
