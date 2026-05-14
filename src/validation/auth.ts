import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email requis')
    .email('Email invalide'),
  password: z
    .string()
    .min(1, 'Mot de passe requis'),
});

const registerClientBaseSchema = z.object({
  first_name: z
    .string()
    .min(2, 'Minimum 2 caracteres'),
  last_name: z
    .string()
    .min(2, 'Minimum 2 caracteres'),
  email: z
    .string()
    .min(1, 'Email requis')
    .email('Email invalide'),
  phone: z
    .string()
    .min(8, 'Numero invalide'),
  password: z
    .string()
    .min(8, 'Minimum 8 caracteres')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[0-9]/, 'Au moins un chiffre'),
  confirm_password: z
    .string()
    .min(1, 'Confirmation requise'),
});

const passwordMatch = (data: { password: string; confirm_password: string }) =>
  data.password === data.confirm_password;

const passwordMatchError = {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirm_password'],
};

export const registerClientSchema = registerClientBaseSchema.refine(
  passwordMatch,
  passwordMatchError,
);

export const registerProviderSchema = registerClientBaseSchema
  .extend({
    company_name: z
      .string()
      .min(2, 'Nom de societe requis'),
  })
  .refine(passwordMatch, passwordMatchError);

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email requis')
    .email('Email invalide'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Minimum 8 caracteres')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[0-9]/, 'Au moins un chiffre'),
  confirm_password: z
    .string()
    .min(1, 'Confirmation requise'),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirm_password'],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterClientFormData = z.infer<typeof registerClientSchema>;
export type RegisterProviderFormData = z.infer<typeof registerProviderSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
