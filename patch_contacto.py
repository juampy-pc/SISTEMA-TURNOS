with open("client.js", "r", encoding="utf-8") as f:
    content = f.read()

old_footer = '''  function renderFooter() {
    return '<footer class="site-footer"><p>' + ST.esc(ST.negocio.nombre) + " · [Dirección] · " + (ST.negocio.whatsapp ? ST.esc(ST.negocio.whatsapp) : "[Teléfono de contacto]") + "</p></footer>";
  }'''

new_footer = '''  function renderFooter() {
    return (
      '<footer class="site-footer"><p>' + ST.esc(ST.negocio.nombre) +
      " · Av. Alvear 4877, Fontana, Chaco · " +
      (ST.negocio.whatsapp ? ST.esc(ST.negocio.whatsapp) : "[Teléfono de contacto]") +
      ' · <a href="https://instagram.com/Miriam_garcia567" target="_blank" rel="noopener">@Miriam_garcia567</a></p></footer>'
    );
  }'''

assert old_footer in content
content = content.replace(old_footer, new_footer)

old_mapa = '''          '<h2 id="ubicacion-titulo">Cómo llegar</h2>' +
          '<p class="section-lede">Av. Alvear 4877, Fontana, Chaco.</p>' +
          '<div class="map-embed">' +'''

new_mapa = '''          '<h2 id="ubicacion-titulo">Cómo llegar</h2>' +
          '<p class="section-lede">Av. Alvear 4877, Fontana, Chaco.</p>' +
          '<a class="btn btn-primary btn-sm" style="margin-bottom:16px;" href="https://wa.me/' + (ST.negocio.whatsapp || "") + '" target="_blank" rel="noopener">Escribinos por WhatsApp</a>' +
          '<div class="map-embed">' +'''

assert old_mapa in content
content = content.replace(old_mapa, new_mapa)

with open("client.js", "w", encoding="utf-8") as f:
    f.write(content)
print("OK")
