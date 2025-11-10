import styled from "styled-components";

export const PageWrapper = styled.main`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at top, #151826, #050309);
  color: #f5f5f5;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "SF Pro Display", sans-serif;
`;

export const Card = styled.div`
  width: 100%;
  max-width: 420px;
  padding: 2.5rem 2rem;
  border-radius: 1.5rem;
  background: rgba(10, 10, 20, 0.9);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(18px);
`;

export const Title = styled.h1`
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
`;

export const Subtitle = styled.p`
  font-size: 0.9rem;
  opacity: 0.7;
  margin-bottom: 1.75rem;
`;

export const Label = styled.label`
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
  margin-bottom: 0.5rem;
  display: block;
`;

export const Input = styled.input`
  width: 100%;
  padding: 0.75rem 0.9rem;
  border-radius: 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(5, 5, 15, 0.9);
  color: inherit;
  font-size: 0.95rem;

  &:focus {
    outline: none;
    border-color: #7f5af0;
    box-shadow: 0 0 0 1px rgba(127, 90, 240, 0.5);
  }
`;

export const Button = styled.button`
  margin-top: 1.5rem;
  width: 100%;
  padding: 0.8rem 1rem;
  border-radius: 0.9rem;
  border: none;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  background: linear-gradient(135deg, #7f5af0, #2cb67d);
  color: #050309;
  transition: transform 0.05s ease-out, box-shadow 0.05s ease-out;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
  }

  &:active {
    transform: translateY(0);
    box-shadow: none;
  }
`;

export const Footer = styled.p`
  margin-top: 1.5rem;
  font-size: 0.75rem;
  opacity: 0.5;
`;
