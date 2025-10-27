import { z } from 'zod'

export const templateCreateSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  description: z.string().optional(),
  default_params: z.any().optional(),
})

export const templateUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  default_params: z.any().optional(),
})

export const scheduleCreateSchema = z.object({
  template_id: z.number().int().positive(),
  name: z.string().min(1),
  cron: z.string().min(1),
  recipients: z.string().min(1),
  params: z.any().optional(),
})

export const scheduleUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  cron: z.string().min(1).optional(),
  recipients: z.string().min(1).optional(),
  params: z.any().optional(),
  active: z.boolean().optional(),
})

export type TemplateCreate = z.infer<typeof templateCreateSchema>
export type TemplateUpdate = z.infer<typeof templateUpdateSchema>
export type ScheduleCreate = z.infer<typeof scheduleCreateSchema>
export type ScheduleUpdate = z.infer<typeof scheduleUpdateSchema>
