import { z } from 'zod';

export const ENTRADA_CATEGORIES = [
  'VENTA_PRODUCTO',
  'APORTE_CAPITAL',
  'OTRO_INGRESO',
] as const;

export const SALIDA_CATEGORIES = [
  'GASTO_GENERAL',
  'COMPRA_CATALOGO',
  'MATERIA_PRIMA',
  'SERVICIOS_ARRIENDO',
  'GASTO_NO_PLANEADO',
  'RETIRO_PERSONAL',
] as const;

export type EntradaCategory = (typeof ENTRADA_CATEGORIES)[number];
export type SalidaCategory = (typeof SALIDA_CATEGORIES)[number];

export const MovementInputSchema = z
  .object({
    type: z.enum(['ENTRADA', 'SALIDA']),
    category: z.string().min(1, 'La categoría es obligatoria'),
    amount: z.coerce.number().positive('El monto debe ser un valor mayor a cero'),
    description: z.string().min(1, 'La descripción es obligatoria').max(500),
    product_id: z.coerce.number().int().positive().nullable().optional(),
    quantity: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1').default(1),
    is_unplanned: z.boolean().default(false),
    movement_date: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'ENTRADA') {
      if (!ENTRADA_CATEGORIES.includes(data.category as EntradaCategory)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Categoría inválida para ENTRADA. Opciones válidas: ${ENTRADA_CATEGORIES.join(', ')}`,
          path: ['category'],
        });
      }
    } else if (data.type === 'SALIDA') {
      if (!SALIDA_CATEGORIES.includes(data.category as SalidaCategory)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Categoría inválida para SALIDA. Opciones válidas: ${SALIDA_CATEGORIES.join(', ')}`,
          path: ['category'],
        });
      }
    }

    if (
      data.category === 'VENTA_PRODUCTO' ||
      data.category === 'COMPRA_CATALOGO' ||
      data.category === 'MATERIA_PRIMA'
    ) {
      if (!data.product_id || typeof data.product_id !== 'number' || data.product_id <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Se requiere un product_id numérico válido para esta categoría',
          path: ['product_id'],
        });
      }
    }
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

export const UpdateStockSchema = z.object({
  id: z.coerce.number().int().positive('El ID debe ser un entero positivo'),
  stock: z.coerce.number().int().min(0, 'El stock no puede ser negativo'),
});

export type UpdateStockInput = z.infer<typeof UpdateStockSchema>;

export const ReminderInputSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio').max(120),
  amount: z
    .coerce
    .number()
    .min(0, 'El monto no puede ser negativo')
    .max(999999999.99, 'El monto excede el valor máximo permitido')
    .default(0),
  category: z.string().min(1).default('SERVICIOS_ARRIENDO'),
  frequency: z.enum(['UNICO', 'SEMANAL', 'QUINCENAL', 'MENSUAL']),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha límite debe tener el formato YYYY-MM-DD'),
});

export type ReminderInput = z.infer<typeof ReminderInputSchema>;

export const MarkReminderPaidSchema = z.object({
  id: z.coerce.number().int().positive('El ID del recordatorio debe ser un entero positivo'),
  registerExpense: z.boolean().default(false),
});

export type MarkReminderPaidInput = z.infer<typeof MarkReminderPaidSchema>;

export const EntityIdSchema = z.object({
  id: z.coerce.number().int().positive('El ID debe ser un entero positivo'),
});

export type EntityIdInput = z.infer<typeof EntityIdSchema>;

export const AuthLoginSchema = z.object({
  username: z.string().min(1, 'El usuario es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export type AuthLoginInput = z.infer<typeof AuthLoginSchema>;

export const AuthRegisterSchema = z.object({
  username: z
    .string()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(50, 'El usuario no puede tener más de 50 caracteres')
    .regex(/^[a-zA-Z0-9_-]+$/, 'El usuario solo puede contener letras, números, guiones y guiones bajos'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña no puede exceder 72 caracteres'),
  business_name: z.string().min(2, 'El nombre del negocio debe tener al menos 2 caracteres').default('Mi Negocio'),
});

export type AuthRegisterInput = z.infer<typeof AuthRegisterSchema>;
