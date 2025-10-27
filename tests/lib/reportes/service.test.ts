import service from '@/lib/reportes/service'

describe('reportes service (unit)', () => {
  test('listarTemplates delegates to prisma client', async () => {
    const templates = [{ id: 1, name: 'Ventas resumen', key: 'ventas_resumen', createdAt: new Date(), createdById: 1 }]
    const fakeClient = {
      reportTemplate: {
        findMany: jest.fn().mockResolvedValue(templates),
      },
    }

    const rows = await service.listarTemplates(fakeClient as any)
    expect(fakeClient.reportTemplate.findMany).toHaveBeenCalled()
    expect(rows).toEqual(templates)
  })

  test('crearTemplate calls prisma client with mapped payload', async () => {
    const expected = { id: 2, name: 'Prueba', key: 'prueba', createdAt: new Date(), createdById: 1 }
    const fakeClient = {
      reportTemplate: {
        create: jest.fn().mockResolvedValue(expected),
      },
    }

    const created = await service.crearTemplate({ name: 'Prueba', key: 'prueba', createdById: 1 }, fakeClient as any)
    expect(fakeClient.reportTemplate.create).toHaveBeenCalledWith({
      data: {
        name: 'Prueba',
        description: null,
        key: 'prueba',
        defaultParams: null,
        createdById: 1,
      },
    })
    expect(created).toEqual(expected)
  })

  test('listarSchedules returns schedules with template info', async () => {
    const schedules = [{ id: 1, name: 'Daily', cron: '0 6 * * *', createdAt: new Date(), templateId: 1, template: { id: 1, name: 'Ventas', key: 'ventas_resumen' } }]
    const fakeClient = {
      reportSchedule: {
        findMany: jest.fn().mockResolvedValue(schedules),
      },
    }

    const rows = await service.listarSchedules(fakeClient as any)
    expect(fakeClient.reportSchedule.findMany).toHaveBeenCalled()
    expect(rows).toEqual(schedules)
  })
})
