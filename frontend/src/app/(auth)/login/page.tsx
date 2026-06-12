'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/field';
import { ApiError } from '@/lib/api';
import { ease } from '@/lib/motion';
import { useAuth } from '@/store/auth';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    try {
      await login(values.email, values.password);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) setError('root', { message: err.message });
      else setError('root', { message: 'Something went wrong. Try again.' });
    }
  };

  const fillDemo = () => {
    setValue('email', 'demo@rival.app');
    setValue('password', 'Password123');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
      <h1 className="font-display text-4xl text-ink">Welcome back</h1>
      <p className="mt-2 text-sm text-ink-soft">Sign in to pick up where you left off.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        {errors.root && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {errors.root.message}
          </div>
        )}

        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@work.com" {...register('email')} />
          <FieldError>{errors.email?.message}</FieldError>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register('password')} />
          <FieldError>{errors.password?.message}</FieldError>
        </div>

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Sign in
        </Button>
        <button
          type="button"
          onClick={fillDemo}
          className="w-full text-center text-xs text-ink-faint underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          Use the demo account
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-soft">
        New here?{' '}
        <Link href="/signup" className="font-medium text-ink underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </motion.div>
  );
}
