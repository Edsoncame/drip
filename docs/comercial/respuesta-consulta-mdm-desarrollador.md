# Respuesta a consulta técnica previa a contratación — MDM y perfil de configuración

> Borrador listo para enviar. Redactado el 21-ago-2026 sobre la auditoría real de la flota.
> Los campos entre corchetes los completa el equipo comercial antes de enviar.
> Fuente de los datos técnicos: `docs/POLITICA-CUENTA-MDM.md`.

**Antes de enviar, revisar que siga siendo cierto:** si en algún momento se despliega un perfil de
configuración en SimpleMDM, esta respuesta deja de ser válida y hay que reescribirla. Hoy la cuenta
tiene cero perfiles.

---

**Asunto:** Re: Consulta previa a contratación — MacBook Pro 14" M5 — restricciones de MDM y perfil de configuración

Estimado [NOMBRE]:

Gracias por la consulta. Le respondo punto por punto y por escrito, que es como corresponde. Donde
algo todavía no está resuelto se lo digo con esa palabra, no le doy un rodeo.

## Sobre la cuenta de usuario

**1. Privilegios de administrador.** La cuenta que se le entrega es de **administrador local**, con
`sudo` habilitado y capacidad de instalar paquetes `.pkg`. No es una cuenta estándar.

FLUX conserva además una segunda cuenta de administrador propia, para soporte y recuperación. Queda
identificada en el acta de entrega y no se usa para acceder a su información.

**2. Cuentas propias y Apple ID.** Sí. Puede crear las cuentas de usuario que necesite e iniciar
sesión con su Apple ID personal y con su cuenta de Apple Developer. No hay ninguna restricción de
cuentas ni un Apple ID corporativo ocupando el equipo.

Una sola advertencia práctica, no es una limitación: si activa Buscar mi Mac con su Apple ID,
recuerde cerrar sesión antes de devolver el equipo al terminar el contrato. Si vuelve con Activation
Lock personal activo no lo podemos reasignar y el desbloqueo se factura.

## Sobre el perfil de configuración (cláusula 10.1)

Le contesto con el dato exacto: **nuestra cuenta de MDM no tiene ningún perfil de configuración
desplegado**. Cero perfiles personalizados y cero perfiles integrados. El MDM se usa para inventario
de hardware y para la facultad de bloqueo o borrado remoto prevista en el contrato, y no aplica
ninguna política de restricción de uso.

Eso responde sus cuatro preguntas, pero se las contesto una por una para que quede constancia:

**3. Gatekeeper.** No hay restricción a apps del App Store. Puede instalar software firmado y
notarizado fuera de la tienda sin ninguna limitación de nuestra parte: IntelliJ IDEA, Docker Desktop,
Android Studio, PostgreSQL, MySQL, Homebrew y Xcode. El equipo mantiene la configuración estándar de
macOS, incluida la Protección de Integridad del Sistema, que es el comportamiento de fábrica y no
interfiere con ninguno de esos programas.

**4. Extensiones de sistema y helpers privilegiados.** No hay restricción. La aprobación de
extensiones de sistema y la instalación de helpers privilegiados funcionan con normalidad. El helper
privilegiado de Docker Desktop instala sin problema con la cuenta de administrador del punto 1.

**5. Actualizaciones de macOS.** No diferimos actualizaciones, no fijamos versión máxima y no
apuntamos a un catálogo de actualización propio. Los equipos usan el catálogo público de Apple con
las actualizaciones automáticas activas. Puede actualizar macOS cuando lo requiera la versión mínima
de Xcode que necesite para publicar.

Como referencia, nuestra flota hoy está repartida entre varias versiones de macOS según lo que cada
usuario decidió instalar. No hay una versión impuesta.

**6. Full Disk Access y Developer Tools.** No hay restricción. No tenemos desplegado ningún perfil de
control de privacidad (PPPC), de modo que las categorías de Privacidad y Seguridad, incluida
Herramientas de desarrollador, quedan bajo su control.

