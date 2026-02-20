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
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
    }

    #viewer-wrap {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 560px;
      background: #e5ebf1;
    }

    #viewer {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    #controls {
      position: absolute;
      left: 12px;
      bottom: 12px;
      z-index: 20;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px;
      border-radius: 10px;
      background: rgba(12, 18, 25, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(6px);
    }

    #controls button {
      appearance: none;
      border: 1px solid #9fb3c8;
      background: #ffffff;
      color: #1f2a36;
      border-radius: 8px;
      padding: 6px 10px;
      cursor: pointer;
      font: 600 12px/1.1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }

    #controls button:hover {
      background: #e9f1fb;
      border-color: #78a5d1;
    }

    #controls button:active {
      background: #d9e8f7;
    }

    @media (max-width: 800px) {
      #viewer-wrap {
        min-height: 420px;
      }

      #controls {
        left: 8px;
        right: 8px;
        bottom: 8px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      #controls button {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div id="viewer-wrap">
    <div id="viewer"></div>
    <div id="controls" role="toolbar" aria-label="Viewer controls">
      <button type="button" data-action="fit">Fit</button>
      <button type="button" data-action="home">Home</button>
      <button type="button" data-action="zoom-in">Zoom +</button>
      <button type="button" data-action="zoom-out">Zoom -</button>
      <button type="button" data-action="isolate">Isolate</button>
      <button type="button" data-action="clear">Clear</button>
    </div>
  </div>
  <script type="module">
    import { App } from "https://cdn.jsdelivr.net/npm/@modelcontextprotocol/ext-apps@1.0.1/dist/src/app-with-deps.js";

    const app = new App({ name: "ACC Viewer", version: "1.0.0" });

    let viewerReadyPromise = null;

    app.ontoolresult = async (result) => {
      const urn = result?.structuredContent?.urn;
      const config = result?.structuredContent?.config;
      if (!urn || !config) return;
      await loadModel(urn, config);
    };
    app.connect().then(() => {
      app.requestDisplayMode({ mode: "fullscreen" }).catch(() => {});
    }).catch((error) => {
      console.error("MCP App connect failed:", error);
    });

    function bindControls(viewer) {
      const controls = document.getElementById("controls");
      controls?.addEventListener("click", (event) => {
        const button = event.target instanceof HTMLElement
          ? event.target.closest("button[data-action]")
          : null;
        if (!button) return;

        const action = button.getAttribute("data-action");
        const nav = viewer.navigation;

        if (action === "fit") {
          viewer.fitToView();
          return;
        }

        if (action === "home") {
          nav?.setRequestHomeView?.(true);
          return;
        }

        if (action === "zoom-in" || action === "zoom-out") {
          const factor = action === "zoom-in" ? 0.8 : 1.25;
          const position = nav?.getPosition?.();
          const target = nav?.getTarget?.();
          if (!position || !target) return;
          const offset = position.clone().sub(target).multiplyScalar(factor);
          nav.setView(target.clone().add(offset), target);
          return;
        }

        if (action === "isolate") {
          const ids = viewer.getSelection();
          if (!ids.length) return;
          viewer.isolate(ids);
          viewer.fitToView(ids);
          return;
        }

        if (action === "clear") {
          viewer.clearSelection();
          viewer.isolate([]);
          viewer.fitToView();
        }
      });
    }

    function initViewer(config) {
      return new Promise((resolve) => {
        Autodesk.Viewing.Initializer(config, () => {
          const viewer = new Autodesk.Viewing.Viewer3D(document.getElementById("viewer"));
          const errorCode = viewer.start();
          if (errorCode !== 0) {
            console.error("Viewer failed to start:", errorCode);
          }
          bindControls(viewer);
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
                  "https://fonts.gstatic.com",
                  "https://cdn.jsdelivr.net",
                  "https://assets.claude.ai",
                  "blob:",
                  "data:"
                ],
                connectDomains: [
                  "https://developer.api.autodesk.com",
                  "https://cdn.derivative.autodesk.com",
                  "https://fonts.autodesk.com",
                  "https://fonts.gstatic.com",
                  "https://cdn.jsdelivr.net",
                  "https://assets.claude.ai",
                  "wss://cdn.derivative.autodesk.com"
                ],
                frameDomains: []
              },
              displayMode: "fullscreen",
              ...(domain ? { domain } : {})
            }
          }
        }
      ]
    };
  }
});
