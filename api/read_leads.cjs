// api/read_leads.cjs (LÓGICA DE LECTURA SEGURA PARA EL DASHBOARD)

const { GoogleAuth } = require('google-auth-library');
const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Configuramos los headers para que el frontend pueda acceder
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Content-Type', 'application/json');

    // Solo permitimos peticiones GET desde el frontend
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Variables de Entorno
        const sheetsId = process.env.GOOGLE_SHEETS_ID;
        const privateKeyJSON = JSON.parse(process.env.SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'));
        const sheetsEmail = privateKeyJSON.client_email;

        // Autenticación de Lectura
        const auth = new GoogleAuth({
            credentials: {
                client_email: sheetsEmail,
                private_key: privateKeyJSON.private_key,
            },
            // Permiso de solo lectura
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], 
        });

        const accessToken = await auth.getAccessToken();

        // Llamada a la API de Google Sheets para leer todos los datos
        const response = await fetch(
            // Lee el rango A1 hasta la última columna de la Hoja 1
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/Sheet1!A1:Z1000`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            console.error('Error al leer Sheets:', response.status, await response.text());
            return res.status(500).json({ error: 'Failed to fetch data from Google Sheets' });
        }

        const data = await response.json();

        // Enviamos los datos al frontend del Dashboard
        return res.status(200).json({ leads: data.values || [] });

    } catch (error) {
        console.error('Error en read_leads:', error.message);
        // Si la autenticación falla, devolvemos un error 500
        return res.status(500).json({ error: 'Authentication or parsing failed' });
    }
};
