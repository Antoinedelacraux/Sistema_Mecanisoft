import path from 'path'

export const PRODUCT_IMAGE_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const
export type ProductImageMimeType = (typeof PRODUCT_IMAGE_ALLOWED_TYPES)[number]

export const PRODUCT_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MiB

export const PRODUCT_IMAGE_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'productos')
