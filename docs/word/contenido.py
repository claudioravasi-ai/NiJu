# -*- coding: utf-8 -*-
from constructor import *
from infografias import *

D = []
def add(*x): D.extend(x)

# ============================ PORTADA ============================
add(espacio(900))
add(tabla([fila([
    celda(parrafo(run("NJ", b=True, sz=90, color=TINTA), despues=0, jc="center"), 1500, shd=AMARILLO, margen=200),
    celda(parrafo(run("NiJu", b=True, sz=96, color=TINTA, font="Calibri Light"), despues=60) +
          parrafo(run("COMPRÁ TODO, DE TODO Y PARA TODO", b=True, sz=20, color=GRIS_TX, space=60), despues=0),
          ANCHO-1500, margen=200)
], alto=1600)], [1500, ANCHO-1500], bordes=False))
add(espacio(500))
add(parrafo(run("Qué hace la aplicación", b=True, sz=52, color=TINTA, font="Calibri Light"), despues=120))
add(parrafo(run("Explicado punto por punto, desde cero, con ejemplos reales.", sz=26, color=GRIS_TX), despues=400))
add(recuadro([
    "Esta guía está escrita para alguien que nunca usó una aplicación de compras y no tiene por qué saber "
    "nada de tecnología ni de comercio exterior. Cada punto explica qué hace la app, por qué sirve, y muestra "
    "un ejemplo con números de verdad.",
    "Todos los precios que aparecen acá salieron de tiendas argentinas reales, consultadas el día que se armó "
    "este documento."], "Para quién es esta guía", AZUL))
add(salto_pagina())

# ============================ QUÉ ES ============================
add(titulo("Primero lo primero: ¿qué es NiJu?", 1))
add(parrafo(run("Imaginate que querés comprar un aceite, una zapatilla o un televisor. Hoy tenés que entrar "
                "a la página de Jumbo, después a la de Carrefour, después a Mercado Libre, anotar los precios "
                "en un papel y comparar. Y si el producto viene del exterior, encima no sabés cuánto vas a "
                "terminar pagando de envío y de impuestos hasta que ya es tarde.", sz=22)))
add(parrafo(run("NiJu hace todo eso por vos, en tres segundos, y te muestra un solo número: "
                "lo que realmente vas a pagar.", b=True, sz=22)))
add(espacio(160))
add(escalera([
    ("Escribís qué querés", "Una palabra alcanza: \"aceite\", \"taladro\", \"iPhone\"."),
    ("La app pregunta en 31 tiendas", "Supermercados, ferreterías y tiendas de todo el mundo, todas a la vez."),
    ("Te muestra el precio final", "Con envío, impuestos y todo incluido. Sin sorpresas al final.")
]))
add(espacio(240))
add(recuadro("La diferencia con cualquier otro comparador es esta: los demás te muestran el precio de la "
             "vidriera. NiJu te muestra el precio puesto en tu casa.", "La idea en una línea", VERDE, "E8F7EF"))
add(salto_pagina())

# ============================ PARTE 1 ============================
add(titulo("Parte 1 — Lo que ve cualquier persona que entre", 1))
add(parrafo(run("Estas quince cosas están disponibles para todo el que abra la aplicación.", sz=21, color=GRIS_TX)))
add(espacio(200))

# 1
add(bloque_numerado(1, "Le pregunta el precio a 31 tiendas al mismo tiempo"))
add(parrafo(run("Vos escribís una palabra. La app manda 31 consultas en paralelo y junta todas las respuestas. "
                "Lo que a una persona le llevaría media hora, tarda menos de tres segundos.", sz=21)))
add(fichas([
    ("13 nacionales", "Jumbo, Carrefour, Vea, Disco, Easy, Coto, La Anónima, Frávega y más.", AZUL),
    ("11 internacionales", "Amazon, eBay, AliExpress, Alibaba, Temu, Walmart, SHEIN, Best Buy…", VIOLETA),
    ("4 redes sociales", "Instagram, TikTok Shop, Facebook Marketplace y catálogos de WhatsApp.", ROJO),
], 3))
add(espacio(160))
add(recuadro("Búsqueda real de la palabra «aceite»: 148 ofertas encontradas en 30 de 31 tiendas, "
             "en 2,8 segundos, agrupadas en 95 productos distintos.", "Ejemplo medido", AZUL))
add(espacio(260))

