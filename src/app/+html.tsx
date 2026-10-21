// biome-ignore-all lint/security/noDangerouslySetInnerHtml: static web-only CSS, no user input
import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

// Web-only root HTML for static rendering.
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body { background-color: #0a0a0a; }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
