// js/ui.js
// Manejo de la interfaz de usuario

class UIManager {
  constructor() {
    this.elementos = {
      turnoIndicador: document.getElementById('turno-indicador'),
      panelJugadores: document.getElementById('panel-jugadores'),
      botonGirar: document.getElementById('boton'),
      resultado: document.getElementById('resultado'),
      contadorPozo: document.getElementById('contador-pozo'),
      sorteoInfo: document.getElementById('sorteo-info'),
      mensajeVictoria: document.getElementById('mensaje-victoria'),
      mensajeTitulo: document.getElementById('mensaje-titulo'),
      mensajeTexto: document.getElementById('mensaje-texto')
    };
  }

  actualizarPanelJugadores(jugadores, turnoActual) {
    const panel = this.elementos.panelJugadores;
    if (!panel) return;
    panel.innerHTML = '';
    jugadores.forEach((jugador, index) => {
      const card = document.createElement('div');
      card.className = `jugador-card ${jugador.esIA ? 'ia' : ''} ${index === turnoActual ? 'activo' : ''}`;
      card.innerHTML = `
        <div class="jugador-emoji">${jugador.emoji || '🎮'}</div>
        <div class="jugador-nombre">${jugador.nombre || 'Jugador'}</div>
        <div class="jugador-fichas">🪙 ${jugador.fichas}</div>
      `;
      panel.appendChild(card);
    });
  }

  actualizarTablero(casillas, pozo) {
    for (let i = 1; i <= 5; i++) {
      const casilla = document.getElementById(`casilla-${i}`);
      if (casilla) {
        if (casillas[i] !== null && casillas[i] !== undefined) {
          casilla.classList.add('ocupado');
        } else {
          casilla.classList.remove('ocupado');
        }
      }
    }
    if (this.elementos.contadorPozo) {
      this.elementos.contadorPozo.textContent = pozo || 0;
      if (pozo > 0) {
        this.elementos.contadorPozo.classList.add('visible');
      } else {
        this.elementos.contadorPozo.classList.remove('visible');
      }
    }
  }

  actualizarIndicadorTurno(jugador, esHumano) {
    if (this.elementos.turnoIndicador) {
      this.elementos.turnoIndicador.textContent = esHumano 
        ? '🎮 Tu turno' 
        : `🤖 Turno de ${jugador.nombre}`;
    }
  }

  habilitarGiro(habilitar) {
    if (this.elementos.botonGirar) {
      this.elementos.botonGirar.disabled = !habilitar;
    }
  }

  cambiarColorBoton(esTurno) {
    if (this.elementos.botonGirar) {
      this.elementos.botonGirar.style.background = esTurno 
        ? 'linear-gradient(180deg, #4CAF50, #2E7D32)' 
        : 'linear-gradient(180deg, #FFD700, #B8860B)';
      this.elementos.botonGirar.style.color = esTurno ? 'white' : '#1a0030';
    }
  }

  mostrarResultadoTirada(numero) {
    if (this.elementos.resultado) {
      this.elementos.resultado.textContent = `🎯 ${numero}`;
      this.elementos.resultado.style.display = 'block';
    }
  }

  iluminarCasilla(numero) {
    document.querySelectorAll('.cuadrado, #c6').forEach(el => el.classList.remove('iluminado'));
    if (numero === 6) {
      document.getElementById('c6')?.classList.add('iluminado');
    } else {
      document.getElementById(`casilla-${numero}`)?.classList.add('iluminado');
    }
  }

  mostrarResultadoFinal(ganador, esHumanoGanador) {
    const mensaje = this.elementos.mensajeVictoria;
    if (mensaje) {
      mensaje.style.display = 'block';
      if (this.elementos.mensajeTitulo) {
        this.elementos.mensajeTitulo.textContent = esHumanoGanador ? '🎉 ¡VICTORIA!' : '😢 ¡DERROTA!';
      }
      if (this.elementos.mensajeTexto) {
        this.elementos.mensajeTexto.textContent = esHumanoGanador 
          ? `¡${ganador.nombre} ha ganado la partida!` 
          : `${ganador.nombre} ganó. ¡Suerte la próxima!`;
      }
    }
    if (esHumanoGanador) {
      if (typeof soundManager !== 'undefined') soundManager.playVictory();
    } else {
      if (typeof soundManager !== 'undefined') soundManager.playDefeat();
    }
  }

  ocultarResultadoFinal() {
    if (this.elementos.mensajeVictoria) {
      this.elementos.mensajeVictoria.style.display = 'none';
    }
  }

  animarRodillo(numeroFinal, callback) {
    const rodillo = document.getElementById('numeros');
    if (!rodillo) {
      if (callback) callback();
      return;
    }
    let frames = 0;
    const total = 30;
    const intervalo = setInterval(() => {
      const numAleatorio = Math.floor(Math.random() * 6) + 1;
      rodillo.innerHTML = `<div class="numero-rodillo">${numAleatorio}</div>`;
      if (typeof soundManager !== 'undefined') soundManager.playTick();
      frames++;
      if (frames >= total) {
        clearInterval(intervalo);
        rodillo.innerHTML = `<div class="numero-rodillo">${numeroFinal}</div>`;
        if (callback) callback();
      }
    }, 50);
  }

  mostrarMensajeTemporal(mensaje) {
    const toast = document.createElement('div');
    toast.textContent = mensaje;
    toast.style.position = 'fixed';
    toast.style.bottom = '80px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(0,0,0,0.8)';
    toast.style.color = '#FFD700';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '20px';
    toast.style.zIndex = '1000';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }
}

const uiManager = new UIManager();
