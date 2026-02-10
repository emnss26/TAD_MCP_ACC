import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { completeLogin } from "@tad/shared";

const Input = z.object({
  codeOrUrl: z.string().min(3),
});

type Args = z.infer<typeof Input>;

export function registerAccAuthLogin(server: McpServer) {
  server.registerTool(
    "acc_auth_login",
    {
      title: "ACC Auth - Complete",
      description: "Completa el login pegando el redirect URL o el code.",
      inputSchema: Input.shape,
    },
    async (args: Args) => {
      const token = await completeLogin({ codeOrUrl: args.codeOrUrl });

      return {
        content: [
          { type: "text", text: "Login OK. Tokens guardados." },
          { type: "text", text: JSON.stringify({ token_type: token.token_type, scope: token.scope }, null, 2) },
        ],
      };
    }
  );
}
