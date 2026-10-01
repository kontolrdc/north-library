import { Body, Button, Container, Head, Html, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';

export function PaymentSuccessEmail({
  name,
  storyTitle,
  amount,
  reference,
}: {
  name: string;
  storyTitle: string;
  amount: number;
  reference: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Your payment was successful</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={heading}>Payment successful</Text>
            <Text style={text}>Hi {name || 'reader'},</Text>
            <Text style={text}>
              Your payment for <strong>{storyTitle}</strong> was successful. Your access has been granted.
            </Text>
            <Text style={text}>
              Amount paid: GHS {amount.toFixed(2)}
              <br />
              Reference: {reference}
            </Text>
            <Button href={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/catalog`} style={button}>
              Continue reading
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: '#f4f1ea', fontFamily: 'Arial, sans-serif', margin: 0, padding: '32px 0' };
const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5dcc7',
  borderRadius: '12px',
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px',
};
const heading = { fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0 0 20px' };
const text = { color: '#374151', fontSize: '16px', lineHeight: '1.6', margin: '0 0 20px' };
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
