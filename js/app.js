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
  const el = document.getElementById(id);
  if (el) el.classList.add('activa');
}

function mostrarPortada() {
  if (typeof uiManager !== 'undefined') uiManager.ocultarResultadoFinal();
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
  
  try {
    const perfil = await AuthManager.obtenerPerfil(user.uid);
    if (perfil) {
      document.getElementById('perfil-monedas').textContent = perfil.monedas || 0;
      document.getElementById('perfil-puntuacion').textContent = perfil.puntuacion || 0;
      document.getElementById('perfil-partidas').textContent = perfil.partidasJugadas || 0;
      document.getElementById('perfil-ganadas').textContent = perfil.partidasGanadas || 0;
      document.getElementById('input-nombre').value = perfil.nombre || '';
    }
  } catch (e) {
    console.error('Error cargando perfil:', e);
  }
}

async function guardarNombre() {
  const user = auth.currentUser;
  const nombre = document.getElementById('input-nombre').value.trim();
  if (user && nombre) {
    try {
      await AuthManager.actualizarNombre(user.uid, nombre);
      alert('✅ Nombre guardado');
    } catch (e) {
      alert('❌ Error al guardar');
    }
  }
}

// ========================================
// LOBBY Y SALAS
// ========================================

function mostrarLobby() {
  mostrarPantalla('lobby');
  
  // Ocultar panel multijugador al entrar
  const panel = document.getElementById('panel-multijugador');
  if (panel) panel.style.display = 'none';
  
  if (unsubscribeSalas) unsubscribeSalas();
  unsubscribeSalas = LobbyManager.escucharSalas(salas => {
    const contenedor = document.getElementById('salas-disponibles');
    if (!contenedor) return;

    if (salas.length === 0) {
      contenedor.innerHTML = '<p style="color:rgba(255,255,255,0.5); text-align:center;">No hay salas disponibles. ¡Crea una!</p>';
      return;
    }

    const currentUid = auth.currentUser?.uid;

    contenedor.innerHTML = salas.map(sala => {
      const esCreador = currentUid && sala.creador === currentUid;
      const yaEstaEnSala = currentUid && sala.jugadores.some(j => j.uid === currentUid);
      
      let botonesHTML = '';
      
      if (!esCreador && !yaEstaEnSala) {
        botonesHTML += `<button class="btn-pequeno btn-unirse" onclick="unirseASala('${sala.id}')">Unirse</button>`;
      }
      if (esCreador && sala.jugadores.length >= 2) {
        botonesHTML += `<button class="btn-pequeno btn-iniciar" onclick="iniciarPartida('${sala.id}')">Iniciar</button>`;
      }

      return `
        <div class="sala-card">
          <div>
            <strong>${sala.creadorNombre || 'Anónimo'}</strong>
            ${sala.modo === 'solitario' ? '🤖' : '👥'}
            <br><small>${sala.jugadores.length}/${sala.maxJugadores} jugadores</small>
            ${sala.apuesta > 0 ? ` | 💰${sala.apuesta}` : ''}
          </div>
          <div style="display:flex; gap:5px;">${botonesHTML}</div>
        </div>
      `;
    }).join('');
  });
}

function mostrarPanelMultijugador() {
  const panel = document.getElementById('panel-multijugador');
  if (panel) panel.style.display = 'block';
}

// Crear sala solitario
async function crearSala(modo, numBots) {
  console.log(`🎯 Creando sala: ${modo}, bots: ${numBots}`);
  try {
    const salaId = await LobbyManager.crearSala(modo, numBots, 0, 1);
    if (salaId) {
      suscribirseASala(salaId);
      console.log('✅ Sala solitario creada:', salaId);
    }
  } catch (e) {
    console.error('Error:', e);
    alert('❌ Error al crear sala');
  }
}

// Crear sala multijugador
async function crearSalaMultijugador() {
  console.log('🎯 Creando sala multijugador...');
  
  const jugadoresSelect = document.getElementById('jugadores-select');
  const maxJugadores = jugadoresSelect ? parseInt(jugadoresSelect.value) : 2;
  
  const apuestaSelect = document.getElementById('apuesta-select');
  const apuesta = apuestaSelect ? parseInt(apuestaSelect.value) : 0;
  
  console.log(`👥 Max jugadores: ${maxJugadores}, 💰 Apuesta: ${apuesta}`);
  
  try {
    const salaId = await LobbyManager.crearSala('multijugador', 0, apuesta, maxJugadores);
    if (salaId) {
      suscribirseASala(salaId);
      alert(`✅ Sala creada (${maxJugadores} jugadores). Comparte el código o espera.`);
    }
  } catch (e) {
    console.error('Error:', e);
    alert('❌ Error al crear sala multijugador');
  }
}

// Unirse a sala
async function unirseASala(salaId) {
  console.log('🔗 Uniendo a sala:', salaId);
  try {
    await LobbyManager.unirseSala(salaId);
    suscribirseASala(salaId);
    alert('✅ Te has unido a la sala');
  } catch (error) {
    alert('❌ ' + error.message);
  }
}

