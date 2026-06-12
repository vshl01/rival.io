'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/field';
import { ApiError } from '@/lib/api';
import { ease } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[a-z]/, 'Add a lowercase letter')
    .regex(/[A-Z]/, 'Add an uppercase letter')
    .regex(/[0-9]/, 'Add a number'),
});
type Values = z.infer<typeof schema>;

const RULES = [
  { test: (p: string) => p.length >= 8, label: '8+ characters' },
  { test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p), label: 'Upper & lowercase' },
  { test: (p: string) => /[0-9]/.test(p), label: 'A number' },
];

export default function SignupPage() {
  const router = useRouter();
  const signup = useAuth((s) => s.signup);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onChange' });

  const password = watch('password') ?? '';

  const onSubmit = async (values: Values) => {
    try {
      await signup(values.name, values.email, values.password);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldErrors) {
          for (const [field, msgs] of Object.entries(err.fieldErrors)) {
            setError(field as keyof Values, { message: msgs[0] });
          }
        } else {
          setError('root', { message: err.message });
        }
      } else {
        setError('root', { message: 'Something went wrong. Try again.' });
      }
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
      <h1 className="font-display text-4xl text-ink">Create your account</h1>
      <p className="mt-2 text-sm text-ink-soft">Start outpacing your backlog in seconds.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        {errors.root && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {errors.root.message}
          </div>
        )}

        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" autoComplete="name" placeholder="Ada Lovelace" {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@work.com" {...register('email')} />
          <FieldError>{errors.email?.message}</FieldError>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" {...register('password')} />
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {RULES.map((r) => {
              const passed = r.test(password);
              return (
                <span
                  key={r.label}
                  className={cn(
                    'inline-flex items-center gap-1 text-xs transition-colors',
                    passed ? 'text-accent' : 'text-ink-faint',
                  )}
                >
                  <Check className={cn('h-3 w-3', !passed && 'opacity-40')} />
                  {r.label}
                </span>
              );
            })}
          </div>
        </div>

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-soft">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}
