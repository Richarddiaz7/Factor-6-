// js/app.js
// Punto de entrada principal - Factor 6 Online

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// Estado global
let currentGame = null;
let juegoActivo = false;
let intervaloActual = null;

// Inicializar la aplicación
async function initApp() {
  console.log('🎲 Iniciando Factor 6 Online...');
  
  // Autenticar usuario
  await AuthManager.loginAnonimo();
  
  // Crear jugadores para partida de prueba
  const jugadores = [
    { nombre: 'Tú', emoji: '😎', fichas: 6, esIA: false },
    { nombre: 'Bot-1', emoji: '🤖', fichas: 6, esIA: true }
  ];
  
  // Crear instancia del juego
  currentGame = new Factor6Game(jugadores);
  
  // Sortear quién empieza
  await realizarSorteo();
  
  // Iniciar juego
  currentGame.iniciar();
  juegoActivo = true;
  
  // Actualizar UI
  uiManager.actualizarPanelJugadores(currentGame.jugadores, currentGame.turnoActual);
  uiManager.actualizarTablero(currentGame.casillas, currentGame.pozo);
  
  // Iniciar primer turno
  iniciarTurno();
}

// Realizar sorteo (mayor número)
async function realizarSorteo() {
  const info = document.getElementById('sorteo-info');
  if (info) info.style.display = 'block';
  
  let ganador = null;
  let intentos = 0;
  
  while (!ganador && intentos < 20) {
    intentos++;
    
    // Cada jugador tira
    const resultados = currentGame.jugadores.map(jugador => ({
      jugador: jugador,
      numero: Math.floor(Math.random() * 6) + 1
    }));
    
    // Encontrar el mayor
    const maxNum = Math.max(...resultados.map(r => r.numero));
    const ganadores = resultados.filter(r => r.numero === maxNum);
    
    if (ganadores.length === 1) {
      ganador = currentGame.jugadores.indexOf(ganadores[0].jugador);
    }
    
    // Pequeña pausa
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  // Si no se resolvió, elegir aleatorio
  if (ganador === null) {
    ganador = Math.floor(Math.random() * currentGame.jugadores.length);
  }
  
  currentGame.turnoActual = ganador;
  
  if (info) info.style.display = 'none';
  
  console.log(`🎲 Empieza: ${currentGame.jugadores[ganador].nombre}`);
}

// Iniciar turno
function iniciarTurno() {
  if (!juegoActivo) return;
  
  const jugadorActual = currentGame.getJugadorActual();
  const esHumano = !jugadorActual.esIA;
  
  uiManager.actualizarPanelJugadores(currentGame.jugadores, currentGame.turnoActual);
  uiManager.actualizarIndicadorTurno(jugadorActual, esHumano);
  uiManager.habilitarGiro(esHumano);
  
  if (!esHumano) {
    // Turno de la IA (esperar un poco)
    setTimeout(() => turnoIA(), 1500);
  }
}

// Turno de la IA
function turnoIA() {
  if (!juegoActivo) return;
  
  const numero = Math.floor(Math.random() * 6) + 1;
  
  // Animar rodillo
  animarRodilloSimple(numero, () => {
    const resultado = currentGame.procesarTirada(currentGame.turnoActual, numero);
    
    if (!resultado) return;
    
    // Actualizar UI
    uiManager.actualizarPanelJugadores(currentGame.jugadores, currentGame.turnoActual);
    uiManager.actualizarTablero(currentGame.casillas, currentGame.pozo);
    uiManager.mostrarResultadoTirada(numero);
    uiManager.iluminarCasilla(numero);
    
    if (resultado.ganador !== undefined) {
      finalizarJuego(resultado.ganador);
      return;
    }
    
    if (!resultado.mantieneTurno) {
      currentGame.siguienteTurno();
    }
    
    setTimeout(() => iniciarTurno(), 1000);
  });
}

// El jugador humano tira
function tirarPalanca() {
  if (!juegoActivo) return;
  
  const jugadorActual = currentGame.getJugadorActual();
  if (jugadorActual.esIA) return;
  
  uiManager.habilitarGiro(false);
  
  const numero = Math.floor(Math.random() * 6) + 1;
  
  animarRodilloSimple(numero, () => {
    const resultado = currentGame.procesarTirada(currentGame.turnoActual, numero);
    
    if (!resultado) return;
    
    uiManager.actualizarPanelJugadores(currentGame.jugadores, currentGame.turnoActual);
    uiManager.actualizarTablero(currentGame.casillas, currentGame.pozo);
    uiManager.mostrarResultadoTirada(numero);
    uiManager.iluminarCasilla(numero);
    
    if (resultado.ganador !== undefined) {
      finalizarJuego(resultado.ganador);
      return;
    }
    
    if (!resultado.mantieneTurno) {
      currentGame.siguienteTurno();
    }
    
    setTimeout(() => iniciarTurno(), 1000);
  });
}

// Finalizar juego
function finalizarJuego(ganadorIndex) {
  juegoActivo = false;
  const ganador = currentGame.jugadores[ganadorIndex];
  const esHumano = !ganador.esIA;
  
  uiManager.mostrarResultadoFinal(ganador, esHumano);
  uiManager.habilitarGiro(false);
  
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.notificationOccurred(esHumano ? 'success' : 'error');
  }
}

