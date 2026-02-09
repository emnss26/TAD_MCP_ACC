import { createServer } from "http";
import { parse } from "url";

// Cargar variables de entorno manualmente o asegurar que se ejecute con --env-file o dotenv
const CLIENT_ID = process.env.APS_CLIENT_ID;
const CLIENT_SECRET = process.env.APS_CLIENT_SECRET;
const CALLBACK_URL = process.env.APS_CALLBACK_URL; // Debe ser http://localhost:8787/callback
const SCOPES = process.env.APS_SCOPES || "data:read data:write account:read";

if (!CLIENT_ID || !CLIENT_SECRET || !CALLBACK_URL) {
  console.error("❌ Error: Faltan variables de entorno (APS_CLIENT_ID, APS_CLIENT_SECRET o APS_CALLBACK_URL).");
  console.error("Asegúrate de tener tu archivo .env configurado y cargado.");
  process.exit(1);
}

const port = 8787; // Debe coincidir con tu CALLBACK_URL

const server = createServer(async (req, res) => {
  const url = parse(req.url!, true);

  // Escuchar el callback de Autodesk
  if (url.pathname === "/callback") {
    const code = url.query.code as string;
    
    if (code) {
      try {
        // Intercambiar el código por el token
        const tokenUrl = "https://developer.api.autodesk.com/authentication/v2/token";
        const body = new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: CALLBACK_URL,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET
        });

        // Autenticación Basic para el endpoint de token
        const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

        const response = await fetch(tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${basic}`
          },
          body: body
        });

        const data = await response.json();

        if (response.ok) {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`
                <h1 style="color:green">Token Generado con Éxito</h1>
                <p>Ya puedes cerrar esta ventana.</p>
                <p>Copia el <strong>Refresh Token</strong> de tu terminal.</p>
            `);
            
            console.log("\n✅ ¡AUTENTICACIÓN EXITOSA!\n");
            console.log("====================================================");
            console.log("COPIA ESTE VALOR EN TU ARCHIVO .env (APS_REFRESH_TOKEN):");
            console.log("====================================================");
            console.log("\n" + data.refresh_token + "\n");
            console.log("====================================================");
            
            server.close();
            process.exit(0);
        } else {
            res.writeHead(500);
            res.end("Error obteniendo token: " + JSON.stringify(data));
            console.error("❌ Error de API:", data);
        }

      } catch (e) {
        console.error(e);
        res.writeHead(500);
        res.end("Error interno del servidor");
      }
    }
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(port, () => {
    const authUrl = `https://developer.api.autodesk.com/authentication/v2/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&scope=${encodeURIComponent(SCOPES)}`;
    
    console.log(`\n🚀 Servidor de autenticación iniciado en puerto ${port}.`);
    console.log("👉 Abre la siguiente URL en tu navegador para loguearte con tu cuenta de Autodesk:\n");
    console.log(authUrl);
    console.log("\nEsperando callback...");
});