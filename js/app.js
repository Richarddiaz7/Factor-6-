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
let salaActualId = null;
let unsubscribeSala = null;
let unsubscribeRanking = null;
let unsubscribeSalas = null;

// ========================================
// INICIALIZACIÓN
// ========================================

async function initApp() {
  console.log('🎲 Iniciando Factor 6 Online...');
  await AuthManager.loginAnonimo();
}

// ========================================
// NAVEGACIÓN ENTRE PANTALLAS
// ========================================

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

// ========================================
// PERFIL
// ========================================

async function mostrarPerfil() {
  mostrarPantalla('perfil');
  const user = auth.currentUser;
  if (!user) return;
  
  const perfil = await AuthManager.obtenerPerfil(user.uid);
  if (perfil) {
    document.getElementById('perfil-monedas').textContent = perfil.monedas || 0;
    document.getElementById('perfil-puntuacion').textContent = perfil.puntuacion || 0;
    document.getElementById('perfil-partidas').textContent = perfil.partidasJugadas || 0;
    document.getElementById('perfil-ganadas').textContent = perfil.partidasGanadas || 0;
    document.getElementById('input-nombre').value = perfil.nombre || '';
  }
}

async function guardarNombre() {
  const user = auth.currentUser;
  const nombre = document.getElementById('input-nombre').value.trim();
  if (user && nombre) {
    await AuthManager.actualizarNombre(user.uid, nombre);
    alert('✅ Nombre guardado');
  }
}

// ========================================
// LOBBY
// ========================================

async function mostrarLobby() {
  mostrarPantalla('lobby');
  
  if (unsubscribeSalas) unsubscribeSalas();
  unsubscribeSalas = LobbyManager.escucharSalas((salas) => {
    const contenedor = document.getElementById('salas-disponibles');
    if (!contenedor) return;
    
    if (salas.length === 0) {
      contenedor.innerHTML = '<p style="color:rgba(255,255,255,0.5); text-align:center;">No hay salas disponibles. ¡Crea una!</p>';
      return;
    }
    
    contenedor.innerHTML = salas.map(sala => `
      <div class="sala-card" onclick="unirseASala('${sala.id}')">
        <strong>${sala.creadorNombre || 'Anónimo'}</strong> - ${sala.modo === 'solitario' ? '🤖 Solitario' : '👥 Multijugador'}
        <br>👥 ${sala.jugadores.length}/${sala.maxJugadores} jugadores
        ${sala.apuesta > 0 ? ` | 💰 ${sala.apuesta} monedas` : ' | 🆓 Sin apuesta'}
      </div>
    `).join('');
  });
}

async function crearSala(modo, numBots) {
  const apuestaSelect = document.getElementById('apuesta-select');
  const apuesta = parseInt(apuestaSelect?.value || 0);
  
  const salaId = await LobbyManager.crearSala(modo, numBots, apuesta);
  if (salaId) {
    salaActualId = salaId;
    
    if (unsubscribeSala) unsubscribeSala();
    unsubscribeSala = LobbyManager.escucharSala(salaId, (sala) => {
      if (sala.estado === 'jugando') {
        iniciarPartidaDesdeSala(sala);
      }
    });
    
    alert(`✅ Sala creada. Esperando jugadores...\nID: ${salaId}`);
  }
}

async function unirseASala(salaId) {
  try {
    await LobbyManager.unirseSala(salaId);
    salaActualId = salaId;
    
    if (unsubscribeSala) unsubscribeSala();
    unsubscribeSala = LobbyManager.escucharSala(salaId, (sala) => {
      if (sala.estado === 'jugando') {
        iniciarPartidaDesdeSala(sala);
      }
    });
    
    alert('✅ Te has unido a la sala. Esperando que empiece...');
  } catch (error) {
    alert('❌ ' + error.message);
  }
}

function salirLobby() {
  if (unsubscribeSalas) unsubscribeSalas();
  mostrarPortada();
}

// ========================================
// RANKING
// ========================================

function mostrarRanking() {
  mostrarPantalla('ranking');
  
  if (unsubscribeRanking) unsubscribeRanking();
  unsubscribeRanking = RankingManager.escucharRanking((ranking) => {
    const contenedor = document.getElementById('ranking-lista');
    if (!contenedor) return;
    
    if (ranking.length === 0) {
      contenedor.innerHTML = '<p style="color:rgba(255,255,255,0.5); text-align:center;">No hay jugadores aún</p>';
      return;
    }
    
    contenedor.innerHTML = ranking.map((jugador, index) => {
      const medallas = ['🥇', '🥈', '🥉'];
      const medalla = index < 3 ? medallas[index] : `${index + 1}️⃣`;
      
      return `
        <div class="ranking-item">
          ${medalla} <strong>${jugador.nombre || 'Anónimo'}</strong>
          <span style="float:right;">🏆 ${jugador.puntuacion} | ✅ ${jugador.partidasGanadas || 0}</span>
        </div>
      `;
    }).join('');
  });
}

function salirRanking() {
  if (unsubscribeRanking) unsubscribeRanking();
  mostrarPortada();
}

// ========================================
// INICIAR PARTIDA DESDE SALA
// ========================================

