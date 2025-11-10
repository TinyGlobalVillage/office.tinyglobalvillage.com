//  ~/client/office.tinyglobalvillage.com/src/app/layout.tsx

import GlobalStyle from '@/styles/GlobalStyles';
import StyledComponentsRegistry from '@/styles/StyledComponentsRegistry';


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StyledComponentsRegistry>
          <GlobalStyle />
          {children}
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