## Sobre la inscripción en Apple Business Manager

**7. Inscripción y reinstalación.** Los equipos **no están inscritos por ADE**. La inscripción es
manual, aprobada por el usuario. En consecuencia:

- Puede borrar el disco y reinstalar macOS desde cero por su cuenta, cuando quiera.
- Al hacerlo, la inscripción en el MDM desaparece y **no se vuelve a aplicar automáticamente**.
- No requiere intervención nuestra ni queda bloqueado en una pantalla de gestión remota.

Le pediríamos, eso sí, avisarnos si lo hace, para volver a inscribirlo y mantener el inventario al
día. Es una obligación operativa del contrato, no una barrera técnica.

**8. FileVault.** El equipo se entrega con FileVault activo. La llave de recuperación **no queda en
custodia institucional de FLUX**: hoy no tenemos habilitado el depósito de llaves en el MDM, de modo
que el cifrado queda enteramente bajo su control.

Le señalo la contrapartida para que la tenga presente: si al devolver el equipo el disco está cifrado
y la llave se perdió, el disco se borra por completo. Eso es lo esperable de todas formas al terminar
un contrato.

Si en el futuro decidiéramos habilitar el depósito de llave institucional, se lo comunicaríamos
antes y quedaría declarado en el acta de entrega. No desplegamos perfiles en silencio.

## Sobre el equipo

**9. Condición y número de serie.** La unidad es **nueva, sin uso previo**, no reacondicionada.
Nuestras MacBook Pro 14" M5 se compran nuevas a distribuidor local y se registran con cero ciclos de
batería antes de entrar a la flota.

[COMPLETAR ANTES DE ENVIAR — una de estas dos:]

[OPCIÓN A, si la unidad ya está identificada:]
El número de serie de la unidad que le corresponde es **[SERIE]**. Puede verificarlo en
<https://checkcoverage.apple.com> antes de firmar.

[OPCIÓN B, si todavía no está asignada:]
La unidad que le corresponde se asigna al confirmar la contratación. Le entregamos el número de serie
**antes de la firma**, no después, para que lo verifique en <https://checkcoverage.apple.com>. Si al
verificarlo no coincide con lo que le indicamos aquí, no hay contrato.

Sobre cobertura: AppleCare+ está disponible como servicio adicional por USD 12 al mes durante el
plazo del contrato, y cubre garantía extendida a 3 años más dos reparaciones por daño accidental con
deducible de USD 99. Se contrata al inicio.

## Sobre la documentación

**10. Contrato y acuerdo de llenado del pagaré.** Tiene toda la razón en pedirlo, y el artículo 10 de
la Ley 27287 está bien citado: quien emite un título valor incompleto tiene derecho a recibir copia
del título y del acuerdo de llenado.

Le adjunto:

- El contrato completo, que son nuestros Términos y Condiciones, disponibles también en
  <https://www.fluxperu.com/terminos>.
- [PENDIENTE] El acuerdo de llenado del pagaré y el formato del pagaré.

Sobre el segundo punto le hablo con franqueza: teníamos la autorización de llenado dentro de la
cláusula 7.1 de los Términos, pero no como documento separado con las reglas detalladas, que es lo
que corresponde. Lo estamos formalizando ahora y se lo entregamos [FECHA COMPROMETIDA]. No firmaría
usted nada antes de tenerlo, ni nosotros se lo pediríamos.

El acuerdo establece, entre otras cosas, que el pagaré solo puede completarse tras una comunicación
previa con siete días para regularizar, que el importe se limita a conceptos tasados y verificables, y
que se le remite la liquidación detallada junto con la copia del pagaré completado.

---

Quedo a disposición para cualquier precisión, y si prefiere una llamada para revisar los puntos 7 y 8
con más detalle, la coordinamos cuando le venga bien.

Saludos cordiales,

[NOMBRE]
FLUX — Tika Services S.A.C.
RUC 20605702512
[TELÉFONO] · hola@fluxperu.com
