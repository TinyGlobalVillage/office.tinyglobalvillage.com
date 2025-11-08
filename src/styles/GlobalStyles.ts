// src/styles/GlobalStyles.ts
import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body {
    font-family: 'Neuzeit', sans-serif;
    background: #000;
    color: #fff;
  }

  a {
    color: inherit;
    text-decoration: none;
  }
`;

export default GlobalStyle;
