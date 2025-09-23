-- CreateTable
CREATE TABLE "public"."persona" (
    "id_persona" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido_paterno" VARCHAR(100) NOT NULL,
    "apellido_materno" VARCHAR(100),
    "tipo_documento" VARCHAR(20) NOT NULL,
    "numero_documento" VARCHAR(20) NOT NULL,
    "sexo" VARCHAR(10),
    "telefono" VARCHAR(15),
    "correo" VARCHAR(100),
    "empresa" VARCHAR(200),
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estatus" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "persona_pkey" PRIMARY KEY ("id_persona")
);

-- CreateTable
CREATE TABLE "public"."cliente" (
    "id_cliente" SERIAL NOT NULL,
    "id_persona" INTEGER NOT NULL,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estatus" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id_cliente")
);

-- CreateTable
CREATE TABLE "public"."proveedor" (
    "id_proveedor" SERIAL NOT NULL,
    "id_persona" INTEGER NOT NULL,
    "razon_social" VARCHAR(200) NOT NULL,
    "contacto" VARCHAR(100),
    "numero_contacto" VARCHAR(15),
    "estatus" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id_proveedor")
);

-- CreateTable
CREATE TABLE "public"."rol" (
    "id_rol" SERIAL NOT NULL,
    "nombre_rol" VARCHAR(50) NOT NULL,
    "estatus" BOOLEAN NOT NULL DEFAULT true,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id_rol")
);

-- CreateTable
CREATE TABLE "public"."usuario" (
    "id_usuario" SERIAL NOT NULL,
    "id_persona" INTEGER NOT NULL,
    "id_rol" INTEGER NOT NULL,
    "nombre_usuario" VARCHAR(50) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "imagen_usuario" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "estatus" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "public"."categoria" (
    "id_categoria" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "estatus" BOOLEAN NOT NULL DEFAULT true,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "public"."unidad_medida" (
    "id_unidad" SERIAL NOT NULL,
    "nombre_unidad" VARCHAR(50) NOT NULL,
    "abreviatura" VARCHAR(10) NOT NULL,
    "estatus" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "unidad_medida_pkey" PRIMARY KEY ("id_unidad")
);

-- CreateTable
CREATE TABLE "public"."fabricante" (
    "id_fabricante" SERIAL NOT NULL,
    "nombre_fabricante" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fabricante_pkey" PRIMARY KEY ("id_fabricante")
);

-- CreateTable
CREATE TABLE "public"."producto" (
    "id_producto" SERIAL NOT NULL,
    "id_categoria" INTEGER NOT NULL,
    "id_fabricante" INTEGER NOT NULL,
    "id_unidad" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "codigo_producto" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 0,
    "precio_compra" DECIMAL(10,2) NOT NULL,
    "precio_venta" DECIMAL(10,2) NOT NULL,
    "descuento" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "oferta" BOOLEAN NOT NULL DEFAULT false,
    "estatus" BOOLEAN NOT NULL DEFAULT true,
    "foto" TEXT,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id_producto")
);

-- CreateTable
CREATE TABLE "public"."marca" (
    "id_marca" SERIAL NOT NULL,
    "nombre_marca" VARCHAR(50) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" TEXT,

    CONSTRAINT "marca_pkey" PRIMARY KEY ("id_marca")
);

-- CreateTable
CREATE TABLE "public"."modelo" (
    "id_modelo" SERIAL NOT NULL,
    "id_marca" INTEGER NOT NULL,
    "nombre_modelo" VARCHAR(50) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" TEXT,

    CONSTRAINT "modelo_pkey" PRIMARY KEY ("id_modelo")
);

-- CreateTable
CREATE TABLE "public"."vehiculo" (
    "id_vehiculo" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "id_modelo" INTEGER NOT NULL,
    "placa" VARCHAR(10) NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "año" INTEGER NOT NULL,
    "tipo_combustible" VARCHAR(30) NOT NULL,
    "transmision" VARCHAR(30) NOT NULL,
    "numero_chasis" VARCHAR(50),
    "numero_motor" VARCHAR(50),
    "observaciones" TEXT,
    "imagen" TEXT,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vehiculo_pkey" PRIMARY KEY ("id_vehiculo")
);

-- CreateTable
CREATE TABLE "public"."transaccion" (
    "id_transaccion" SERIAL NOT NULL,
    "id_persona" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tipo_transaccion" VARCHAR(50) NOT NULL,
    "tipo_comprobante" VARCHAR(50) NOT NULL,
    "serie_comprobante" VARCHAR(10),
    "numero_comprobante" VARCHAR(20),
    "codigo_transaccion" VARCHAR(50) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "impuesto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "cantidad_pago" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "estatus" VARCHAR(20) NOT NULL DEFAULT 'activo',
    "estado_orden" VARCHAR(30),
    "prioridad" VARCHAR(20) NOT NULL DEFAULT 'media',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaccion_pkey" PRIMARY KEY ("id_transaccion")
);

-- CreateTable
CREATE TABLE "public"."detalle_transaccion" (
    "id_detalle_transaccion" SERIAL NOT NULL,
    "id_transaccion" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "estatus" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "detalle_transaccion_pkey" PRIMARY KEY ("id_detalle_transaccion")
);

-- CreateTable
CREATE TABLE "public"."tarea" (
    "id_tarea" SERIAL NOT NULL,
    "id_detalle_transaccion" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "estado" VARCHAR(30) NOT NULL,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),
    "tiempo_estimado" INTEGER,
    "tiempo_real" INTEGER,
    "notas" TEXT,

    CONSTRAINT "tarea_pkey" PRIMARY KEY ("id_tarea")
);

-- CreateTable
CREATE TABLE "public"."transaccion_proveedor" (
    "id_transaccion" INTEGER NOT NULL,
    "id_proveedor" INTEGER NOT NULL,

    CONSTRAINT "transaccion_proveedor_pkey" PRIMARY KEY ("id_transaccion","id_proveedor")
);

-- CreateTable
CREATE TABLE "public"."transaccion_vehiculo" (
    "id_transaccion" INTEGER NOT NULL,
    "id_vehiculo" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "nivel_combustible" VARCHAR(20),
    "kilometraje_millas" INTEGER,
    "descripcion" TEXT,

    CONSTRAINT "transaccion_vehiculo_pkey" PRIMARY KEY ("id_transaccion","id_vehiculo")
);

-- CreateTable
CREATE TABLE "public"."bitacora" (
    "id_bitacora" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "accion" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tabla" VARCHAR(50),
    "ip_publica" VARCHAR(45),

    CONSTRAINT "bitacora_pkey" PRIMARY KEY ("id_bitacora")
);

-- CreateTable
CREATE TABLE "public"."configuracion" (
    "id_conf" SERIAL NOT NULL,
    "nombre_empresa" VARCHAR(200) NOT NULL,
    "direccion" TEXT,
    "telefono" VARCHAR(15),
    "celular" VARCHAR(15),
    "correo" VARCHAR(100),
    "rtn" VARCHAR(20),
    "isv" VARCHAR(20),
    "precio_dolar" DECIMAL(10,4),
    "cai" VARCHAR(50),
    "cantidad_facturas" INTEGER,
    "numero_inicial" INTEGER,
    "numero_final" INTEGER,
    "fecha_limite_emision" TIMESTAMP(3),
    "imagen_logo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id_conf")
);

