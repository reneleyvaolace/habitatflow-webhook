// api/index.js (FINAL - Lógica de Calificación con fetch de Gemini)

// System Prompt (Rol de la IA)
const SYSTEM_PROMPT = `
    Eres 'HabitatFlow AI', un Agente Experto en Calificación de Leads Inmobiliarios.
    Tu rol es evaluar la intención, presupuesto y tipo de propiedad.
    Debes responder con un objeto JSON válido con las claves:
    'RESPUESTA_USUARIO', 'INTENCION', 'PRESUPUESTO', 'TIPO_PROPIEDAD', y 'HANDOFF_REQUERIDO' (TRUE o FALSE).
    Si detectas frustración o la calificación es de 'Lujo' (> $5M USD), establece HANDOFF_REQUERIDO: TRUE.
`;

// Token de Verificación: Se queda para Meta.
const VERIFY_TOKEN = 'coreaura-token-seguro-456'; 

// Función para comunicarse con Gemini
async function getGeminiResponse(message) {
  const apiKey = process.env.GEMINI_API_KEY; // Usamos la clave de Vercel

  const prompt = `System Prompt: ${SYSTEM_PROMPT}\n\nUser Message: ${message}\n\nGenerate ONLY the JSON object:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
              responseMimeType: "application/json" // Pedimos un JSON
          }
        }),
      }
    );

    const data = await response.json();
    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    // El modelo devuelve el JSON como string, lo parseamos.
    return JSON.parse(jsonText); 

  } catch (error) {
    console.error('Error llamando a Gemini:', error);
    return { 
        RESPUESTA_USUARIO: 'Lo siento, hay un error en nuestro sistema de IA. Un agente humano te atenderá pronto.',
        HANDOFF_REQUERIDO: true 
    };
  }
}

// Handler Principal del Webhook
module.exports = async (req, res) => {
  // 1. Manejo de la Petición de Verificación (GET) - SIN CAMBIOS
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge); 
    } else {
      return res.status(403).send('Token inválido.');
    }
  } 

  // 2. Manejo de la Recepción de Mensajes (POST)
  else if (req.method === 'POST') {
      const body = req.body;

      // Extraer mensaje de WhatsApp (Simplificado para Fase II)
      const messageObject = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const incomingMessage = messageObject?.text?.body;

      if (incomingMessage) {
        console.log('Mensaje entrante:', incomingMessage);

        // LLAMADA CLAVE A GEMINI
        const geminiResult = await getGeminiResponse(incomingMessage);

        // TAREA 3: Lógica de Respuesta y Handoff (Simulada por ahora)
        console.log('Resultado de Calificación:', geminiResult);

        let finalResponse = geminiResult.RESPUESTA_USUARIO || 'Gracias por tu mensaje.';

        // Simulación de respuesta de WhatsApp (Tarea 3)
        // En un proyecto real, aquí se usaría el WHATSAPP_TOKEN para enviar la respuesta.
        if (geminiResult.HANDOFF_REQUERIDO) {
             finalResponse += "\n\n(Alerta Handoff: Notificando a un agente humano.)";
        }

        // Devolver 200 a Meta y loguear la respuesta de la IA.
        console.log("Respuesta de la IA lista:", finalResponse);
      }

      // SIEMPRE responde 200 para evitar que Meta reenvíe el mensaje.
      return res.status(200).send('EVENT_RECEIVED'); 
  } 

  // 3. Otros métodos HTTP
  else {
    res.status(405).send('Método no permitido');
  }
};
