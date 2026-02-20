import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { PUBLIC_ENDPOINT_URL } from "../config.js";

export const VIEWER_RESOURCE_URI = "ui://preview-design/viewer.html";

function resolveUiDomain(): string | undefined {
  const value = PUBLIC_ENDPOINT_URL?.trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

const VIEWER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css" type="text/css">
  <script src="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js"></script>
  <style>
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    #viewer { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="viewer"></div>
  <script type="module">
    import { App } from "https://esm.sh/@modelcontextprotocol/ext-apps";

    const app = new App({ name: "ACC Viewer", version: "1.0.0" });
    app.connect();
    app.requestDisplayMode({ mode: "pip" });

    let viewerReadyPromise = null;

    app.ontoolresult = async (result) => {
      const urn = result?.structuredContent?.urn;
      const config = result?.structuredContent?.config;
      if (!urn || !config) return;
      await loadModel(urn, config);
    };

    function initViewer(config) {
      return new Promise((resolve) => {
        Autodesk.Viewing.Initializer(config, () => {
          const viewer = new Autodesk.Viewing.GuiViewer3D(document.getElementById("viewer"));
          viewer.start();
          viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, async () => {
            const ids = viewer.getSelection();
            const text = ids.length > 0
              ? \`User selected objects with IDs: \${ids.join(", ")}\`
              : "No objects selected";
            await app.updateModelContext({ content: [{ type: "text", text }] });
          });
          resolve(viewer);
        });
      });
    }

    async function loadModel(urn, config) {
      if (!viewerReadyPromise) {
        viewerReadyPromise = initViewer(config);
      }
      const viewer = await viewerReadyPromise;

      Autodesk.Viewing.Document.load(
        "urn:" + urn,
        (doc) => {
          const defaultGeometry = doc.getRoot().getDefaultGeometry();
          viewer.loadDocumentNode(doc, defaultGeometry);
        },
        (errorCode, errorMessage) => {
          console.error("Failed to load document:", errorCode, errorMessage);
        }
      );
    }
  </script>
</body>
</html>`;

export const viewerResourceFactory = (_options?: unknown) => ({
  name: "viewer",
  uri: VIEWER_RESOURCE_URI,
  config: {
    mimeType: RESOURCE_MIME_TYPE
  },
  callback: async () => {
    const domain = resolveUiDomain();
    return {
      contents: [
        {
          uri: VIEWER_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: VIEWER_HTML,
          _meta: {
            ui: {
              csp: {
                resourceDomains: [
                  "https://developer.api.autodesk.com",
                  "https://cdn.derivative.autodesk.com",
                  "https://fonts.autodesk.com",
                  "https://esm.sh",
                  "blob:",
                  "data:"
                ],
                connectDomains: [
                  "https://developer.api.autodesk.com",
                  "https://cdn.derivative.autodesk.com",
                  "https://fonts.autodesk.com",
                  "https://esm.sh",
                  "wss://cdn.derivative.autodesk.com"
                ],
                frameDomains: []
              },
              ...(domain ? { domain } : {})
            }
          }
        }
      ]
    };
  }
});