# 2
add(bloque_numerado(2, "Sabe distinguir un producto de otro parecido"))
add(parrafo(run("Esto parece un detalle y es lo más difícil de todo. Un aceite de 900 mililitros no es el mismo "
                "producto que uno de un litro y medio. Uno de girasol no es uno de oliva. Si la app los mezcla, "
                "te dice «ahorrás 38.000 pesos» cuando en realidad te está comparando dos cosas distintas.",
                sz=21)))
add(parrafo(run("NiJu entiende que «1,5 Lts» y «1500 ml» son lo mismo, y que «girasol» y «oliva» no lo son. "
                "Por eso lo que compara, compara de verdad.", sz=21)))
add(espacio(160))
add(grafico_barras([
    ("Vea",        3790, "$ 3.790", "el más barato", True),
    ("Carrefour",  4369, "$ 4.369", None, False),
    ("Disco",      4600, "$ 4.600", None, False),
    ("Jumbo",      4700, "$ 4.700", "el más caro", False),
], "Aceite de girasol 900 ml Cocinero — mismo producto, cuatro tiendas"))
add(espacio(120))
add(parrafo(run("Entre el más barato y el más caro hay 910 pesos de diferencia por la misma botella. "
                "Eso es un 24 % más, por no saber dónde mirar.", sz=20, color=GRIS_TX)))
add(espacio(260))

# 3
add(bloque_numerado(3, "Te dice el precio que vas a pagar de verdad", VERDE))
add(parrafo(run("Cuando algo viene del exterior, el precio que ves en la página no es lo que vas a pagar. "
                "Falta el envío, faltan los impuestos de aduana y falta la gestión. Mucha gente se entera de "
                "eso cuando ya compró.", sz=21)))
add(parrafo(run("NiJu suma todo eso antes y te muestra un único número: el precio puesto en tu casa.", b=True, sz=21)))
add(espacio(160))
add(tabla_datos(
    ["Un iPhone 15 comprado en AliExpress", "Cuánto suma"],
    [["Precio del producto en la página", "$ 924.185"],
     ["Envío internacional", "gratis"],
     ["Impuestos de importación", "$ 86.202"],
     ["Gestión de NiJu (con su IVA)", "$ 75.868"],
     ["LO QUE PAGÁS", "$ 1.086.255"]],
    [6400, 3238], resaltar=4))
add(espacio(120))
add(recuadro("Sin este cálculo, alguien compraría creyendo que paga 924.185 pesos y se encontraría con "
             "162.070 pesos más de sorpresa. Eso es un 17 % que aparece después.", "Por qué importa", ROJO, "FDECEE"))
add(salto_pagina())

# 4
add(bloque_numerado(4, "Muestra la foto verdadera del producto"))
add(parrafo(run("La foto que ves es la que publica la tienda donde vas a comprar. No es un dibujo ni una imagen "
                "parecida. Y si una tienda no dio foto, la app lo dice con todas las letras en vez de inventar "
                "una.", sz=21)))
add(espacio(140))
add(recuadro("En la última búsqueda, 59 de 60 productos se mostraron con la foto real de la tienda. "
             "El único que no la tenía apareció con un cartel que decía «Sin imagen».", "Medición real", AZUL))
add(espacio(260))

# 5
add(bloque_numerado(5, "Te muestra TU precio, no «el» precio", VERDE))
add(parrafo(run("Esto no lo hace nadie más, y es una obviedad cuando lo pensás: el mismo producto le cuesta "
                "distinto a cada persona, según cómo esté anotada en ARCA.", sz=21)))
add(parrafo(run("Una persona común paga el precio completo. Una empresa recupera el IVA, así que el mismo "
                "producto le sale bastante menos. NiJu te dice cuánto te sale a vos.", sz=21)))
add(espacio(160))
add(tabla_datos(
    ["Si sos…", "Precio en la vidriera", "Recuperás", "Te sale de verdad"],
    [["Consumidor final", "$ 189.900", "—", "$ 189.900"],
     ["Monotributista", "$ 189.900", "—", "$ 189.900"],
     ["Responsable inscripto", "$ 189.900", "$ 32.958", "$ 156.942"],
     ["IVA exento", "$ 189.900", "—", "$ 189.900"]],
    [3000, 2400, 1900, 2338], resaltar=2))
