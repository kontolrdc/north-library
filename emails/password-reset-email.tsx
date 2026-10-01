import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

export function PasswordResetEmail({ resetUrl }: { resetUrl: string }) {
  return (
    <Html>
      <Head />
      <Preview>Reset your Northern Heritage Library password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={heading}>Northern Heritage Library</Text>
            <Text style={text}>Hi there,</Text>
            <Text style={text}>
              We received a request to reset your password. Use the button below to choose a new
              one. This link expires in one hour for security.
            </Text>
            <Button href={resetUrl} style={button}>
              Reset password
            </Button>
            <Text style={mutedText}>
              If you did not request this, you can safely ignore this email and your account will
              remain unchanged.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f4f1ea',
  fontFamily: 'Arial, sans-serif',
  margin: 0,
  padding: '32px 0',
};

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5dcc7',
  borderRadius: '12px',
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px',
};

const heading = {
  fontSize: '24px',
  fontWeight: 700,
  color: '#1f2937',
  margin: '0 0 20px',
};

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 20px',
};

const mutedText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '20px 0 0',
};

const button = {
  backgroundColor: '#3b2f22',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: 600,
  lineHeight: '1',
  padding: '14px 24px',
  textDecoration: 'none',
};
