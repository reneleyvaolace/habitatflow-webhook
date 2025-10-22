// api/webhook.js
module.exports = (req, res) => {
  // Esta es la respuesta inicial simple para verificar que Vercel funciona.
  res.status(200).send('Webhook de HabitatFlow inicializado. OK.');
};
