// api/index.js (Lógica de Verificación y Recepción para WhatsApp)

// Token de Verificación: ¡Debe coincidir con lo que pongamos en Meta!
const VERIFY_TOKEN = 'coreaura-token-seguro-456'; 

module.exports = (req, res) => {
  // 1. Manejo de la Petición de Verificación (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('Webhook verificado exitosamente!');
        // Meta requiere que devolvamos el 'challenge' para confirmar la propiedad.
        return res.status(200).send(challenge); 
      } else {
        // El token no coincide.
        return res.status(403).send('Token de verificación inválido.');
      }
    }
    // Faltan parámetros.
    return res.status(400).send('Faltan parámetros de verificación.');
  } 
  
  // 2. Manejo de la Recepción de Mensajes (POST)
  else if (req.method === 'POST') {
      // Por ahora, solo confirmamos la recepción.
      const body = req.body;
      console.log('Mensaje de WhatsApp recibido:', JSON.stringify(body));
      
      // Meta requiere una respuesta 200 (OK) en menos de 30 segundos.
      return res.status(200).send('EVENT_RECEIVED');
  } 
  
  // 3. Otros métodos HTTP no soportados
  else {
    res.status(405).send('Método no permitido');
  }
};