// Animación simple del rodillo
function animarRodilloSimple(numeroFinal, callback) {
  const rodillo = document.getElementById('numeros');
  if (!rodillo) {
    if (callback) callback();
    return;
  }
  
  let frames = 0;
  const totalFrames = 30;
  
  const intervalo = setInterval(() => {
    const numAleatorio = Math.floor(Math.random() * 6) + 1;
    rodillo.innerHTML = `<div class="numero-rodillo">${numAleatorio}</div>`;
    frames++;
    
    if (frames >= totalFrames) {
      clearInterval(intervalo);
      rodillo.innerHTML = `<div class="numero-rodillo">${numeroFinal}</div>`;
      if (callback) callback();
    }
  }, 50);
}

// Configurar listeners
function configurarListeners() {
  const boton = document.getElementById('boton');
  if (boton) {
    boton.addEventListener('click', (e) => {
      e.preventDefault();
      tirarPalanca();
    });
  }
  
  // Botón reiniciar
  const btnReiniciar = document.querySelector('.btn-reiniciar');
  if (btnReiniciar) {
    btnReiniciar.addEventListener('click', () => {
      uiManager.ocultarResultadoFinal();
      iniciarPartida();
    });
  }
}

// Iniciar partida desde el botón JUGAR
function iniciarJuegoOnline() {
  mostrarPantalla('juego');
  iniciarPartida();
}

// Iniciar partida
function iniciarPartida() {
  const jugadores = [
    { nombre: 'Tú', emoji: '😎', fichas: 6, esIA: false },
    { nombre: 'Bot-1', emoji: '🤖', fichas: 6, esIA: true }
  ];
  
  currentGame = new Factor6Game(jugadores);
  currentGame.iniciar();
  juegoActivo = true;
  
  uiManager.actualizarPanelJugadores(currentGame.jugadores, currentGame.turnoActual);
  uiManager.actualizarTablero(currentGame.casillas, currentGame.pozo);
  
  realizarSorteo().then(() => {
    iniciarTurno();
  });
}

// Reiniciar partida
function reiniciarPartida() {
  uiManager.ocultarResultadoFinal();
  iniciarPartida();
}

// Navegación
function mostrarPantalla(id) {
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  document.getElementById(id)?.classList.add('activa');
}

function mostrarPortada() {
  uiManager.ocultarResultadoFinal();
  juegoActivo = false;
  mostrarPantalla('portada');
}

function mostrarInstrucciones() {
  mostrarPantalla('instrucciones');
}

// Configurar listeners al cargar
document.addEventListener('DOMContentLoaded', () => {
  configurarListeners();
  initApp();
});
