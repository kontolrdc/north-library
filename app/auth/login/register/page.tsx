import { redirect } from 'next/navigation';
import RegistrationForm from '@/app/components/auth/registration-form';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const hasCredentialsInUrl = ['name', 'email', 'password'].some((key) => key in params);

  if (hasCredentialsInUrl) {
    redirect('/auth/login/register');
  }

  return <RegistrationForm />;
}
