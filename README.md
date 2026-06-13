# Mecanismos de Infancia

Tienda en línea (proyecto escolar) de **MI — Mecanismos de Infancia**: juguetes
tradicionales mexicanos —balero, pirinola, yoyo, trompo y toma todo— reinventados
en metal (aluminio, latón y acero) con precisión CNC.

Implementación real del diseño hecho en Claude Design, en HTML/CSS/JS vanilla
(sin dependencias ni build), lista para abrir en el navegador o publicar en
GitHub Pages.

## Archivos

- **`index.html`** — la tienda completa (escritorio y móvil, responsiva).
- **`iphone.html`** — la misma tienda mostrada dentro de un marco de iPhone para
  la presentación.

## Cómo verla

Abre `index.html` directamente en el navegador, o sirve la carpeta:

```bash
python3 -m http.server 8000
# luego visita http://localhost:8000
```

> Para que el carrito y las fotos se guarden (usan `localStorage`), conviene
> abrirla con un servidor local en vez de `file://`.

## Qué incluye

- **4 vistas navegables:** Inicio, Catálogo, Producto y Nosotros.
- **Carrito funcional:** agregar, cambiar cantidades, total, checkout; persiste
  en el navegador.
- **5 juguetes:** Balero (set 2 en 1), Pirinola, Yoyo, Trompo y Toma Todo, todos
  en metal con su ficha técnica.
- **Equipo:** los 6 integrantes; Emmanuel y Natalia comparten el Balero.
- **Identidad visual estilo Munari:** crema + bermellón + tinta, tipografía
  Archivo enorme y Space Mono técnica.
- **Detalles mexicanos:** papel picado animado en el hero y la palabra
  *INFANCIA* que cicla color y tipografía en loop.
- **Color por sección:** barra de acento bajo el nav (Inicio bermellón,
  Catálogo verde, Nosotros rosa, Carrito ámbar).
- **Animaciones al hacer scroll**, marquee y mecanismos girando.

## Fotos de los juguetes

Cada bloque de color es un *slot* de imagen: haz clic o arrastra una foto
(PNG/JPG/WebP) sobre él y se guarda en el navegador. La misma foto aparece tanto
en el catálogo como en la página de detalle del juguete.
