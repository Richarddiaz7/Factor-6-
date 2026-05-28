// js/ranking.js
// Sistema de ranking y puntuación ELO

class RankingManager {
  
  /**
   * Obtener el top del ranking en tiempo real
   * @param {function} callback - Función que recibe el array del ranking
   * @param {number} limite - Cantidad de jugadores a mostrar (default 20)
   * @returns {function} Función para cancelar la suscripción
   */
  static escucharRanking(callback, limite = 20) {
    return db.collection('ranking')
      .orderBy('puntuacion', 'desc')
      .limit(limite)
      .onSnapshot(async (snapshot) => {
        const ranking = [];
        
        for (const doc of snapshot.docs) {
          const userDoc = await db.collection('usuarios').doc(doc.id).get();
          ranking.push({
            uid: doc.id,
            nombre: userDoc.exists ? (userDoc.data().nombre || 'Anónimo') : 'Desconocido',
            ...doc.data()
          });
        }
        
        callback(ranking);
      }, (error) => {
        console.error('Error escuchando ranking:', error);
        callback([]);
      });
  }
  
  /**
   * Obtener la posición de un jugador en el ranking
   * @param {string} uid - ID del usuario
   * @returns {Promise<number>} Posición en el ranking (1-based)
   */
  static async obtenerPosicion(uid) {
    try {
      const userDoc = await db.collection('ranking').doc(uid).get();
      if (!userDoc.exists) return 0;
      
      const puntuacion = userDoc.data().puntuacion;
      
      // Contar cuántos tienen más puntuación
      const snapshot = await db.collection('ranking')
        .where('puntuacion', '>', puntuacion)
        .count()
        .get();
      
      return snapshot.data().count + 1;
      
    } catch (error) {
      console.error('Error obteniendo posición:', error);
      return 0;
    }
  }
  
  /**
   * Actualizar puntuación ELO después de una partida
   * @param {string} ganadorId - UID del ganador
   * @param {string} perdedorId - UID del perdedor
   * @param {number} K - Factor K (default 32)
   */
  static async actualizarELO(ganadorId, perdedorId, K = 32) {
    try {
      const ganadorDoc = await db.collection('ranking').doc(ganadorId).get();
      const perdedorDoc = await db.collection('ranking').doc(perdedorId).get();
      
      const eloGanador = ganadorDoc.exists ? (ganadorDoc.data().puntuacion || 1000) : 1000;
      const eloPerdedor = perdedorDoc.exists ? (perdedorDoc.data().puntuacion || 1000) : 1000;
      
      // Calcular ELO
      const esperadoGanador = 1 / (1 + Math.pow(10, (eloPerdedor - eloGanador) / 400));
      const esperadoPerdedor = 1 / (1 + Math.pow(10, (eloGanador - eloPerdedor) / 400));
      
      const nuevoEloGanador = Math.round(eloGanador + K * (1 - esperadoGanador));
      const nuevoEloPerdedor = Math.round(eloPerdedor + K * (0 - esperadoPerdedor));
      
      // Actualizar en batch
      const batch = db.batch();
      
      batch.set(db.collection('ranking').doc(ganadorId), {
        puntuacion: nuevoEloGanador,
        partidasGanadas: firebase.firestore.FieldValue.increment(1),
        ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      batch.set(db.collection('ranking').doc(perdedorId), {
        puntuacion: nuevoEloPerdedor,
        ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      await batch.commit();
      
      console.log(`✅ ELO actualizado: Ganador ${eloGanador}→${nuevoEloGanador}, Perdedor ${eloPerdedor}→${nuevoEloPerdedor}`);
      
    } catch (error) {
      console.error('Error actualizando ELO:', error);
    }
  }
  
  /**
   * Obtener la división según puntuación
   * @param {number} puntuacion - Puntuación ELO
   * @returns {object} División con nombre y emoji
   */
  static obtenerDivision(puntuacion) {
    if (puntuacion >= 2100) return { nombre: 'Leyenda', emoji: '👑', color: '#FF4500' };
    if (puntuacion >= 1800) return { nombre: 'Diamante', emoji: '💎', color: '#00BFFF' };
    if (puntuacion >= 1500) return { nombre: 'Oro', emoji: '🥇', color: '#FFD700' };
    if (puntuacion >= 1200) return { nombre: 'Plata', emoji: '🥈', color: '#C0C0C0' };
    return { nombre: 'Bronce', emoji: '🥉', color: '#CD7F32' };
  }
  
  /**
   * Inicializar ranking para un usuario nuevo
   * @param {string} uid - ID del usuario
   */
  static async inicializarRanking(uid) {
    try {
      const rankingDoc = await db.collection('ranking').doc(uid).get();
      
      if (!rankingDoc.exists) {
        await db.collection('ranking').doc(uid).set({
          puntuacion: 1000,
          partidasGanadas: 0,
          creado: firebase.firestore.FieldValue.serverTimestamp(),
          ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Ranking inicializado para:', uid);
      }
      
    } catch (error) {
      console.error('Error inicializando ranking:', error);
    }
  }
  
  /**
   * Obtener estadísticas detalladas de un jugador
   * @param {string} uid - ID del usuario
   * @returns {object} Estadísticas del jugador
   */
  static async obtenerEstadisticas(uid) {
    try {
      const [userDoc, rankingDoc] = await Promise.all([
        db.collection('usuarios').doc(uid).get(),
        db.collection('ranking').doc(uid).get()
      ]);
      
      const usuario = userDoc.exists ? userDoc.data() : {};
      const ranking = rankingDoc.exists ? rankingDoc.data() : {};
      
      const division = RankingManager.obtenerDivision(ranking.puntuacion || 1000);
      
      return {
        nombre: usuario.nombre || 'Anónimo',
        monedas: usuario.monedas || 0,
        puntuacion: ranking.puntuacion || 1000,
        partidasJugadas: usuario.partidasJugadas || 0,
        partidasGanadas: usuario.partidasGanadas || 0,
        racha: usuario.racha || 0,
        division: division,
        posicion: await RankingManager.obtenerPosicion(uid)
      };
      
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return null;
    }
  }
}
