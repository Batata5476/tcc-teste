import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <title>Coopera</title>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                width: 100%;
                height: 100%;
                overscroll-behavior: none;
                -webkit-text-size-adjust: 100%;
                touch-action: manipulation;
              }
              #root {
                display: flex;
                flex: 1;
                width: 100%;
                height: 100%;
              }
              /* Remove o retângulo azul nativo de foco (focus ring / outline) do navegador */
              input, textarea, select,
              input:focus, textarea:focus, select:focus,
              input:focus-visible, textarea:focus-visible, select:focus-visible {
                outline: none !important;
                outline-width: 0 !important;
                outline-style: none !important;
                box-shadow: none !important;
              }
              /* Impede o Safari do iPhone de dar auto-zoom ao focar em campos de texto (< 16px) */
              @media screen and (max-width: 768px) {
                input, textarea, select {
                  font-size: 16px !important;
                }
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