add(espacio(120))
add(recuadro("Hay algo todavía más fino: a veces la tienda más barata de la vidriera NO es la que te conviene, "
             "porque no te da factura A y entonces no podés recuperar el IVA. La app te avisa cuando pasa eso.",
             "El detalle que nadie mira", VERDE, "E8F7EF"))
add(salto_pagina())

# 6
add(bloque_numerado(6, "Caza los descuentos truchos", ROJO))
add(parrafo(run("Un truco viejo del comercio: la tienda sube el precio dos semanas antes, y después lo tacha y "
                "pone «40 % de descuento». El descuento existe solo contra el precio inflado.", sz=21)))
add(parrafo(run("NiJu guarda el precio de cada producto todos los días. Con esa memoria puede mostrarte si el "
                "descuento es real o es humo. Y esto es un dato que nadie puede comprar después: el precio de "
                "ayer no se consigue en ningún lado.", sz=21)))
add(espacio(160))
add(grafico_barras([
    ("Precio tachado por la tienda", 100, "$ 100.000", "el que te muestran", False),
    ("Precio más alto que tuvo de verdad", 65, "$ 65.000",  "según el historial", False),
    ("Precio de hoy", 60, "$ 60.000", "lo que pagás", True),
], "Cómo se ve un descuento inflado", ROJO, VERDE))
add(espacio(120))
add(tabla_datos(["Lo que dice la tienda", "Lo que es verdad"],
                [["«40 % de descuento»", "8 % de descuento real"]],
                [4819, 4819]))
add(espacio(260))

# 7
add(bloque_numerado(7, "«Traelo por mí»: cualquier producto del mundo", NARANJA))
add(parrafo(run("¿Viste algo en una página de Estados Unidos o de China y no sabés cómo traerlo? Pegás el "
                "enlace en NiJu y listo. La app lee esa página, saca el nombre, el precio y la foto, y te dice "
                "cuánto te sale puesto en tu casa.", sz=21)))
add(parrafo(run("Si decís que sí, nosotros nos encargamos de todo. Vos pagás en pesos, acá.", b=True, sz=21)))
add(espacio(160))
add(escalera([
    ("Verificamos", "Chequeamos que el vendedor sea confiable antes de poner un peso."),
    ("Compramos", "Pagamos allá con nuestros medios."),
    ("Hacemos la aduana", "El trámite lo hacemos nosotros."),
    ("Te lo llevamos", "Hasta la puerta de tu casa, con seguimiento."),
]))
add(salto_pagina())

# 8
add(bloque_numerado(8, "«Pedí y que compitan»: al revés de siempre", VIOLETA))
add(parrafo(run("Esta es la idea más distinta de todas, y da vuelta la forma en que se compra desde siempre.",
                b=True, sz=22)))
add(parrafo(run("Hoy funciona así: alguien decide qué vender, lo pone en la vidriera, y vos elegís entre lo que "
                "ese alguien decidió tener. La oferta espera y vos buscás.", sz=21)))
add(parrafo(run("Acá es al revés: vos decís qué querés y cuánto pagás, dejás una seña, y salen a buscártelo. "
                "Tu pedido se junta con el de todos los que pidieron lo mismo, y compiten por servirte "
                "ferreterías con mercadería parada, importadores y mayoristas. El que lo consigue a tu precio, "
                "se lo lleva. Si nadie lo consigue, te devolvemos la seña completa.", sz=21)))
add(espacio(160))
add(tabla_datos(
    ["Como es hoy en todos lados", "Como es en NiJu"],
    [["El vendedor adivina qué comprar", "Ve demanda real, con seña puesta"],
     ["Vos perseguís el precio", "El precio te persigue a vos"],
     ["La mercadería parada es pérdida", "La mercadería parada gana pedidos"],
     ["Comprás y después vendés", "Vendés y después comprás"]],
    [4819, 4819]))
add(espacio(140))
add(recuadro("Y hay un efecto secundario enorme: todo lo que la gente pide y nadie consigue nos dice "
             "exactamente qué le falta al país, con nombre, apellido y plata comprometida.",
             "Lo que esto nos deja a nosotros", VIOLETA, "F1EBFE"))
add(salto_pagina())

# 9
add(bloque_numerado(9, "Compra grupal: cuantos más somos, más barato", VERDE))
add(parrafo(run("Juntamos a todas las personas que quieren lo mismo y compramos de una sola vez. Al comprar "
                "mucho, baja el costo por unidad, y ese ahorro vuelve al precio.", sz=21)))