// Iniciar partida manualmente
async function iniciarPartida(salaId) {
  console.log('▶️ Iniciando partida:', salaId);
  await LobbyManager.iniciarPartida(salaId);
}

// Suscribirse a cambios de sala
function suscribirseASala(salaId) {
  salaActualId = salaId;
  if (unsubscribeSala) unsubscribeSala();
  unsubscribeSala = LobbyManager.escucharSala(salaId, sala => {
    if (sala && sala.estado === 'jugando') {
      iniciarPartidaDesdeSala(sala);
    }
    if (sala && sala.estado === 'terminada') {
      console.log('🏁 Sala terminada');
      salaActualId = null;
    }
  });
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
  unsubscribeRanking = RankingManager.escucharRanking(ranking => {
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
  console.log('🎮 Iniciando partida desde sala:', sala.id);
  mostrarPantalla('juego');
  if (typeof uiManager !== 'undefined') uiManager.ocultarResultadoFinal();

  const jugadores = sala.jugadores.map(j => ({
    nombre: j.nombre,
    emoji: '😎',
    fichas: 6,
    esIA: false,
    uid: j.uid
  }));

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

  realizarSorteo().then(() => iniciarTurno());
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
      jugador,
      numero: Math.floor(Math.random() * 6) + 1
    }));
    const maxNum = Math.max(...resultados.map(r => r.numero));
    const ganadores = resultados.filter(r => r.numero === maxNum);
    if (ganadores.length === 1) {
      ganador = currentGame.jugadores.indexOf(ganadores[0].jugador);
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  if (ganador === null) ganador = Math.floor(Math.random() * currentGame.jugadores.length);
  currentGame.turnoActual = ganador;
  if (info) info.style.display = 'none';
  console.log('🎲 Empieza:', currentGame.jugadores[ganador].nombre);
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

  if (!esHumano) setTimeout(() => turnoIA(), 1500);
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
    if (!resultado.mantieneTurno) currentGame.siguienteTurno();
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
    if (!resultado.mantieneTurno) currentGame.siguienteTurno();
    setTimeout(() => iniciarTurno(), 1000);
  });
}

async function finalizarJuego(ganadorIndex) {
  juegoActivo = false;
  const ganador = currentGame.jugadores[ganadorIndex];
  const esHumano = !ganador.esIA;
  uiManager.mostrarResultadoFinal(ganador, esHumano);
  uiManager.habilitarGiro(false);

  const user = auth.currentUser;
  if (user && currentGame.apuesta > 0) {
    try {
      if (esHumano) {
        await AuthManager.actualizarMonedas(user.uid, currentGame.apuesta * 2);
        await db.collection('usuarios').doc(user.uid).update({
          partidasGanadas: firebase.firestore.FieldValue.increment(1)
        });
      }
      await db.collection('usuarios').doc(user.uid).update({
        partidasJugadas: firebase.firestore.FieldValue.increment(1)
      });
    } catch (e) {
      console.error('Error actualizando monedas:', e);
    }
  }

  if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred(esHumano ? 'success' : 'error');
  
  if (salaActualId) {
    try {
      await db.collection('salas').doc(salaActualId).update({ 
        estado: 'terminada', 
        ganador: ganador.nombre 
      });
    } catch (e) {
      console.error('Error actualizando sala:', e);
    }
    salaActualId = null;
  }
}

function reiniciarPartida() {
  uiManager.ocultarResultadoFinal();
  const jugadores = currentGame.jugadores.map(j => ({
    nombre: j.nombre, emoji: j.emoji, fichas: 6, esIA: j.esIA, uid: j.uid
  }));
  currentGame = new Factor6Game(jugadores);
  currentGame.iniciar();
  juegoActivo = true;
  uiManager.actualizarPanelJugadores(currentGame.jugadores, currentGame.turnoActual);
  uiManager.actualizarTablero(currentGame.casillas, currentGame.pozo);
  realizarSorteo().then(() => iniciarTurno());
}

function animarRodilloSimple(numeroFinal, callback) {
  const rodillo = document.getElementById('numeros');
  if (!rodillo) { if (callback) callback(); return; }
  let frames = 0;
  const total = 30;
  const intervalo = setInterval(() => {
    rodillo.innerHTML = `<div class="numero-rodillo">${Math.floor(Math.random() * 6) + 1}</div>`;
    if (++frames >= total) {
      clearInterval(intervalo);
      rodillo.innerHTML = `<div class="numero-rodillo">${numeroFinal}</div>`;
      if (callback) callback();
    }
  }, 50);
}

function configurarListeners() {
  const boton = document.getElementById('boton');
  if (boton) {
    boton.addEventListener('click', (e) => {
      e.preventDefault();
      tirarPalanca();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  configurarListeners();
  initApp();
});