-- CreateIndex
CREATE UNIQUE INDEX "persona_numero_documento_key" ON "public"."persona"("numero_documento");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_id_persona_key" ON "public"."cliente"("id_persona");

-- CreateIndex
CREATE UNIQUE INDEX "proveedor_id_persona_key" ON "public"."proveedor"("id_persona");

-- CreateIndex
CREATE UNIQUE INDEX "rol_nombre_rol_key" ON "public"."rol"("nombre_rol");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_id_persona_key" ON "public"."usuario"("id_persona");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_nombre_usuario_key" ON "public"."usuario"("nombre_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "producto_codigo_producto_key" ON "public"."producto"("codigo_producto");

-- CreateIndex
CREATE UNIQUE INDEX "vehiculo_placa_key" ON "public"."vehiculo"("placa");

-- CreateIndex
CREATE UNIQUE INDEX "transaccion_codigo_transaccion_key" ON "public"."transaccion"("codigo_transaccion");

-- AddForeignKey
ALTER TABLE "public"."cliente" ADD CONSTRAINT "cliente_id_persona_fkey" FOREIGN KEY ("id_persona") REFERENCES "public"."persona"("id_persona") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proveedor" ADD CONSTRAINT "proveedor_id_persona_fkey" FOREIGN KEY ("id_persona") REFERENCES "public"."persona"("id_persona") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuario" ADD CONSTRAINT "usuario_id_persona_fkey" FOREIGN KEY ("id_persona") REFERENCES "public"."persona"("id_persona") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuario" ADD CONSTRAINT "usuario_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "public"."rol"("id_rol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."producto" ADD CONSTRAINT "producto_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "public"."categoria"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."producto" ADD CONSTRAINT "producto_id_fabricante_fkey" FOREIGN KEY ("id_fabricante") REFERENCES "public"."fabricante"("id_fabricante") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."producto" ADD CONSTRAINT "producto_id_unidad_fkey" FOREIGN KEY ("id_unidad") REFERENCES "public"."unidad_medida"("id_unidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."modelo" ADD CONSTRAINT "modelo_id_marca_fkey" FOREIGN KEY ("id_marca") REFERENCES "public"."marca"("id_marca") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehiculo" ADD CONSTRAINT "vehiculo_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "public"."cliente"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehiculo" ADD CONSTRAINT "vehiculo_id_modelo_fkey" FOREIGN KEY ("id_modelo") REFERENCES "public"."modelo"("id_modelo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transaccion" ADD CONSTRAINT "transaccion_id_persona_fkey" FOREIGN KEY ("id_persona") REFERENCES "public"."persona"("id_persona") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transaccion" ADD CONSTRAINT "transaccion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_transaccion" ADD CONSTRAINT "detalle_transaccion_id_transaccion_fkey" FOREIGN KEY ("id_transaccion") REFERENCES "public"."transaccion"("id_transaccion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_transaccion" ADD CONSTRAINT "detalle_transaccion_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tarea" ADD CONSTRAINT "tarea_id_detalle_transaccion_fkey" FOREIGN KEY ("id_detalle_transaccion") REFERENCES "public"."detalle_transaccion"("id_detalle_transaccion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tarea" ADD CONSTRAINT "tarea_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transaccion_proveedor" ADD CONSTRAINT "transaccion_proveedor_id_transaccion_fkey" FOREIGN KEY ("id_transaccion") REFERENCES "public"."transaccion"("id_transaccion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transaccion_proveedor" ADD CONSTRAINT "transaccion_proveedor_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "public"."proveedor"("id_proveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transaccion_vehiculo" ADD CONSTRAINT "transaccion_vehiculo_id_transaccion_fkey" FOREIGN KEY ("id_transaccion") REFERENCES "public"."transaccion"("id_transaccion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transaccion_vehiculo" ADD CONSTRAINT "transaccion_vehiculo_id_vehiculo_fkey" FOREIGN KEY ("id_vehiculo") REFERENCES "public"."vehiculo"("id_vehiculo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transaccion_vehiculo" ADD CONSTRAINT "transaccion_vehiculo_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bitacora" ADD CONSTRAINT "bitacora_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
