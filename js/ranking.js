// js/ranking.js
// Sistema de ranking y puntuación

class RankingManager {
  
  // Obtener top 10 del ranking
  static escucharRanking(callback) {
    return db.collection('ranking')
      .orderBy('puntuacion', 'desc')
      .limit(10)
      .onSnapshot(async (snapshot) => {
        const ranking = [];
        for (const doc of snapshot.docs) {
          const userDoc = await db.collection('usuarios').doc(doc.id).get();
          ranking.push({
            uid: doc.id,
            nombre: userDoc.exists ? userDoc.data().nombre : 'Desconocido',
            ...doc.data()
          });
        }
        callback(ranking);
      });
  }
  
  // Actualizar puntuación ELO
  static async actualizarELO(ganadorId, perdedorId) {
    const ganadorDoc = await db.collection('ranking').doc(ganadorId).get();
    const perdedorDoc = await db.collection('ranking').doc(perdedorId).get();
    
    const eloGanador = ganadorDoc.exists ? ganadorDoc.data().puntuacion : 1000;
    const eloPerdedor = perdedorDoc.exists ? perdedorDoc.data().puntuacion : 1000;
    
    const K = 32;
    const esperadoGanador = 1 / (1 + Math.pow(10, (eloPerdedor - eloGanador) / 400));
    const esperadoPerdedor = 1 / (1 + Math.pow(10, (eloGanador - eloPerdedor) / 400));
    
    const nuevoEloGanador = Math.round(eloGanador + K * (1 - esperadoGanador));
    const nuevoEloPerdedor = Math.round(eloPerdedor + K * (0 - esperadoPerdedor));
    
    const batch = db.batch();
    batch.set(db.collection('ranking').doc(ganadorId), {
      puntuacion: nuevoEloGanador,
      partidasGanadas: firebase.firestore.FieldValue.increment(1)
    }, { merge: true });
    batch.set(db.collection('ranking').doc(perdedorId), {
      puntuacion: nuevoEloPerdedor
    }, { merge: true });
    
    await batch.commit();
  }
}