add(parrafo(run("Lo importante: el precio baja para todos, también para el que reservó primero. Por eso cada "
                "uno invita a otros — le conviene. La publicidad la hacen los clientes.", b=True, sz=21)))
add(espacio(160))
add(grafico_barras([
    ("1 persona",    118, "$ 118.000", "precio de lista", False),
    ("7 personas",   109.7, "$ 109.700", "baja 7 %", False),
    ("12 personas",  102.7, "$ 102.700", "baja 13 %", False),
    ("20 personas",  94.4, "$ 94.400",  "baja 20 %", False),
    ("32 personas",  87.3, "$ 87.300",  "baja 26 %", True),
], "Una prensa de tazas: cómo baja el precio a medida que se suma gente", AZUL, VERDE))
add(espacio(120))
add(parrafo(run("Entre comprar solo y comprar con 31 personas más hay 30.700 pesos de diferencia. "
                "Por el mismo producto, en la misma semana.", sz=20, color=GRIS_TX)))
add(espacio(260))

# 10
add(bloque_numerado(10, "Preventa con seña: nadie arriesga de más", VERDE))
add(parrafo(run("Funciona parecido, pero al revés desde el lado del negocio: no se compra una sola unidad "
                "hasta que haya suficientes personas anotadas. Cada una deja el 30 % de seña.", sz=21)))
add(parrafo(run("Para el cliente: si no se junta el mínimo, se le devuelve todo. Para nosotros: vendemos antes "
                "de comprar, así que casi no hace falta poner plata propia.", sz=21)))
add(espacio(140))
add(recuadro("Esta es la parte que hace que un negocio de importación no necesite un capital grande para "
             "arrancar. Se vende primero y se compra después.", "Por qué esto es clave", VERDE, "E8F7EF"))
add(salto_pagina())

# 11
add(bloque_numerado(11, "Te resuelve todo lo impositivo"))
add(parrafo(run("Traer algo del exterior tiene reglas: hay un monto que está exento de impuestos, hay límites "
                "de peso y de valor, y según el caso conviene un camino u otro. La mayoría de la gente no "
                "las conoce y se entera tarde.", sz=21)))
add(parrafo(run("NiJu hace dos cosas. Antes de comprar, te dice cuánto vas a pagar y qué camino conviene. "
                "Después de comprar, te deja armada una carpeta con todo lo que hay que declarar, lista para "
                "llevarle al contador.", sz=21)))
add(espacio(160))
add(fichas([
    ("Antes de comprar", "Calculadora que compara los dos regímenes y te dice cuál sale más barato.", AZUL),
    ("Después de comprar", "Carpeta con qué podés computar, qué es costo y qué te queda a favor.", VERDE),
    ("Para el contador", "Se descarga en un archivo que se abre en Excel.", VIOLETA),
], 3))
add(espacio(160))
add(recuadro("Aclaración importante y honesta: la app organiza la información, no reemplaza a un contador. "
             "Los valores están cargados pero todavía no fueron verificados con un profesional, y así está "
             "avisado dentro de la aplicación.", "Lo que NO hace", ROJO, "FDECEE"))
add(espacio(260))

# 12
add(bloque_numerado(12, "Compra por mayor, con proveedores verificados"))
add(parrafo(run("Para el que quiere comprar cantidad y revender. Hay un calculador que te dice cuánto sale "
                "traer un lote completo, y un directorio de importadores.", sz=21)))
add(parrafo(run("Ningún proveedor aparece como confiable porque sí: tiene que juntar 70 puntos sobre 100 y "
                "cumplir todos los controles críticos.", sz=21)))
add(espacio(160))
add(tabla_datos(["Control que tiene que pasar", "Cuánto suma", "¿Obligatorio?"],
                [["CUIT activo en ARCA", "25 puntos", "Sí"],
                 ["Inscripto en el Registro de Importadores", "20 puntos", "Sí"],
                 ["Tres referencias comerciales chequeadas", "15 puntos", "No"],
                 ["Sin reclamos graves abiertos", "10 puntos", "Sí"],
                 ["Contrato firmado con NiJu", "5 puntos", "Sí"]],
                [5400, 2200, 2038]))
add(salto_pagina())

