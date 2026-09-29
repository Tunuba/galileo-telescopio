// La obra de teatro de Galileo, en primera persona. De aquí leen el panel del maestro y la página del guion.
// Cada paso dura unos segundos, manda sus órdenes a los teléfonos y dice qué hace cada quien.
// Las órdenes se acumulan paso a paso: saltar a cualquier paso deja los telescopios como deben estar.

export const ROLES = {
  galileo: 'Galileo',
  aprendiz: 'Aprendiz',
  roma: 'Voz de Roma',
  nota: '',
};

export const REPARTO = [
  ['Galileo', 'Lleva casi todo el texto y usa el telescopio. Ropa oscura y, si se puede, barba.'],
  ['Aprendiz', 'Ayudante 1, en escena. Abre la obra dándole el telescopio a una persona del público, la acompaña en el viaje y después lleva el telescopio al público.'],
  ['Voz de Roma', 'Ayudante 2, en la PC con el panel del maestro. Golpea la mesa y dice una sola línea sin salir a escena.'],
];

export const UTILERIA = [
  'Un telescopio impreso con un teléfono dentro, conectado a la red GALILEO.',
  'Un segundo telescopio, si lo hay, para que miren más personas del público.',
  'Una mesa cerca de la PC para los tres golpes de la puerta.',
];

export const ANTES = [
  'Enciende todo con INICIAR.bat y espera a que el panel muestre los teléfonos conectados.',
  'Decidan antes a qué persona del público le darán el telescopio al principio. Galileo irá hasta ella.',
  'Cada teléfono se conecta a la red GALILEO, abre el cielo y entra en su telescopio.',
  'Quien lleva la obra escanea el código del control en el panel y avanza cada paso desde su teléfono, como diapositivas. También se puede avanzar en la PC con la barra espaciadora. Nada avanza solo; los segundos de cada paso son solo una guía.',
];

