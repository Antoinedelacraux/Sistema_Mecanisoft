/* eslint-disable @typescript-eslint/no-require-imports */
import '@testing-library/jest-dom'

type WebApiKey = 'Headers' | 'Request' | 'Response' | 'FormData' | 'File' | 'Blob'

const tryRequire = <T = unknown>(moduleName: string): T | undefined => {
	try {
		return require(moduleName)
	} catch {
		return undefined
	}
}

// Attempt to polyfill fetch/Request/Response using node-fetch-native when available
tryRequire('node-fetch-native/polyfill')

const loadUndici = (): Partial<Record<WebApiKey, unknown>> => {
	const cached = tryRequire<Partial<Record<WebApiKey, unknown>>>('undici')
	return cached ?? {}
}

const ensureWebApi = (key: WebApiKey) => {
	if (!(globalThis as any)[key]) {
		const undiciExports = loadUndici()
		if (undiciExports[key]) {
			;(globalThis as any)[key] = undiciExports[key]
		}
	}
}

;(['Headers', 'Request', 'Response', 'FormData', 'File', 'Blob'] as WebApiKey[]).forEach(ensureWebApi)

// Mock fetch globally; individual tests can override as needed
const ensureMockFetch = () => {
	const maybeMock = global.fetch as unknown
	if (typeof maybeMock === 'function' && (maybeMock as jest.Mock | undefined)?.mock) {
		return
	}

	global.fetch = jest.fn(async () => {
		throw new Error('fetch mock needs configuration in tests')
	}) as unknown as typeof fetch
}

ensureMockFetch()

jest.mock('@/lib/permisos/guards', () => {
	class PermisosCheckerMock {
		async has(): Promise<boolean> {
			return true
		}

		async require(): Promise<void> {
			return
		}

		async listarPermisosResueltos(): Promise<string[]> {
			return []
		}
	}

	class SesionInvalidaError extends Error {
		constructor(message = 'Sesión inválida o usuario no autenticado') {
			super(message)
			this.name = 'SesionInvalidaError'
		}
	}

	class PermisoDenegadoError extends Error {
		readonly codigoPermiso: string

		constructor(codigoPermiso: string, message?: string) {
			super(message ?? `No cuentas con el permiso requerido: ${codigoPermiso}`)
			this.name = 'PermisoDenegadoError'
			this.codigoPermiso = codigoPermiso
		}
	}

		const asegurarPermiso = jest.fn(
			async (
				session: { user?: { id?: string | number; permisos?: string[] } } | null,
				codigoPermiso: string,
			) => {
				if (!session?.user?.id) {
					throw new SesionInvalidaError()
				}

				const permisos = Array.isArray(session.user?.permisos) ? session.user?.permisos : []
				if (!permisos.includes(codigoPermiso)) {
					throw new PermisoDenegadoError(codigoPermiso)
				}

				return new PermisosCheckerMock()
			},
		)

		const sessionTienePermiso = jest.fn((session: { user?: { permisos?: string[] } } | null, codigoPermiso: string) => {
			const permisos = Array.isArray(session?.user?.permisos) ? session?.user?.permisos : []
			return permisos.includes(codigoPermiso)
		})

	return {
		asegurarPermiso,
		PermisosChecker: PermisosCheckerMock,
		SesionInvalidaError,
		PermisoDenegadoError,
		sessionTienePermiso,
	}
})
