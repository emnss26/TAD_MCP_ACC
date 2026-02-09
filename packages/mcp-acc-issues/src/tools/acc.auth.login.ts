import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "http";
import { parse } from "url";
import { z } from "zod"; 
import { saveSession } from "@tad/shared"; 
import type { ApsTokenResponse } from "@tad/shared"; 

export function registerLoginTool(server: McpServer) {
  server.registerTool(
    "acc_login",
    {
      title: "Autodesk Login",
      description: "Inicia el proceso de autenticación interactivo para obtener acceso a ACC.",
      inputSchema: z.object({}).shape
    },
    async () => {
      const clientId = process.env.APS_CLIENT_ID!;
      const clientSecret = process.env.APS_CLIENT_SECRET!;
      const redirectUri = "http://localhost:8787/callback";
      
  
      const envScopes = process.env.APS_SCOPES;
      const scopes = envScopes ? envScopes.replace(/'/g, "").trim() : "account:read data:read data:create data:write";

      const port = 8787;

      const startServer = () => {
        const httpServer = createServer(async (req, res) => {
          const u = parse(req.url!, true);
          
          if (u.pathname === "/callback") {
            const code = u.query.code as string;
            try {
              const tokenUrl = "https://developer.api.autodesk.com/authentication/v2/token";
              
              const body = new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri
              });

              // Auth en Headers
              const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
              
              const apiRes = await fetch(tokenUrl, {
                method: "POST",
                headers: { 
                  "Authorization": `Basic ${basic}`,
                  "Content-Type": "application/x-www-form-urlencoded"
                },
                body
              });
              
              const data = (await apiRes.json()) as ApsTokenResponse;
              
              if (apiRes.ok) {
                saveSession({
                  access_token: data.access_token,
                  refresh_token: data.refresh_token!,
                  expires_at: Math.floor(Date.now()/1000) + data.expires_in
                });
                
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(`
                  <html>
                    <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                      <h1 style="color: green;"> Login successful</h1>
                      <p>Token guardado. Puedes cerrar esta ventana y volver a Claude.</p>
                      <script>window.close();</script>
                    </body>
                  </html>
                `);
              } else {
                console.error("Error API Autodesk Error :", data);
                res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                res.end(`<h1> Error de Autodesk</h1><p>${JSON.stringify(data)}</p>`);
              }
            } catch (e) {
              console.error(" Error interno:", e);
              res.writeHead(500);
              res.end("Error interno del servidor");
            } finally {
              httpServer.close();
            }
          }
        });

        httpServer.on('error', (e: any) => {
            if (e.code === 'EADDRINUSE') {
                console.error(` El puerto ${port} está ocupado.`);
            }
        });

        httpServer.listen(port);
      };

      startServer();

      const authParams = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes
      });

      const authUrl = `https://developer.api.autodesk.com/authentication/v2/authorize?${authParams.toString()}`;

      return {
        content: [{
          type: "text",
          
          text: `
            --- DATOS TÉCNICOS ---
            Estado: Servidor de escucha iniciado en puerto ${port}.
            URL de Autenticación: ${authUrl}

            --- INSTRUCCIÓN OBLIGATORIA PARA EL ASISTENTE (CLAUDE) ---
            1. El usuario NO puede ver este bloque de resultado técnico (está oculto).
            2. Es CRÍTICO que COPIES la "URL de Autenticación" de arriba y la pongas explícitamente en tu respuesta final de texto.
            3. No digas "haz clic arriba". Di: "Por favor ingresa a este enlace para autorizar: [URL]" y pega la URL completa.
            `
        }]
      };
    }
  );
}