# 13, 14, 15
add(bloque_numerado(13, "NiJu Directo: nuestros propios productos", NARANJA))
add(parrafo(run("Además de comparar lo que venden otros, vendemos productos nuestros: con stock propio, "
                "garantía nuestra y entrega en 48 horas. Acá el margen es entero nuestro.", sz=21)))
add(espacio(220))

add(bloque_numerado(14, "Un solo carrito y un solo lugar para hablar"))
add(parrafo(run("Aunque compres en cinco tiendas distintas, hay un solo carrito. Y hay una sola bandeja de "
                "mensajes para hablar con la tienda de acá, con el vendedor de afuera y con nosotros.", sz=21)))
add(espacio(140))
add(fichas([
    ("5 formas de recibirlo", "A domicilio, express en el día, punto de retiro, correo o nuestro showroom.", AZUL),
    ("7 formas de pagar", "Mercado Pago, tarjeta, débito, transferencia con 10 % off, efectivo, cripto o saldo.", VERDE),
    ("1 sola conversación", "Todo en la misma bandeja, sin saltar entre aplicaciones.", VIOLETA),
], 3))
add(espacio(220))

add(bloque_numerado(15, "Se instala en el celular como una aplicación"))
add(parrafo(run("No hace falta bajarla de ninguna tienda de aplicaciones: se abre en el navegador y se puede "
                "instalar con un toque. Tiene modo de día y modo de noche, funciona en teléfono y en "
                "computadora, y el valor del dólar se actualiza solo cada cinco minutos.", sz=21)))
add(salto_pagina())

# ============================ PARTE 2 ============================
add(titulo("Parte 2 — Lo que ve únicamente el dueño", 1))
add(parrafo(run("Estas cinco herramientas están detrás de una clave. No aparecen para el público: son el "
                "tablero de control del negocio.", sz=21, color=GRIS_TX)))
add(espacio(200))

add(bloque_numerado(16, "Radar de oportunidades", VIOLETA))
add(parrafo(run("La app ve algo que ninguna tienda ve: qué buscó la gente y no encontró barato. Una tienda "
                "sabe lo que vendió; nosotros sabemos lo que la gente quiso y no pudo comprar.", sz=21)))
add(parrafo(run("El radar cruza cuatro señales y arma una lista de qué conviene traer al país.", sz=21)))
add(espacio(160))
add(tabla_datos(["Señal que deja la gente", "Cuánto pesa", "Qué significa"],
                [["Pidió algo por «Traelo por mí»", "8 puntos", "Está dispuesto a pagar. Vale por ocho búsquedas."],
                 ["Puso alerta de precio", "4 puntos", "Lo quiere, pero a otro precio."],
                 ["Lo dejó en el carrito", "3 puntos", "Estuvo a un paso de comprar."],
                 ["Lo buscó", "1 punto", "Le interesa."]],
                [3400, 1600, 4638]))
add(espacio(140))
add(recuadro("Después mide cuánto más caro está acá que trayéndolo. Si acá cuesta más de 1,8 veces lo que "
             "sale importarlo, aparece marcado como oportunidad.", "La regla del radar", VIOLETA, "F1EBFE"))
add(salto_pagina())

add(bloque_numerado(17, "El nicho elegido, con todos los números", VERDE))
add(parrafo(run("El primer negocio propio: máquinas chicas para emprendedores y los insumos que esas máquinas "
                "consumen. Prensas de tazas, planchas de estampado, cortadoras de vinilo, moldes.", sz=21)))
add(parrafo(run("La lógica es la de la maquinita de afeitar: la máquina se vende casi al costo, y el negocio "
                "está en el repuesto que el cliente compra todos los meses durante años.", b=True, sz=21)))
add(espacio(160))
add(grafico_barras([
    ("Vender la máquina (una vez)", 21, "$ 21.235", "margen del 18 %", False),
    ("Insumos de UN mes",           201, "$ 201.263", "por cada cliente", True),
], "Sublimación de tazas: de dónde sale la plata", AZUL, VERDE))
add(espacio(140))
add(tabla_datos(["La cuenta completa a dos años", "Resultado"],
                [["Lo que deja vender la máquina", "$ 21.235"],
                 ["Lo que deja el insumo cada mes", "$ 201.263"],
                 ["En cuánto recuperás el costo de la máquina", "1 mes"],
                 ["LO QUE VALE UN SOLO CLIENTE EN 24 MESES", "$ 1.620.412"]],
                [6400, 3238], resaltar=3))
