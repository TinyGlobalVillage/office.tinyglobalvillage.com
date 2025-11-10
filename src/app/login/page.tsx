// src/app/login/page.tsx

import { loginWithEmail } from "./actions";

import {
  PageWrapper,
  Card,
  Title,
  Subtitle,
  Label,
  Input,
  Button,
  // Footer,
} from "./login-styles";

export default function LoginPage() {
  return (
    <PageWrapper>
      <Card>
        <Title>Tiny Global Village Office</Title>
        <Subtitle>Log into your internal command center.</Subtitle>

        <form action={loginWithEmail}>
          <div>
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@tinyglobalvillage.com"
              required
              autoComplete="email"
            />
          </div>

          <Button type="submit">Enter Office</Button>
        </form>


      </Card>
    </PageWrapper>
  );
}