function iniciarPartidaDesdeSala(sala) {
  mostrarPantalla('juego');
  uiManager.ocultarResultadoFinal();
  
  // Crear jugadores humanos
  const jugadores = sala.jugadores.map(j => ({
    nombre: j.nombre,
    emoji: '😎',
    fichas: 6,
    esIA: false,
    uid: j.uid
  }));
  
  // Agregar bots si es modo solitario
  if (sala.modo === 'solitario') {
    for (let i = 0; i < sala.numBots; i++) {
      jugadores.push({
        nombre: `Bot-${i + 1}`,
        emoji: '🤖',
        fichas: 6,
        esIA: true
      });
    }
  }
  
  currentGame = new Factor6Game(jugadores);
  currentGame.iniciar();
  juegoActivo = true;
  currentGame.apuesta = sala.apuesta || 0;
  
  uiManager.actualizarPanelJugadores(currentGame.jugadores, currentGame.turnoActual);
  uiManager.actualizarTablero(currentGame.casillas, currentGame.pozo);
  
  realizarSorteo().then(() => {
    iniciarTurno();
  });
}

// ========================================
// SORTEO INICIAL
// ========================================

async function realizarSorteo() {
  const info = document.getElementById('sorteo-info');
  if (info) info.style.display = 'block';
  
  let ganador = null;
  let intentos = 0;
  
  while (!ganador && intentos < 20) {
    intentos++;
    
    const resultados = currentGame.jugadores.map(jugador => ({
      jugador: jugador,
      numero: Math.floor(Math.random() * 6) + 1
    }));
    
    const maxNum = Math.max(...resultados.map(r => r.numero));
    const ganadores = resultados.filter(r => r.numero === maxNum);
    
    if (ganadores.length === 1) {
      ganador = currentGame.jugadores.indexOf(ganadores[0].jugador);
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  if (ganador === null) {
    ganador = Math.floor(Math.random() * currentGame.jugadores.length);
  }
  
  currentGame.turnoActual = ganador;
  
  if (info) info.style.display = 'none';
  console.log(`🎲 Empieza: ${currentGame.jugadores[ganador].nombre}`);
}

// ========================================
// GESTIÓN DE TURNOS
// ========================================

function iniciarTurno() {
  if (!juegoActivo) return;
  
  const jugadorActual = currentGame.getJugadorActual();
  const esHumano = !jugadorActual.esIA;
  
  uiManager.actualizarPanelJugadores(currentGame.jugadores, currentGame.turnoActual);
  uiManager.actualizarIndicadorTurno(jugadorActual, esHumano);
  uiManager.habilitarGiro(esHumano);
  
  if (!esHumano) {
    setTimeout(() => turnoIA(), 1500);
  }
}

function turnoIA() {
  if (!juegoActivo) return;
  
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

// ========================================
// FINALIZAR JUEGO
// ========================================

async function finalizarJuego(ganadorIndex) {
  juegoActivo = false;
  const ganador = currentGame.jugadores[ganadorIndex];
  const esHumano = !ganador.esIA;
  
  uiManager.mostrarResultadoFinal(ganador, esHumano);
  uiManager.habilitarGiro(false);
  
  // Actualizar monedas y ranking si hay apuesta
  const user = auth.currentUser;
  if (user && currentGame.apuesta > 0) {
    if (esHumano) {
      await AuthManager.actualizarMonedas(user.uid, currentGame.apuesta * 2);
      await db.collection('usuarios').doc(user.uid).update({
        partidasGanadas: firebase.firestore.FieldValue.increment(1)
      });
    }
    await db.collection('usuarios').doc(user.uid).update({
      partidasJugadas: firebase.firestore.FieldValue.increment(1)
    });
  }
  
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.notificationOccurred(esHumano ? 'success' : 'error');
  }
  
  // Actualizar sala si existe
  if (salaActualId) {
    await db.collection('salas').doc(salaActualId).update({
      estado: 'terminada',
      ganador: ganador.nombre
    });
    salaActualId = null;
  }
}

// ========================================
// REINICIAR PARTIDA
// ========================================

function reiniciarPartida() {
  uiManager.ocultarResultadoFinal();
  
  // Reiniciar con los mismos jugadores
  const jugadores = currentGame.jugadores.map(j => ({
    nombre: j.nombre,
    emoji: j.emoji,
    fichas: 6,
    esIA: j.esIA,
    uid: j.uid
  }));
  
  currentGame = new Factor6Game(jugadores);
  currentGame.iniciar();
  juegoActivo = true;
  
  uiManager.actualizarPanelJugadores(currentGame.jugadores, currentGame.turnoActual);
  uiManager.actualizarTablero(currentGame.casillas, currentGame.pozo);
  
  realizarSorteo().then(() => {
    iniciarTurno();
  });
}

// ========================================
// ANIMACIÓN DEL RODILLO
// ========================================

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

// ========================================
// LISTENERS
// ========================================

function configurarListeners() {
  const boton = document.getElementById('boton');
  if (boton) {
    boton.addEventListener('click', (e) => {
      e.preventDefault();
      tirarPalanca();
    });
  }
  
  const btnReiniciar = document.querySelector('.btn-reiniciar');
  if (btnReiniciar) {
    btnReiniciar.addEventListener('click', () => {
      reiniciarPartida();
    });
  }
}

// ========================================
// INICIAR
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  configurarListeners();
  initApp();
});