add(espacio(140))
add(recuadro("Un hallazgo que cambió el plan: estas máquinas son pesadas y baratas por kilo, así que por avión "
             "el flete se come la ganancia. Van por barco, o se compran acá. El insumo, en cambio, es liviano y "
             "caro: ese sí viaja por avión. El negocio nunca fue la máquina.",
             "Lo que descubrimos haciendo las cuentas", NARANJA, "FFF1E8"))
add(salto_pagina())

add(bloque_numerado(18, "Generador de pedidos de cotización"))
add(parrafo(run("Cuando le pedís precio a un proveedor chino y te contesta «cincuenta centavos», ese dato no "
                "sirve para nada: no sabés a qué cantidad, cuánto pesa la caja ni qué impuestos paga.", sz=21)))
add(parrafo(run("La app escribe el pedido como lo escribiría un importador con experiencia, con las nueve "
                "preguntas que hay que hacer, en inglés y en castellano. Lo copiás y lo mandás. Cuando llegan "
                "las respuestas las cargás y la app recalcula todo el negocio sola.", sz=21)))
add(espacio(220))

add(bloque_numerado(19, "Pilotos: probar antes de arriesgar"))
add(parrafo(run("Antes de traer mil unidades, se traen treinta. Vos vas anotando las ventas y la app te dice "
                "sola si el producto funciona o no. Sin opiniones: con la cuenta.", sz=21)))
add(espacio(160))
add(tabla_datos(["Si el lote se agota en…", "El veredicto de la app"],
                [["8 semanas o menos", "Funciona. Traelo en serio."],
                 ["Entre 8 y 20 semanas", "Dudoso. Bajá el precio o cambiá la foto."],
                 ["Más de 20 semanas", "No rota. No pongas un peso más."]],
                [4819, 4819], resaltar=0))
add(espacio(220))

add(bloque_numerado(20, "Marketing automático y contabilidad"))
add(parrafo(run("La app detecta sola las mejores ofertas del día, arma las publicaciones para Instagram, "
                "Facebook y TikTok con su texto y su imagen, y las deja programadas.", sz=21)))
add(parrafo(run("Y del lado contable, arma los comprobantes de la comisión discriminando el IVA como "
                "corresponde, calcula Ingresos Brutos por provincia y arma el estado de resultados.", sz=21)))
add(salto_pagina())

# ============================ PENDIENTES ============================
add(titulo("Lo que todavía falta para que entre plata", 1))
add(parrafo(run("Esta parte es importante y conviene decirla derecho: la aplicación está construida y "
                "funciona, pero hay cinco conexiones pendientes. Sin ellas es una herramienta muy buena "
                "que todavía no cobra.", sz=21)))
add(espacio(200))
add(tabla_datos(["Qué falta", "Por qué es necesario", "Estado"],
    [["Conectar Mercado Pago", "Sin esto no entra un peso: ni ventas propias, ni señas.", "PENDIENTE"],
     ["Conectar Mercado Libre", "Es la tienda que permite verificar los precios del nicho.", "PENDIENTE"],
     ["Almacén de datos compartido", "Sin esto, cada persona ve solo lo suyo en la compra grupal.", "PENDIENTE"],
     ["Validar impuestos con un contador", "Los valores están cargados pero sin confirmar.", "PENDIENTE"],
     ["Sociedad, CUIT y certificado", "Hace falta para emitir facturas de verdad.", "PENDIENTE"]],
    [3000, 4638, 2000]))
add(espacio(200))
add(recuadro("Lo que ya funciona de verdad hoy: la búsqueda en seis cadenas argentinas con precios reales y "
             "actualizados, la cotización del dólar en vivo, la comparación de productos, el cálculo de "
             "impuestos, el lector de enlaces de cualquier tienda del mundo, y todo el tablero del dueño.",
             "Y esto ya anda", VERDE, "E8F7EF"))
add(espacio(300))
add(parrafo(run("NiJu", b=True, sz=40, color=TINTA, font="Calibri Light"), despues=60, jc="center"))
add(parrafo(run("Un solo lugar. Una app. El mundo a tus dedos:", sz=22, color=GRIS_TX), despues=20, jc="center"))
add(parrafo(run("sin trámites, sin riesgos, del deseo a tu casa.", sz=22, color=GRIS_TX), despues=0, jc="center"))
