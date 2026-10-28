import { z } from 'zod';

export const MovementInputSchema = z.object({
  type: z.enum(['ENTRADA', 'SALIDA']),
  category: z.string().min(1, 'La categoría es obligatoria'),
  amount: z.coerce.number().positive('El monto debe ser un valor mayor a cero'),
  description: z.string().min(1, 'La descripción es obligatoria').max(500),
  product_id: z.coerce.number().int().positive().nullable().optional(),
  quantity: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1').default(1),
  is_unplanned: z.boolean().default(false),
  movement_date: z.string().optional(),
});

export type MovementInput = z.infer<typeof MovementInputSchema>;

export const ProductInputSchema = z.object({
  name: z.string().min(1, 'El nombre del producto es obligatorio').max(120),
  supply_model: z.enum(['REVENTA', 'PRODUCCION']),
  unit_cost: z.coerce.number().min(0, 'El costo unitario no puede ser negativo'),
  extra_cost: z.coerce.number().min(0, 'El costo extra no puede ser negativo').default(0),
  sale_price: z.coerce.number().min(0, 'El precio de venta no puede ser negativo'),
  stock: z.coerce.number().int().min(0, 'El stock no puede ser negativo').default(0),
});

export type ProductInput = z.infer<typeof ProductInputSchema>;

export const ReminderInputSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio').max(120),
  amount: z.coerce.number().min(0, 'El monto no puede ser negativo').default(0),
  category: z.string().min(1).default('SERVICIOS_ARRIENDO'),
  frequency: z.enum(['UNICO', 'SEMANAL', 'QUINCENAL', 'MENSUAL']),
  due_date: z.string().min(1, 'La fecha límite es obligatoria'),
});

export type ReminderInput = z.infer<typeof ReminderInputSchema>;

export const AuthLoginSchema = z.object({
  username: z.string().min(1, 'El usuario es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export type AuthLoginInput = z.infer<typeof AuthLoginSchema>;

export const AuthRegisterSchema = z.object({
  username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres').max(50),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  business_name: z.string().min(2, 'El nombre del negocio debe tener al menos 2 caracteres').default('Mi Negocio'),
});

export type AuthRegisterInput = z.infer<typeof AuthRegisterSchema>;
