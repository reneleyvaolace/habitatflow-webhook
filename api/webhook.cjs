// api/index.cjs (CÓDIGO COMPLETO Y CORREGIDO EN COMMONJS)

// Dependencias requeridas
const { GoogleAuth } = require('google-auth-library');
const fetch = require('node-fetch');

// System Prompt (Rol de la IA)
const SYSTEM_PROMPT = `
    Eres 'HabitatFlow AI', un Agente Experto en Calificación de Leads Inmobiliarios que opera 24/7 a través de WhatsApp.
    Tu rol es evaluar inmediatamente la intención, el presupuesto (rango) y el tipo de propiedad deseada del usuario para clasificarlo.
    Debes responder con un objeto JSON válido con las claves:
    'RESPUESTA_USUARIO' (Máx 256 carac.), 'INTENCION' (Compra/Renta/Inversión/Indefinida), 'PRESUPUESTO' (Bajo/Medio/Alto/Lujo/Indefinido), 'TIPO_PROPIEDAD' (Casa/Departamento/Terreno/Indefinido), y 'HANDOFF_REQUERIDO' (TRUE o FALSE).
    Si detectas frustración o la calificación es de 'Lujo' (> $5M USD, o si el usuario pide directamente un agente humano), establece HANDOFF_REQUERIDO: TRUE.
`;

// Token de Verificación (de Vercel, debe coincidir con Meta)
const VERIFY_TOKEN = 'coreaura-token-seguro-456';

// --- Funciones Clave ---

// 1. Escribir datos en Google Sheets
async function writeToGoogleSheets(rowData) {
    // Variables de Entorno de Vercel (Deben estar configuradas)
    const sheetsId = process.env.GOOGLE_SHEETS_ID;
    
    // Las claves privadas deben estar en el formato correcto en Vercel.
    const privateKeyJSON = JSON.parse(process.env.SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'));
    const sheetsEmail = privateKeyJSON.client_email; 
    
    // Autenticación con GoogleAuth (para Clave de Servicio)
    const auth = new GoogleAuth({
        credentials: {
            client_email: sheetsEmail,
            private_key: privateKeyJSON.private_key,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    try {
        const accessToken = await auth.getAccessToken();
    
        // Llamada a la API de Google Sheets
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`, 
                },
                body: JSON.stringify({
                    values: [rowData],
                }),
            }
        );
        
        if (!response.ok) {
            console.error('ERROR GOOGLE SHEETS:', response.status, await response.text());
        } else {
            console.log('Fila escrita exitosamente en Google Sheets.');
        }

    } catch (error) {
        console.error('Error en autenticación o escritura de Google Sheets:', error.message);
    }
}


// 2. Comunicarse con Gemini para NLU
async function getGeminiResponse(message) {
    const apiKey = process.env.GEMINI_API_KEY; 
    const prompt = `System Prompt: ${SYSTEM_PROMPT}\n\nUser Message: ${message}\n\nGenerate ONLY the JSON object:`;

    try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: {
                  responseMimeType: "application/json"
              }
            }),
          }
        );
        
        // Manejo de errores HTTP (401, 403, etc.)
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error HTTP de Gemini:', response.status, errorText);
            throw new Error(`Gemini API Error: ${response.status}`);
        }
        
        const data = await response.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!jsonText) {
             throw new Error('Gemini no devolvió JSON válido.');
        }
        
        return JSON.parse(jsonText); 

      } catch (error) {
        console.error('Error llamando a Gemini:', error.message);
        // Respuesta de emergencia que fuerza el Handoff
        return { 
            RESPUESTA_USUARIO: 'Lo siento, hay un error en nuestro sistema de IA. Un agente humano te atenderá pronto.',
            HANDOFF_REQUERIDO: true,
            INTENCION: 'ERROR' 
        };
      }
}


// --- Handler Principal del Webhook (Exportación CommonJS) ---
module.exports = async (req, res) => {
    // 1. Manejo de la Petición de Verificación (GET) - Meta
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('Verificacion GET exitosa.');
            // CORRECCIÓN FINAL: Añadir header para evitar descarga en el navegador
            res.setHeader('Content-Type', 'text/plain'); 
            return res.status(200).send(challenge);
        } else {
            res.setHeader('Content-Type', 'text/plain');
            return res.status(403).send('Token inválido.');
        }
    } 

    // 2. Manejo de la Recepción de Mensajes (POST) - WhatsApp
    else if (req.method === 'POST') {
        const body = req.body;
        const messageObject = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        const incomingMessage = messageObject?.text?.body;
        const waId = messageObject?.from;

        if (incomingMessage && waId) {
            const timestamp = new Date().toISOString();

            // LLAMADA CLAVE A GEMINI
            const geminiResult = await getGeminiResponse(incomingMessage);

            // TAREA 4: PREPARAR Y ESCRIBIR DATOS (Escritura en Sheets)
            const handoffStatus = geminiResult.HANDOFF_REQUERIDO ? 'Pendiente' : 'Automático';

            const rowData = [
                timestamp,
                waId,
                incomingMessage,
                geminiResult.INTENCION || 'Indefinida',
                geminiResult.PRESUPUESTO || 'Indefinido',
                geminiResult.TIPO_PROPIEDAD || 'Indefinido',
                geminiResult.HANDOFF_REQUERIDO ? 'SI' : 'NO',
                handoffStatus
            ];

            // Escritura en Sheets
            await writeToGoogleSheets(rowData);

            // TAREA 3: Lógica de Respuesta
            let finalResponse = geminiResult.RESPUESTA_USUARIO || 'Gracias por tu mensaje.';

            // Simulación de Handoff
            if (geminiResult.HANDOFF_REQUERIDO) {
                 finalResponse += "\n\n(Alerta Handoff: Notificando a un agente humano.)";
            }

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
