import { Resend } from 'resend';
import * as React from 'react';
import { AdminPaymentAlertEmail } from '@/emails/admin-payment-alert-email';
import { PasswordResetEmail } from '@/emails/password-reset-email';
import { PaymentFailureEmail } from '@/emails/payment-failure-email';
import { PaymentSuccessEmail } from '@/emails/payment-success-email';
import { WelcomeEmail } from '@/emails/welcome-email';

async function sendTemplateEmail({
  to,
  subject,
  reactNode,
}: {
  to: string;
  subject: string;
  reactNode: React.ReactElement;
}): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.AUTH_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return { ok: false, reason: 'missing-config' };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      react: reactNode,
    });

    if (error) {
      console.error('Resend email failed:', error);
      return { ok: false, reason: error.message || 'resend-failed' };
    }

    return { ok: true };
  } catch (error) {
    console.error('Transactional email error:', error);
    return { ok: false, reason: 'send-failed' };
  }
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string;
  resetUrl: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return sendTemplateEmail({
    to,
    subject: 'Reset your Northern Heritage Library password',
    reactNode: React.createElement(PasswordResetEmail, { resetUrl }),
  });
}

export async function sendWelcomeEmail({
  to,
  name,
}: {
  to: string;
  name?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return sendTemplateEmail({
    to,
    subject: 'Welcome to Northern Heritage Library',
    reactNode: React.createElement(WelcomeEmail, { name: name ?? 'reader' }),
  });
}

export async function sendPaymentSuccessEmail({
  to,
  name,
  storyTitle,
  amount,
  reference,
}: {
  to: string;
  name?: string;
  storyTitle: string;
  amount: number;
  reference: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return sendTemplateEmail({
    to,
    subject: 'Your Northern Heritage Library payment was successful',
    reactNode: React.createElement(PaymentSuccessEmail, {
      name: name ?? 'reader',
      storyTitle,
      amount,
      reference,
    }),
  });
}

export async function sendPaymentFailureEmail({
  to,
  name,
  storyTitle,
  amount,
  reference,
}: {
  to: string;
  name?: string;
  storyTitle: string;
  amount: number;
  reference: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return sendTemplateEmail({
    to,
    subject: 'Your Northern Heritage Library payment could not be completed',
    reactNode: React.createElement(PaymentFailureEmail, {
      name: name ?? 'reader',
      storyTitle,
      amount,
      reference,
    }),
  });
}

export async function sendAdminPaymentAlertEmail({
  to,
  userEmail,
  storyTitle,
  amount,
  reference,
}: {
  to: string;
  userEmail: string;
  storyTitle: string;
  amount: number;
  reference: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return sendTemplateEmail({
    to,
    subject: 'New library payment received',
    reactNode: React.createElement(AdminPaymentAlertEmail, {
      userEmail,
      storyTitle,
      amount,
      reference,
    }),
  });
}