export const OBRA = [
  {
    titulo: 'El telescopio pasa al público',
    seg: 8,
    ordenes: { historia: false, abierto: false, modo: 'libre', objetivo: 0, zoom: 1, velocidad: 1 },
    prologo: true,
    acotacion: 'Sala a oscuras. El aprendiz entra con el telescopio y se lo da a una persona del público.',
    lineas: [
      ['aprendiz', 'Buenas noches. Necesito a alguien valiente. Toma este telescopio, mira por aquí y no lo sueltes.'],
    ],
    pc: 'Los telescopios empiezan cerrados.',
  },
  {
    titulo: 'Viaje por el espacio',
    seg: 12,
    ordenes: { abierto: true, historia: true, escena: 0 },
    prologo: true,
    acotacion: 'El telescopio se abre y la persona ve una estrella que se acerca.',
    lineas: [
      ['aprendiz', '¿Qué ves? Cuéntale a todos.'],
      ['nota', 'La persona cuenta lo que ve.'],
    ],
  },
  {
    titulo: 'Llegada a la Tierra',
    seg: 12,
    ordenes: { escena: 1 },
    prologo: true,
    acotacion: 'Galileo habla desde fuera de la sala, sin que lo vean.',
    lineas: [
      ['galileo', 'Sigue bajando. Te estoy esperando en Florencia.'],
    ],
  },
  {
    titulo: 'Florencia 1610',
    seg: 14,
    ordenes: { escena: 2 },
    prologo: true,
    acotacion: 'La persona camina por las calles de Florencia dentro del telescopio.',
    lineas: [
      ['aprendiz', 'Estás en Florencia, en el año 1610. Mira bien las calles.'],
    ],
  },
  {
    titulo: 'La casa de Galileo',
    seg: 10,
    ordenes: { escena: 3 },
    prologo: true,
    acotacion: 'La vista sube hacia la ventana de la casa.',
    lineas: [
      ['galileo', 'Esa ventana encendida es la mía. Sube.'],
    ],
  },
  {
    titulo: 'El cuarto de Galileo',
    seg: 3,
    ordenes: { escena: 4 },
    prologo: true,
    acotacion: 'La persona entra al cuarto de Galileo.',
    lineas: [],
  },
  {
    titulo: 'Galileo abre la puerta',
    seg: 10,
    ordenes: { puerta: true },
    prologo: true,
    acotacion: 'En el telescopio tocan la puerta, entra Galileo y saluda a la persona.',
    lineas: [
      ['aprendiz', '¿Quién entró?'],
      ['nota', 'La persona responde.'],
    ],
  },
  {
    titulo: 'Galileo va por su telescopio',
    seg: 12,
    ordenes: { historia: false, abierto: false },
    acotacion: 'El actor que hace de Galileo entra a la sala y camina directo hacia la persona del telescopio.',
    lineas: [
      ['galileo', '¡Ahí está mi telescopio! Gracias por traérmelo desde tan lejos. Buenas noches a todos. Me llamo Galileo Galilei y estamos en 1610.'],
    ],
    pc: 'Los telescopios se cierran mientras Galileo lo recoge.',
  },
  {
    titulo: 'Mi telescopio',
    seg: 22,
    ordenes: { abierto: true, objetivo: 0, zoom: 1 },
    acotacion: 'Galileo vuelve al centro, estira las tres partes del telescopio y lo muestra al público.',
    lineas: [
      ['galileo', 'Hace unos meses llegó una noticia de Holanda. Alguien puso dos lentes en un tubo y lo lejano se veía cerca. Yo fabriqué el mío. El primero agrandaba tres veces, este agranda veinte.'],
      ['aprendiz', 'Desde la torre de Venecia vimos llegar los barcos dos horas antes que nadie.'],
    ],
    pc: 'Los telescopios se abren solos.',
  },
  {
    titulo: 'La Luna',
    seg: 20,
    ordenes: { objetivo: 0, zoom: 0.5 },
    acotacion: 'Galileo apunta al cielo y mira por el telescopio.',
    lineas: [
      ['galileo', 'Los sabios dicen que la Luna es lisa y perfecta, como una perla. Pero miren, tiene montañas y valles.'],
      ['aprendiz', '¿Montañas en la Luna, maestro?'],
      ['galileo', 'Y hacen sombra cuando les da el Sol. La Luna es un mundo de piedra, como la Tierra.'],
    ],
  },
  {
    titulo: 'La Vía Láctea',
    seg: 10,
    ordenes: { zoom: 1.6 },
    acotacion: 'Galileo baja el telescopio y señala el cielo de un lado a otro.',
    lineas: [
      ['galileo', 'Y esa nube blanca que cruza el cielo son estrellas. Miles de estrellas que nadie había visto.'],
    ],
  },
  {
    titulo: 'Júpiter y sus lunas',
    seg: 20,
    ordenes: { objetivo: 1, zoom: 0.33, velocidad: 1 },
    acotacion: 'Galileo vuelve a mirar, cada vez más emocionado.',
    lineas: [
      ['galileo', 'El siete de enero miré a Júpiter y vi tres estrellitas en fila a su lado. Cada noche cambiaban de lugar, y luego apareció una cuarta.'],
      ['aprendiz', '¿Y qué son?'],
      ['galileo', 'Lunas. Cuatro lunas que dan vueltas alrededor de Júpiter. Entonces no todo gira alrededor de la Tierra.'],
    ],
  },
  {
    titulo: 'El público mira Júpiter',
    seg: 32,
    ordenes: { objetivo: 1, zoom: 0.33 },
    publico: true,
    acotacion: 'El aprendiz lleva el telescopio al público. Cada persona mira unos segundos y lo pasa a la de al lado. Galileo camina entre ellos.',
    lineas: [
      ['galileo', 'Muchos profesores ni quisieron asomarse a mi telescopio. Ustedes sí van a mirar. Cuenten las lunas. ¿Cuántas ven?'],
      ['nota', 'Esperan la respuesta del público.'],
      ['galileo', '¡Cuatro! Hoy se llaman Ío, Europa, Ganímedes y Calisto. Y una regla, nunca apunten un telescopio al Sol, porque quema los ojos.'],
    ],
    pc: 'Si hay un segundo telescopio, llévalo al otro lado del público. La obra sigue sola.',
  },
  {
    titulo: 'El público mira Saturno',
    seg: 14,
    ordenes: { objetivo: 2, zoom: 0.33 },
    publico: true,
    acotacion: 'Los telescopios siguen en el público.',
    lineas: [
      ['galileo', 'Ahora les cambio de planeta. ¿Qué forma tiene?'],
      ['nota', 'Esperan la respuesta del público.'],
      ['galileo', 'Yo vi un planeta con dos orejas. Ustedes lo ven mejor que yo, eso es un anillo.'],
    ],
  },
  {
    titulo: 'Las fases de Venus',
    seg: 16,
    ordenes: { objetivo: 3, zoom: 0.3, velocidad: 4 },
    acotacion: 'El aprendiz le devuelve el telescopio a Galileo, que mira otra vez.',
    lineas: [
      ['galileo', 'Venus cambia de forma igual que la Luna, crece y se achica. Eso solo pasa si da vueltas alrededor del Sol. Copérnico tenía razón. La Tierra también se mueve.'],
    ],
    pc: 'Vuelve a la PC si llevaste el segundo telescopio.',
  },
  {
    titulo: 'Tocan la puerta',
    seg: 7,
    ordenes: { velocidad: 1 },
    acotacion: 'Tres golpes fuertes. Galileo se queda quieto.',
    lineas: [
      ['roma', '¡Galileo Galilei! Por orden del Santo Oficio, preséntese en Roma.'],
    ],
    pc: 'Golpea la mesa tres veces y di la línea sin salir a escena.',
  },
  {
    titulo: 'Roma 1633, el juicio',
    seg: 20,
    ordenes: { abierto: false },
    acotacion: 'Galileo le da el telescopio al aprendiz. Los telescopios se cierran.',
    lineas: [
      ['galileo', 'Escribí un libro contando todo esto y en Roma no les gustó. En 1633 me hicieron un juicio. Tenía casi setenta años.'],
      ['nota', 'Galileo se arrodilla despacio.'],
      ['galileo', 'Me obligaron a decir que la Tierra no se mueve. Y lo dije.'],
    ],
  },
  {
    titulo: 'Y sin embargo se mueve',
    seg: 8,
    ordenes: {},
    acotacion: 'Galileo se levanta despacio y mira al público.',
    lineas: [
      ['galileo', 'Cuentan que al levantarme dije en voz baja, y sin embargo, se mueve.'],
    ],
  },
  {
    titulo: 'Arcetri, el final',
    seg: 22,
    ordenes: { abierto: true, objetivo: 0, zoom: 1.6, lluvia: true },
    acotacion: 'Los telescopios se abren con una lluvia de estrellas. El aprendiz le devuelve el telescopio a Galileo.',
    lineas: [
      ['galileo', 'Pasé mis últimos años encerrado en mi casa de Arcetri. Me quedé ciego, pero seguí escribiendo. Yo ya no puedo mirar el cielo, ahora les toca a ustedes. No crean algo solo porque lo dice alguien importante. Mírenlo con sus propios ojos.'],
      ['nota', 'Galileo pone el telescopio en manos de alguien del público.'],
    ],
  },
  {
    titulo: 'Fin',
    seg: 6,
    ordenes: { modo: 'libre' },
    acotacion: 'Galileo, el aprendiz y la Voz de Roma saludan al público.',
    lineas: [],
    pc: 'Los telescopios siguen libres para que el público mire a su gusto.',
  },
];

export const DURACION = OBRA.reduce((s, p) => s + p.seg, 0);

// Segundo en que empieza cada paso.
export const INICIO = OBRA.map((_, i) => OBRA.slice(0, i).reduce((s, p) => s + p.seg, 0));

// Órdenes que disparan algo una sola vez, como la lluvia o los golpes en la puerta.
const DISPAROS = ['lluvia', 'puerta', 'saludo', 'abjurar', 'final'];

// Todo lo que los teléfonos deben tener en el paso i. Los disparos solo se mandan en su propio paso.
export function estadoDe(i) {
  const e = {};
  for (let k = 0; k <= i; k++) Object.assign(e, OBRA[k].ordenes);
  for (const d of DISPAROS) if (!(d in OBRA[i].ordenes)) delete e[d];
  return e;
}

export const minSeg = (s) => `${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, '0')} s`;
