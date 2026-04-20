export type RubroId = 'turismo' | 'inmobiliaria' | 'gastronomia' | 'vinoteca' | 'heladeria' | 'receptivo'

export interface RubroConfig {
  id: RubroId
  label: string
  emoji: string
  color: string          // Tailwind gradient class
  bgColor: string        // card bg
  accentColor: string    // hex for canvas
  description: string
  inputType: 'image' | 'form' | 'both'
  imageLabel: string
  formFields: FormField[]
  extractionPrompt: string
  textPrompt: string
  overlayFields: OverlayConfig
  searchQueryHint: string
  ctaText: string
  whatsappText: string
}

export interface FormField {
  key: string
  label: string
  placeholder: string
  type: 'text' | 'number' | 'textarea' | 'select'
  options?: string[]
  required?: boolean
}

export interface OverlayConfig {
  line1Key: string       // main big text (e.g. destination, address, dish)
  line2Key?: string      // subline (price, rooms, etc.)
  badgeKey?: string      // optional badge (nights, m2, etc.)
}

const RUBROS: Record<RubroId, RubroConfig> = {
  turismo: {
    id: 'turismo',
    label: 'Turismo',
    emoji: '✈️',
    color: 'from-sky-500 to-blue-700',
    bgColor: 'bg-sky-50',
    accentColor: '#0ea5e9',
    description: 'Flyers de viajes, paquetes y salidas grupales',
    inputType: 'both',
    imageLabel: 'Subí el flyer del paquete',
    formFields: [
      { key: 'destination', label: 'Destino', placeholder: 'Ej: Aruba', type: 'text', required: true },
      { key: 'country', label: 'País', placeholder: 'Ej: Antillas Holandesas', type: 'text' },
      { key: 'dates', label: 'Fecha de salida', placeholder: 'Ej: 15/07/2026', type: 'text' },
      { key: 'nights', label: 'Noches', placeholder: 'Ej: 7', type: 'number' },
      { key: 'hotel', label: 'Hotel', placeholder: 'Ej: Manchebo Beach Resort', type: 'text' },
      { key: 'price', label: 'Precio (USD)', placeholder: 'Ej: desde USD 1800', type: 'text' },
      { key: 'includes', label: 'Incluye', placeholder: 'Ej: vuelos, hotel, traslados', type: 'textarea' },
    ],
    extractionPrompt: `Sos un extractor de datos de flyers de viajes. Respondé SOLO con JSON puro, sin texto adicional.
Formato EXACTO:
{
  "postType": "salida" o "promocion",
  "destination": "nombre del destino",
  "country": "nombre del país",
  "price": "desde USD XXXX o vacío",
  "dates": "fecha de salida o vacío",
  "nights": "cantidad de noches como string",
  "hotel": "nombre del hotel",
  "includes": ["item1", "item2"],
  "searchQuery": "3-6 palabras en inglés para buscar fotos"
}`,
    textPrompt: `Sos un community manager rioplatense de una agencia de viajes.
Respondé SOLO con JSON válido: {"facebook": "...", "instagram": "..."}
Generá textos entusiastas para cada red. Usá emojis Unicode reales: ✈️ 🏖️ 🌴 🌟 💰 🏨 🚌 📲
Máximo 200 palabras por red. Estilo rioplatense.`,
    overlayFields: { line1Key: 'destination', line2Key: 'price', badgeKey: 'nights' },
    searchQueryHint: 'beach resort destination',
    ctaText: 'Armá tu post de viaje',
    whatsappText: '¡Hola! Vi el post del viaje y me interesa saber más 🌴',
  },

  inmobiliaria: {
    id: 'inmobiliaria',
    label: 'Inmobiliaria',
    emoji: '🏠',
    color: 'from-emerald-500 to-teal-700',
    bgColor: 'bg-emerald-50',
    accentColor: '#10b981',
    description: 'Propiedades en venta o alquiler para tu inmobiliaria',
    inputType: 'both',
    imageLabel: 'Subí la foto de la propiedad o el flyer',
    formFields: [
      { key: 'title', label: 'Título', placeholder: 'Ej: Departamento en Palermo', type: 'text', required: true },
      { key: 'address', label: 'Dirección / Zona', placeholder: 'Ej: Palermo Soho, CABA', type: 'text' },
      { key: 'operation', label: 'Operación', placeholder: '', type: 'select', options: ['Venta', 'Alquiler', 'Alquiler temporario'] },
      { key: 'price', label: 'Precio', placeholder: 'Ej: USD 180.000 o $450.000/mes', type: 'text' },
      { key: 'rooms', label: 'Ambientes', placeholder: 'Ej: 3', type: 'number' },
      { key: 'sqm', label: 'Superficie (m²)', placeholder: 'Ej: 75', type: 'number' },
      { key: 'highlights', label: 'Destacados', placeholder: 'Ej: piscina, cochera, luminoso', type: 'textarea' },
    ],
    extractionPrompt: `Sos un extractor de datos de flyers inmobiliarios. Respondé SOLO con JSON puro.
Formato EXACTO:
{
  "title": "tipo de propiedad y zona",
  "address": "dirección o barrio",
  "operation": "Venta" | "Alquiler" | "Alquiler temporario",
  "price": "precio con moneda o vacío",
  "rooms": "cantidad de ambientes",
  "sqm": "metros cuadrados",
  "highlights": ["highlight1", "highlight2"],
  "searchQuery": "3-5 palabras en inglés para buscar fotos del tipo de propiedad"
}`,
    textPrompt: `Sos un community manager de una inmobiliaria argentina.
Respondé SOLO con JSON válido: {"facebook": "...", "instagram": "..."}
Generá textos atractivos para publicar la propiedad. Usá emojis: 🏠 🏡 🔑 💰 📐 🛏️ 🏊 🚗 📲 ✨
Máximo 200 palabras por red. Tono profesional pero cercano.`,
    overlayFields: { line1Key: 'title', line2Key: 'price', badgeKey: 'sqm' },
    searchQueryHint: 'apartment interior modern',
    ctaText: 'Publicá tu propiedad',
    whatsappText: '¡Hola! Vi la propiedad publicada y me gustaría saber más 🏠',
  },

  gastronomia: {
    id: 'gastronomia',
    label: 'Gastronomía',
    emoji: '🍽️',
    color: 'from-orange-500 to-red-600',
    bgColor: 'bg-orange-50',
    accentColor: '#f97316',
    description: 'Platos especiales, menús y promociones de tu restaurante',
    inputType: 'both',
    imageLabel: 'Subí la foto del plato o el flyer del menú',
    formFields: [
      { key: 'dish', label: 'Plato / Promoción', placeholder: 'Ej: Bife de chorizo con papas', type: 'text', required: true },
      { key: 'restaurant', label: 'Nombre del restaurante', placeholder: 'Ej: El Asador de San Telmo', type: 'text' },
      { key: 'price', label: 'Precio', placeholder: 'Ej: $8500', type: 'text' },
      { key: 'category', label: 'Categoría', placeholder: '', type: 'select', options: ['Plato del día', 'Menú especial', 'Promo', 'Happy hour', 'Nueva carta', 'Evento'] },
      { key: 'description', label: 'Descripción', placeholder: 'Ej: madurado 45 días, a la parrilla, con chimichurri', type: 'textarea' },
      { key: 'availability', label: 'Disponibilidad', placeholder: 'Ej: todos los viernes, solo este fin de semana', type: 'text' },
    ],
    extractionPrompt: `Sos un extractor de datos de flyers gastronómicos. Respondé SOLO con JSON puro.
Formato EXACTO:
{
  "dish": "nombre del plato o promoción",
  "restaurant": "nombre del restaurante",
  "price": "precio o vacío",
  "category": "tipo de publicación",
  "description": "descripción del plato",
  "availability": "disponibilidad o vacío",
  "searchQuery": "3-5 palabras en inglés para buscar fotos del plato"
}`,
    textPrompt: `Sos un community manager de un restaurante argentino.
Respondé SOLO con JSON válido: {"facebook": "...", "instagram": "..."}
Generá textos apetitosos y con onda para publicar el plato o promo. Usá emojis: 🍽️ 🥩 🍷 🔥 😋 👨‍🍳 🌟 📲 ✨
Máximo 150 palabras por red. Tono cálido, convocante.`,
    overlayFields: { line1Key: 'dish', line2Key: 'price' },
    searchQueryHint: 'food restaurant dish gourmet',
    ctaText: 'Publicá tu plato',
    whatsappText: '¡Hola! Vi el plato que publicaron y quiero reservar 🍽️',
  },

  vinoteca: {
    id: 'vinoteca',
    label: 'Vinoteca',
    emoji: '🍷',
    color: 'from-purple-600 to-rose-700',
    bgColor: 'bg-purple-50',
    accentColor: '#9333ea',
    description: 'Vinos, maridajes y promociones de tu vinoteca o bodega',
    inputType: 'both',
    imageLabel: 'Subí la foto de la botella, etiqueta o lista de precios',
    formFields: [
      { key: 'marca', label: 'Marca / Bodega', placeholder: 'Ej: Zuccardi, Luigi Bosca, El Origen', type: 'text', required: true },
      { key: 'varietal', label: 'Uva / Varietal', placeholder: 'Ej: Malbec, Cabernet Sauvignon, Blend', type: 'text' },
      { key: 'año', label: 'Cosecha (año)', placeholder: 'Ej: 2022', type: 'text' },
      { key: 'categoria', label: 'Categoría', placeholder: '', type: 'select', options: [
        'Joven', 'Roble / Oak', 'Reserva', 'Gran Reserva', 'Crianza',
        'Single Vineyard', 'Estate / Finca Propia', 'Blend / Corte',
        'Premium', 'Ultra Premium', 'Ícono',
        'Late Harvest / Cosecha Tardía',
        'Espumante Brut Nature', 'Espumante Extra Brut', 'Espumante Brut',
        'Método Tradicional', 'Método Charmat', 'Pet Nat / Ancestral',
        'Vino Naranja', 'Natural', 'Orgánico / Biodinámico',
      ]},
      { key: 'price', label: 'Precio', placeholder: 'Ej: $15.000', type: 'text' },
      { key: 'pairing', label: 'Maridaje', placeholder: 'Ej: carnes rojas, quesos estacionados', type: 'text' },
      { key: 'highlight', label: 'Destacado', placeholder: 'Ej: 94 pts Parker, Medalla de Oro', type: 'text' },
      { key: 'description', label: 'Notas de cata', placeholder: 'Ej: frutos rojos, taninos suaves, final largo', type: 'textarea' },
    ],
    extractionPrompt: `Sos un sommelier experto en extracción de datos de etiquetas, fotos de botellas y listas de precios de vinos. Respondé SOLO con JSON puro, sin texto adicional.

REGLAS CRÍTICAS — leelas con atención:
- "marca": la BODEGA o marca comercial (ej: "Zuccardi", "Luigi Bosca", "Finca El Origen", "Clos de Chacras"). NUNCA un precio.
- "varietal": la UVA principal o tipo (ej: "Malbec", "Cabernet Franc", "Torrontés", "Blend", "Brut Nature"). Vacío si no se ve.
- "año": el AÑO DE COSECHA con 4 dígitos (ej: "2022", "2019"). Solo si aparece claramente. Vacío si no.
- "precio": el PRECIO en pesos o dólares con símbolo (ej: "$5.099", "$15.000", "USD 25"). Si no hay precio, vacío.
- "categoria": elegí UNA de esta lista (o vacío si no aplica):
  Joven | Roble/Oak | Reserva | Gran Reserva | Crianza | Single Vineyard | Estate/Finca Propia | Blend/Corte | Premium | Ultra Premium | Ícono | Late Harvest | Espumante Brut Nature | Espumante Extra Brut | Espumante Brut | Método Tradicional | Método Charmat | Pet Nat/Ancestral | Vino Naranja | Natural | Orgánico/Biodinámico
- "searchQuery": 3-4 palabras en INGLÉS para buscar fotos de ambiente vinícola. Usá el varietal y estilo (ej: "Malbec vineyard Mendoza dark", "sparkling wine cellar elegant"). NUNCA el nombre de la bodega.

Si la imagen es una LISTA DE PRECIOS con varios vinos, extraé el PRIMER vino o el más destacado.

Formato EXACTO (respondé solo esto):
{
  "marca": "nombre de la bodega",
  "varietal": "uva o tipo",
  "año": "año de cosecha o vacío",
  "categoria": "categoría o vacío",
  "precio": "precio con símbolo o vacío",
  "pairing": "maridaje sugerido o vacío",
  "highlight": "puntuación, medalla, diferencial o vacío",
  "description": "notas de cata o descripción o vacío",
  "searchQuery": "atmosphere keywords in english"
}`,
    textPrompt: `Sos un enólogo y sommelier experto de una vinoteca argentina de alta gama.
Respondé SOLO con JSON válido con esta estructura exacta (sin texto fuera del JSON):
{
  "enologist": "",
  "story": "",
  "cta": "",
  "facebook": "Post completo para Facebook con estas secciones claramente incluidas en el texto:\\n\\nEmpezá con MARCA — VARIETAL en mayúsculas, año y categoría si hay. Precio si está disponible.\\n\\nLuego escribí un párrafo que empiece con '🍷 Notas del enólogo:' describiendo el método de crianza, el color, los aromas en nariz y la boca con vocabulario técnico pero accesible.\\n\\nSeguí con un párrafo que empiece con '✨ Historia y maridaje:' contando el origen de la bodega, el terruño, y con qué platos marida perfectamente.\\n\\nTerminá con CTA de 1 línea.\\n\\nUsá emojis naturalmente a lo largo del texto: 🍷🍇🥂✨🌿🥩🧀🫐🌹🏔️. Tono sofisticado y rioplatense. Mínimo 180 palabras.",
  "instagram": "Post para Instagram. Estructura:\\n\\nAbrí con MARCA + VARIETAL + año destacados. Luego 2-3 líneas de notas de cata ('Notas del enólogo:') con emojis. Después 2-3 líneas de historia y maridaje ('Historia y maridaje:') que generen deseo. CTA en 1 línea. Hashtags al final.\\n\\nUsá emojis generosamente: 🍷🍇✨🥂🌿🫐🥩🌹🏔️. Hashtags: #vino #vinoteca #malbec #argentina #sommelier #vinoargentino más los del varietal y bodega. Mínimo 100 palabras antes de los hashtags."
}
Los campos enologist, story y cta van vacíos — todo va dentro de facebook e instagram. Mencioná siempre marca, varietal, categoría y año si están disponibles. Estilo rioplatense sofisticado.`,
    overlayFields: { line1Key: 'varietal', line2Key: 'marca', badgeKey: 'categoria' },
    searchQueryHint: 'red wine vineyard cellar elegant dark',
    ctaText: 'Publicá tu vino',
    whatsappText: '¡Hola! Vi el vino que publicaron y me interesa 🍷',
  },
  heladeria: {
    id: 'heladeria',
    label: 'Heladería',
    emoji: '🍦',
    color: 'from-pink-400 to-rose-500',
    bgColor: 'bg-pink-50',
    accentColor: '#f43f5e',
    description: 'Promos, gustos especiales y novedades de tu heladería',
    inputType: 'both',
    imageLabel: 'Subí la foto del cartel, pizarrón o promo',
    formFields: [
      { key: 'promo', label: 'Promo / Novedad', placeholder: 'Ej: Con 1kg te regalamos 1/2 kg gratis', type: 'text', required: true },
      { key: 'producto', label: 'Producto / Gusto', placeholder: 'Ej: Nutella, Dulce de leche granizado', type: 'text' },
      { key: 'precio', label: 'Precio', placeholder: 'Ej: $3500 el kg', type: 'text' },
      { key: 'vigencia', label: 'Vigencia', placeholder: 'Ej: Solo este fin de semana', type: 'text' },
      { key: 'local', label: 'Nombre del local', placeholder: 'Ej: Heladería La Abuela', type: 'text' },
    ],
    extractionPrompt: `Sos un experto en leer carteles, pizarrones y chalkboards de heladerías artesanales, incluyendo escritura a mano con tiza. Respondé SOLO con JSON puro, sin texto adicional.

INSTRUCCIONES DE LECTURA:
- Los carteles pueden estar escritos a mano con tiza sobre pizarrón negro o verde. Leelos con mucha atención.
- Si hay texto parcialmente borroso, intentá inferir el mensaje más probable en contexto de heladería argentina.
- No confundas precios con nombres de productos. Los precios suelen tener "$" o "pesos" o un número aislado.
- Si hay múltiples promos, tomá la más destacada (más grande o subrayada).

PRECIOS ARGENTINOS — MUY IMPORTANTE:
- En Argentina el punto "." es separador de miles y la coma "," es decimal.
- $1.400 significa MIL CUATROCIENTOS pesos (no 1.40). $14.600 = catorce mil seiscientos pesos.
- Los helados artesanales en Argentina cuestan entre $1.000 y $30.000 el kilo. NUNCA menos de $100.
- Si ves algo como "$1.46" ó "$2.35" es imposible — seguramente es "$1.460" ó "$2.350" y el punto decimal del PDF/foto se confundió.
- Copiá el precio TAL CUAL aparece escrito en el cartel, respetando el formato original.

CAMPOS:
- "promo": la promoción o novedad principal. Si no hay promo explícita pero hay un producto nuevo o destacado, ponelo como "Nuevo: [nombre]". Nunca vacío.
- "producto": el gusto, sabor o producto destacado (ej: "Nutella", "Dulce de leche con brownie", "Maracuyá") — vacío si no se menciona
- "precio": precio si aparece claramente (ej: "$3500 el kg", "2x1 $800") — vacío si no
- "vigencia": validez temporal si se menciona (ej: "solo hoy", "este fin de semana") — vacío si no
- "local": nombre del local o heladería si aparece — vacío si no

Formato EXACTO:
{
  "promo": "descripción de la promo",
  "producto": "producto o gusto o vacío",
  "precio": "precio o vacío",
  "vigencia": "vigencia o vacío",
  "local": "nombre del local o vacío"
}`,
    textPrompt: `Sos un community manager rioplatense de una heladería artesanal. Respondé SOLO con JSON válido:
{"facebook": "...", "instagram": "..."}

Generá textos que transmitan antojo, frescura y tentación. El objetivo es que la gente quiera ir a la heladería ahora mismo.
- Mencioná la promo de forma clara y atractiva
- Usá emojis: 🍦 🍨 🍧 😍 🤤 ❄️ ✨ 🎉 💛 📲
- Tono: cercano, alegre, con onda barrial
- Facebook: más completo, con la promo bien explicada. Máximo 150 palabras.
- Instagram: más corto y visual, con hashtags al final: #heladeria #helado #heladoartesanal #antojo #promo (agregá los del producto si hay). Máximo 80 palabras.`,
    overlayFields: { line1Key: 'promo', line2Key: 'precio', badgeKey: 'producto' },
    searchQueryHint: 'artisan ice cream gelato colorful scoop',
    ctaText: 'Publicá tu promo',
    whatsappText: '¡Hola! Vi la promo de helado y quiero saber más 🍦',
  },

  receptivo: {
    id: 'receptivo',
    label: 'Turismo Receptivo',
    emoji: '🐋',
    color: 'from-cyan-500 to-teal-700',
    bgColor: 'bg-cyan-50',
    accentColor: '#0891b2',
    description: 'Excursiones, avistajes y actividades para operadores locales',
    inputType: 'both',
    imageLabel: 'Subí el flyer de la excursión o actividad',
    formFields: [
      { key: 'actividad', label: 'Actividad', placeholder: 'Ej: Avistaje de ballenas', type: 'text', required: true },
      { key: 'destino', label: 'Destino / Zona', placeholder: 'Ej: Puerto Madryn, Patagonia', type: 'text' },
      { key: 'operador', label: 'Nombre del operador', placeholder: 'Ej: Fugu Tours', type: 'text' },
      { key: 'precio', label: 'Precio por persona', placeholder: 'Ej: $150.000', type: 'text' },
      { key: 'temporada', label: 'Temporada / Fechas', placeholder: 'Ej: 15 junio al 15 diciembre 2026', type: 'text' },
      { key: 'reserva_hasta', label: 'Reservar antes de', placeholder: 'Ej: 31 de marzo', type: 'text' },
      { key: 'valido_hasta', label: 'Precio válido hasta', placeholder: 'Ej: 31/08', type: 'text' },
      { key: 'incluye', label: 'Incluye', placeholder: 'Ej: traslado, guía bilingüe, almuerzo', type: 'textarea' },
    ],
    extractionPrompt: `Sos un extractor de datos de flyers de operadores de turismo receptivo y excursiones. Respondé SOLO con JSON puro, sin texto adicional.

REGLAS:
- "actividad": la excursión o actividad principal (ej: "Avistaje de ballenas", "Excursión Península Valdés", "Trekking Glaciar Perito Moreno")
- "destino": lugar o zona geográfica (ej: "Puerto Madryn", "Patagonia", "Bariloche")
- "operador": nombre del operador o agencia si aparece (ej: "Fugu Tours") — vacío si no
- "precio": precio POR PERSONA si aparece, con símbolo (ej: "$150.000", "$150.000 por persona") — vacío si no. Si hay varios precios, tomá el más destacado o el primero.
- "temporada": fechas de la temporada o período de operación (ej: "15 junio al 15 diciembre 2026", "Temporada 2026") — vacío si no
- "reserva_hasta": fecha límite para reservar con precio preferencial (ej: "31 de marzo") — vacío si no
- "valido_hasta": fecha hasta la que es válido ese precio (ej: "31 de agosto") — vacío si no
- "promo": slogan o frase promocional si hay (ej: "¡Congelamos nuestros precios!") — vacío si no
- "incluye": qué incluye la excursión si se menciona (lista de ítems) — vacío si no
- "searchQuery": 4-6 palabras en INGLÉS para buscar fotos del destino/actividad (ej: "whale watching patagonia ocean wildlife", "glacier trekking patagonia mountain")

Si el flyer tiene múltiples excursiones, extraé la más destacada (más grande, primera, o la que tenga precio más prominente).

Formato EXACTO:
{
  "actividad": "nombre de la excursión",
  "destino": "destino o zona",
  "operador": "nombre del operador o vacío",
  "precio": "precio o vacío",
  "temporada": "temporada o vacío",
  "reserva_hasta": "fecha límite de reserva o vacío",
  "valido_hasta": "validez del precio o vacío",
  "promo": "slogan promocional o vacío",
  "incluye": "lista de incluidos o vacío",
  "searchQuery": "atmosphere keywords in english"
}`,
    textPrompt: `Sos el community manager de un operador de turismo receptivo argentino. Respondé SOLO con JSON válido:
{"facebook": "...", "instagram": "..."}

Generá textos que transmitan aventura, naturaleza única e irrepetible, y urgencia para reservar.

FACEBOOK (mínimo 180 palabras):
- Abrí con la actividad y destino en mayúsculas o destacados
- Describí la experiencia de forma evocadora: qué se vive, qué se siente, qué hace única a esta excursión
- Mencioná la temporada y por qué es el momento ideal
- Si hay precio con fechas de validez o reserva anticipada, generá urgencia: "Precio congelado hasta [fecha]", "Reservá antes del [fecha] y asegurá el precio"
- Si hay operador, mencionalo con confianza como garantía de calidad
- Cerrá con CTA claro: cómo reservar, link en bio, WhatsApp
- Emojis: 🐋 🌊 🦅 🏔️ 🌿 ❄️ 🦭 🌅 ✨ 📲 🎒 🗺️ (usá los que apliquen al destino/actividad)

INSTAGRAM (mínimo 100 palabras antes de hashtags):
- Más visual y emocional, frases cortas con impacto
- Incluí precio y urgencia de reserva si los hay
- Hashtags al final: #patagonia #turismoreceptivo #excursion #argentina #naturaleza #wildlife #aventura más los específicos del destino y actividad (ballenas, glaciar, trekking, etc.)

Tono: apasionado, cercano, que inspire a vivir la experiencia.`,
    overlayFields: { line1Key: 'actividad', line2Key: 'precio', badgeKey: 'destino' },
    searchQueryHint: 'patagonia wildlife excursion nature argentina',
    ctaText: 'Publicá tu excursión',
    whatsappText: '¡Hola! Vi la excursión que publicaron y quiero reservar 🐋',
  },
}

export default RUBROS
export const RUBRO_LIST = Object.values(RUBROS)
