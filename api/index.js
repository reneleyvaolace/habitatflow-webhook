// api/index.js (FINAL - Conexión Gemini y Google Sheets)

// Usamos Google Auth y Google Sheets API con fetch
import { JWT } from 'google-auth-library';
import fetch from 'node-fetch'; // Necesitamos 'node-fetch' para llamadas POST y GET


// System Prompt (Rol de la IA)
const SYSTEM_PROMPT = `
    Eres 'HabitatFlow AI', un Agente Experto en Calificación de Leads Inmobiliarios que opera 24/7 a través de WhatsApp.
    Tu rol es evaluar inmediatamente la intención, el presupuesto (rango) y el tipo de propiedad deseada del usuario para clasificarlo.
    Debes responder con un objeto JSON válido con las claves:
    'RESPUESTA_USUARIO' (Máx 256 carac.), 'INTENCION' (Compra/Renta/Inversión/Indefinida), 'PRESUPUESTO' (Bajo/Medio/Alto/Lujo/Indefinido), 'TIPO_PROPIEDAD' (Casa/Departamento/Terreno/Indefinido), y 'HANDOFF_REQUERIDO' (TRUE o FALSE).
    Si detectas frustración o la calificación es de 'Lujo' (> $5M USD), establece HANDOFF_REQUERIDO: TRUE.
`;

const VERIFY_TOKEN = 'coreaura-token-seguro-456'; 

// --- Funciones Clave ---

// 1. Escribir datos en Google Sheets
async function writeToGoogleSheets(rowData) {
    const sheetsId = process.env.GOOGLE_SHEETS_ID;
    const privateKeyJSON = JSON.parse(process.env.SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'));
    const sheetsEmail = process.env.GOOGLE_SHEETS_EMAIL;
    
    // Autenticación JWT (la forma segura con la clave de servicio)
    const jwtClient = new JWT({
        email: sheetsEmail,
        key: privateKeyJSON.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const accessToken = await jwtClient.authorize();
    
    // Llamada a la API de Google Sheets
    const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken.access_token}`,
            },
            body: JSON.stringify({
                values: [rowData], // rowData es el array de valores que insertaremos
            }),
        }
    );
    
    if (response.status !== 200) {
        console.error('Error al escribir en Google Sheets:', await response.text());
    }
}


// 2. Comunicarse con Gemini para NLU
async function getGeminiResponse(message) {
    const apiKey = process.env.GEMINI_API_KEY; 
    
    // El prompt le pide explícitamente el JSON.
    const prompt = `System Prompt: ${SYSTEM_PROMPT}\n\nUser Message: ${message}\n\nGenerate ONLY the JSON object:`;

    // Llamada a la API de Gemini
    // ... [código de fetch a Gemini idéntico al anterior] ...
    // Nota: Por simplicidad, el resto del código es el mismo que usamos antes para la llamada a Gemini,
    // que devuelve el JSON de calificación.
    
    // --- (INICIO del código de fetch a Gemini - ÚSALO COMPLETO) ---

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
                  responseMimeType: "application/json"
              }
            }),
          }
        );
        
        const data = await response.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return JSON.parse(jsonText); 

      } catch (error) {
        console.error('Error llamando a Gemini:', error);
        return { 
            RESPUESTA_USUARIO: 'Lo siento, error en IA.',
            HANDOFF_REQUERIDO: true,
            INTENCION: 'ERROR' 
        };
      }
    // --- (FIN del código de fetch a Gemini) ---
}


// --- Handler Principal del Webhook ---
module.exports = async (req, res) => {
    // 1. Manejo de la Petición de Verificación (GET)
    if (req.method === 'GET') {
        // ... [código de verificación idéntico al anterior] ...
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
        const messageObject = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        const incomingMessage = messageObject?.text?.body;
        const waId = messageObject?.from; // ID del cliente de WhatsApp

        if (incomingMessage && waId) {
            const timestamp = new Date().toISOString();

            // LLAMADA CLAVE A GEMINI
            const geminiResult = await getGeminiResponse(incomingMessage);

            // TAREA 4: PREPARAR Y ESCRIBIR DATOS
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
            
            await writeToGoogleSheets(rowData);
            console.log('Fila escrita en Google Sheets:', rowData);

            // TAREA 3: Lógica de Respuesta
            let finalResponse = geminiResult.RESPUESTA_USUARIO || 'Gracias por tu mensaje.';

            // Simulación de respuesta (En el siguiente paso se integraría la API de WhatsApp para responder)
            if (geminiResult.HANDOFF_REQUERIDO) {
                 finalResponse += "\n\n(Alerta Handoff: Notificando a un agente humano.)";
            }
            
            console.log("Respuesta de la IA lista:", finalResponse);
        }

        return res.status(200).send('EVENT_RECEIVED'); 
    } 
    
    // 3. Otros métodos HTTP
    else {
        res.status(405).send('Método no permitido');
    }
};
