// js/game.js
// Funciones de juego que operan sobre Firestore

class GameManager {

  /**
   * Crear documento inicial de partida en Firestore
   * @param {string} partidaId - ID único de la partida (normalmente el ID de la sala)
   * @param {Array} jugadores - Array de objetos {nombre, emoji, fichas, esIA, uid}
   * @param {number} turnoInicial - Índice del jugador que empieza
   * @param {number} apuesta - Monedas apostadas
   */
  static async crearPartida(partidaId, jugadores, turnoInicial, apuesta = 0) {
    const partidaRef = db.collection('partidas').doc(partidaId);
    
    const data = {
      jugadores: jugadores.map(j => ({
        nombre: j.nombre,
        emoji: j.emoji || '😎',
        fichas: j.fichas || 6,
        esIA: j.esIA || false,
        uid: j.uid || ''
      })),
      turnoActual: turnoInicial,
      casillas: { 1: null, 2: null, 3: null, 4: null, 5: null },
      pozo: 0,
      estado: 'jugando',
      ganador: null,
      apuesta: apuesta,
      historial: [],
      ultimaTirada: null
    };

    await partidaRef.set(data);
    console.log('✅ Partida creada en Firestore:', partidaId);
    return partidaRef;
  }

  /**
   * Escuchar cambios en la partida (para UI en tiempo real)
   * @param {string} partidaId 
   * @param {function} callback - recibe el estado completo de la partida
   * @returns {function} unsubscribe
   */
  static escucharPartida(partidaId, callback) {
    return db.collection('partidas').doc(partidaId)
      .onSnapshot(doc => {
        if (doc.exists) {
          const data = doc.data();
          callback({ id: doc.id, ...data });
        }
      }, error => {
        console.error('Error escuchando partida:', error);
      });
  }

  /**
   * Realizar una tirada de dado de forma atómica.
   * Solo el jugador con el turno actual puede tirar.
   * @param {string} partidaId 
   * @param {string} uid - UID del jugador que intenta tirar
   * @param {number} numero - Número obtenido (1-6)
   * @returns {Promise<object>} resultado de la tirada
   */
  static async tirarDado(partidaId, uid, numero) {
    const partidaRef = db.collection('partidas').doc(partidaId);

    try {
      const resultado = await db.runTransaction(async (transaction) => {
        const partidaDoc = await transaction.get(partidaRef);
        if (!partidaDoc.exists) throw new Error('La partida no existe');

        const partida = partidaDoc.data();
        if (partida.estado !== 'jugando') throw new Error('La partida no está activa');

        const jugadorActual = partida.jugadores[partida.turnoActual];
        
        // Verificar que el que tira es el jugador correcto
        if (jugadorActual.uid !== uid) {
          throw new Error('No es tu turno');
        }

        // Procesar tirada
        const casillas = { ...partida.casillas };
        let pozo = partida.pozo;
        let fichas = [...partida.jugadores.map(j => j.fichas)];
        let mantieneTurno = false;

        if (numero >= 1 && numero <= 5) {
          if (casillas[numero] === null) {
            // Colocar ficha
            casillas[numero] = partida.turnoActual;
            fichas[partida.turnoActual]--;
            mantieneTurno = true;
          } else {
            // Recoger ficha
            casillas[numero] = null;
            fichas[partida.turnoActual]++;
            mantieneTurno = false;
          }
        } else if (numero === 6) {
          // Pozo
          pozo++;
          fichas[partida.turnoActual]--;
          mantieneTurno = true;
        }

        // Actualizar fichas en jugadores
        const nuevosJugadores = partida.jugadores.map((j, i) => ({
          ...j,
          fichas: fichas[i]
        }));

        // Determinar nuevo turno
        let nuevoTurno = partida.turnoActual;
        if (!mantieneTurno) {
          nuevoTurno = (partida.turnoActual + 1) % partida.jugadores.length;
        }

        // Verificar ganador
        let ganador = null;
        let estado = 'jugando';
        for (let i = 0; i < nuevosJugadores.length; i++) {
          if (nuevosJugadores[i].fichas <= 0) {
            ganador = i;
            estado = 'terminada';
            break;
          }
        }

        // Actualizar documento
        const updateData = {
          jugadores: nuevosJugadores,
          casillas: casillas,
          pozo: pozo,
          turnoActual: nuevoTurno,
          estado: estado,
          ganador: ganador,
          ultimaTirada: {
            jugador: partida.turnoActual,
            numero: numero,
            timestamp: Date.now()
          },
          historial: firebase.firestore.FieldValue.arrayUnion({
            jugador: partida.turnoActual,
            numero: numero,
            timestamp: Date.now()
          })
        };

        transaction.update(partidaRef, updateData);

        return {
          mantuvoTurno: mantieneTurno,
          numero: numero,
          ganador: ganador,
          nuevoEstado: {
            jugadores: nuevosJugadores,
            casillas: casillas,
            pozo: pozo,
            turnoActual: nuevoTurno,
            estado: estado,
            ganador: ganador
          }
        };
      });

      return resultado;

    } catch (error) {
      console.error('Error en transacción:', error);
      throw error;
    }
  }

  /**
   * Eliminar partida de Firestore
   */
  static async eliminarPartida(partidaId) {
    await db.collection('partidas').doc(partidaId).delete();
    console.log('🗑️ Partida eliminada:', partidaId);
  }
}
