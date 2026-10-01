import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';

export function AdminPaymentAlertEmail({
  userEmail,
  storyTitle,
  amount,
  reference,
}: {
  userEmail: string;
  storyTitle: string;
  amount: number;
  reference: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>New payment received</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={heading}>Payment received</Text>
            <Text style={text}>A new payment was completed successfully.</Text>
            <Text style={text}>
              User: {userEmail}
              <br />
              Story: {storyTitle}
              <br />
              Amount: GHS {amount.toFixed(2)}
              <br />
              Reference: {reference}
            </Text>
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
