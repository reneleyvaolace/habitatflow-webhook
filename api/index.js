// api/index.js (VERSION ULTRA-SIMPLE PARA DEBUG)

// Token de Verificación (para GET)
const VERIFY_TOKEN = 'coreaura-token-seguro-456'; 

module.exports = async (req, res) => {
  // 1. Manejo de la Petición de Verificación (GET) - Meta
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Verificacion GET exitosa.');
      return res.status(200).send(challenge); 
    } else {
      return res.status(403).send('Token inválido.');
    }
  } 

  // 2. Manejo de Mensajes (POST) - WhatsApp
  else if (req.method === 'POST') {
      // Si llegamos aquí, el mensaje de WhatsApp LLEGÓ.
      console.log("SUCCESS: Webhook POST recibido de Meta.");
      console.log("Body:", JSON.stringify(req.body));

      // DEBE responder 200 inmediatamente.
      return res.status(200).send('EVENT_RECEIVED_SIMPLE'); 
  } 

  // 3. Otros métodos HTTP
  else {
    res.status(405).send('Método no permitido');
  }
};
