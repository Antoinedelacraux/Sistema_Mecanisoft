import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ProfileConfig from '@/components/usuarios/ProfileConfig'

// Mock the AvatarCropper to avoid dealing with canvas/cropping in the test environment.
jest.mock('@/components/usuarios/AvatarCropper', () => {
  return function MockAvatarCropper(props: any) {
    return (
      <div>
        <button onClick={() => props.onComplete(new File(['a'], 'cropped.png', { type: 'image/png' }))}>Simulate crop</button>
        <button onClick={props.onCancel}>Simulate cancel</button>
      </div>
    )
  }
})

describe('Profile cropper flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // jsdom doesn't implement createObjectURL; mock it for the cropper flow
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.URL.createObjectURL = jest.fn(() => 'blob:dummy')
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.URL.revokeObjectURL = jest.fn()

    ;(global.fetch as any) = jest.fn(async (url: any, opts: any) => {
      if (String(url).endsWith('/api/usuarios/me') && (!opts || opts.method === 'GET')) {
        return { ok: true, json: async () => ({ usuario: { id_usuario: 1, persona: { nombre: 'Admin', correo: 'admin@local' }, imagen_usuario: null } }) }
      }
      if (String(url).startsWith('/api/bitacora')) {
        return { ok: true, json: async () => ({ eventos: [] }) }
      }
      return { ok: true, json: async () => ({}) }
    })
  })

  it('opens cropper after selecting file when requested and completes crop', async () => {
    render(<ProfileConfig />)
    await waitFor(() => expect(screen.getByPlaceholderText(/Nombre/)).toBeInTheDocument())

    // click Abrir recortador (this will trigger the file input if no file selected)
    fireEvent.click(screen.getByText('Abrir recortador'))

    // now simulate selecting a file in the input
    const input = screen.getByLabelText('Subir avatar') as HTMLInputElement
    const file = new File(['dummy'], 'photo.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })

    // the mocked AvatarCropper should render a button 'Simulate crop'
    await waitFor(() => expect(screen.getByText('Simulate crop')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Simulate crop'))

    // after crop complete the preview img should be present
    await waitFor(() => expect(screen.getByAltText('avatar')).toBeInTheDocument())
  })
})
