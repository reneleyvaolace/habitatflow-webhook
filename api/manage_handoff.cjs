// api/manage_handoff.cjs (LÓGICA DE ESCRITURA PARA EL DASHBOARD)

const { GoogleAuth } = require('google-auth-library');
const fetch = require('node-fetch');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Extraer el ID de WhatsApp del cuerpo de la petición (del Dashboard)
        const { waId } = req.body;

        if (!waId) {
            return res.status(400).json({ error: 'Missing waId in request body.' });
        }

        // Variables de Entorno
        const sheetsId = process.env.GOOGLE_SHEETS_ID;
        const privateKeyJSON = JSON.parse(process.env.SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'));
        const sheetsEmail = privateKeyJSON.client_email;

        // Autenticación (Permisos de Escritura)
        const auth = new GoogleAuth({
            credentials: { client_email: sheetsEmail, private_key: privateKeyJSON.private_key },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Permiso de escritura
        });

        const accessToken = await auth.getAccessToken();

        // --- 1. Buscar la Fila por WhatsApp ID (waId) ---
        // Leemos todos los IDs de la columna B (donde guardamos waId)
        const searchResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/Sheet1!B:B?majorDimension=COLUMNS`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const searchData = await searchResponse.json();
        const waIds = searchData.values?.[0] || [];

        // Encontramos el índice de la fila (1-base)
        // Asumimos que la fila 1 es el encabezado, por eso es +1
        const rowIndex = waIds.findIndex(id => id === waId);
        const sheetRow = rowIndex !== -1 ? rowIndex + 1 : -1;

        if (sheetRow === -1) {
            return res.status(404).json({ message: `waId ${waId} not found in the sheet.` });
        }

        // --- 2. Actualizar el Estatus_Handoff (Columna H) ---
        // Queremos actualizar la columna H (Estatus_Handoff) de la fila encontrada
        const updateRange = `Sheet1!H${sheetRow}`; 

        const updateResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
            {
                method: 'PUT', // Método para actualizar
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                body: JSON.stringify({ values: [['Gestionado']] }),
            }
        );

        if (!updateResponse.ok) {
            console.error('Error al actualizar Sheets:', await updateResponse.text());
            throw new Error('Failed to update sheet.');
        }

        return res.status(200).json({ message: `Handoff for ${waId} marked as Gestionado on row ${sheetRow}.` });

    } catch (error) {
        console.error('Error en manage_handoff:', error.message);
        return res.status(500).json({ error: 'Internal Server Error during Handoff management.' });
    }
};
