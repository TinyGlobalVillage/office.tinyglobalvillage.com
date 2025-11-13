'use client';

import styled from "styled-components";

export const Page = styled.div`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 260px 1fr;
  background: radial-gradient(circle at top, #171b2b, #050309);
  color: #f5f5f5;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "SF Pro Display", sans-serif;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
`;

export const Sidebar = styled.aside`
  padding: 1.75rem 1.25rem;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(3, 4, 12, 0.9);
  backdrop-filter: blur(20px);

  @media (max-width: 900px) {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 1.5rem;
  }
`;

export const Brand = styled.div`
  margin-bottom: 2rem;

  @media (max-width: 900px) {
    margin-bottom: 0;
  }
`;

export const BrandTitle = styled.div`
  font-size: 1.05rem;
  font-weight: 600;
`;

export const BrandSubtitle = styled.div`
  font-size: 0.8rem;
  opacity: 0.6;
`;

export const NavSection = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  @media (max-width: 900px) {
    flex-direction: row;
    gap: 0.8rem;
  }
`;

export const NavItem = styled.button<{ $active?: boolean }>`
  width: 100%;
  text-align: left;
  border-radius: 0.8rem;
  border: none;
  padding: 0.6rem 0.7rem;
  font-size: 0.85rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  cursor: pointer;
 background: ({ $active }: { $active?: boolean }) =>
    $active ? "rgba(127, 90, 240, 0.18)" : "transparent";

  color: ({ $active }: { $active?: boolean }) =>
    $active ? "#fff" : "rgba(245,245,245,0.75)";
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }
`;

export const Main = styled.main`
  padding: 1.75rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  @media (max-width: 600px) {
    padding: 1.2rem 1.1rem;
  }
`;

export const TopBar = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.25rem;
`;

export const HeadingGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`;

export const Title = styled.h1`
  font-size: 1.35rem;
  margin: 0;
`;

export const Subtitle = styled.p`
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.7;
`;

export const UserBadge = styled.div`
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15rem;
  padding: 0.6rem 0.9rem;
  border-radius: 999px;
  background: rgba(5, 5, 15, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
`;

export const UserEmail = styled.div`
  font-size: 0.8rem;
`;

export const UserRole = styled.span`
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  background: rgba(127, 90, 240, 0.15);
`;

export const Grid = styled.section`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.1rem;
  align-items: stretch;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`;

export const Card = styled.div`
  padding: 1rem 1rem;
  border-radius: 1.1rem;
  background: rgba(7, 8, 20, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
`;

export const CardTitle = styled.div`
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
  margin-bottom: 0.4rem;
`;

export const BigNumber = styled.div`
  font-size: 1.6rem;
  font-weight: 600;
`;

export const Placeholder = styled.p`
  font-size: 0.8rem;
  opacity: 0.7;
  margin-top: 0.25rem;
`;

export const LogoutButton = styled.button`
  margin-top: 0.3rem;
  border: none;
  background: transparent;
  color: rgba(245, 245, 245, 0.7);
  font-size: 0.75rem;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  align-self: flex-end;

  &:hover {
    color: #fff;
  }
`;
