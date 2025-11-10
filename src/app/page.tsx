'use client';

import styled from 'styled-components';

const HeroSection = styled.section`
  height: 100vh;
  background-color: #000; /* fallback in case image is slow to load */
  background-image: url('/images/backgrounds/void.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
`;

const MainContent = styled.main`
  color: #00ffff;
  text-align: center;
  padding-top: 20vh;
`;

export default function Home() {
  return (
    <HeroSection>
      <MainContent>
        <h1>
          🚧 Welcome to the Temporary Gateway for office.tinyglobalvillage.com 🚧
        </h1>
        <p>
          This website is currently under construction.
        </p>
        <p>Please check back soon!!</p>
      </MainContent>
    </HeroSection>
  );
}
