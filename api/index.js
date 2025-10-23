// api/index.js (NUEVA SINTAXIS)

// Esta es la función de verificación de webhook.
export default function handler(req, res) {
  res.status(200).send('Webhook de HabitatFlow inicializado. OK. ¡Sincronizado!');
}
