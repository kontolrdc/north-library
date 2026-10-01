import ForgetPasswordForm from '@/app/components/auth/forget-password-form';

export default async function ForgetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ForgetPasswordForm initialToken={token ?? ''} />;
}
