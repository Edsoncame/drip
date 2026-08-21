# Política de cuenta de usuario y perfil MDM

> Documento interno de FLUX (Tika Services S.A.C.).
> Define qué recibe el cliente en el equipo alquilado y qué hace — y qué no hace — el MDM.
> Última auditoría de la flota: 21 de agosto de 2026, sobre los 14 equipos inscritos en SimpleMDM.

Este documento existe porque los clientes desarrolladores preguntan por escrito qué restricciones
tiene el equipo antes de contratar, y hasta ahora no había una respuesta oficial. Lo que sigue es
la respuesta, y está verificada contra la configuración real, no contra lo que suponíamos.

---

## 1. Estado real de la flota (auditoría 21-ago-2026)

Consultado vía API de SimpleMDM sobre los 14 equipos inscritos. Los 14 dan el mismo resultado.

| Atributo | Valor en los 14 equipos | Qué significa |
|---|---|---|
| Perfiles de configuración | 0 | No hay ninguna restricción aplicada |
| Grupos de dispositivos | 0 | Sin segmentación por política |
| Grupos de asignación | 1 ("Default", auto-deploy) | Solo despliega apps |
| Apps desplegadas | SimpleMDM DeviceLink, Google Chrome | Nada más |
| `dep_enrolled` | `false` | No están en Apple Business Manager |
| `dep_assigned` | `false` | Ni siquiera asignados a un servidor DEP |
| Servidores DEP en la cuenta | 0 | No hay token de ABM conectado |
| `is_user_approved_enrollment` | `true` | Inscripción manual aprobada por el usuario |
| `is_supervised` | `true` | Supervisión otorgada por el UAMDM de macOS 11+ |
| `filevault_enabled` | `true` | Cifrado de disco activo |
| `filevault_recovery_key` | `null` | La llave NO está en custodia de FLUX |
| `firmware_password_enabled` | `false` | Sin contraseña de firmware |
| `recovery_lock_password_enabled` | `false` | Sin bloqueo de recuperación |
| `is_activation_lock_enabled` | `false` | Sin Activation Lock corporativo |
| `system_integrity_protection_enabled` | `true` | SIP activo (default de macOS) |
| `os_update.automatic_os_installation_enabled` | `true` | Actualizaciones automáticas activas |
| `os_update.default_catalog` | `true` | Catálogo público de Apple, sin diferimiento |

Traducción en una línea: **el MDM inventaría y puede bloquear o borrar, pero no restringe nada del uso diario.**

---

## 2. Política de cuenta de usuario

### 2.1 La cuenta que se entrega es de administrador local

El cliente recibe una cuenta con privilegios de administrador, con `sudo` habilitado y capacidad de
instalar paquetes `.pkg`.

Razón: sin admin no se puede instalar Homebrew, el helper privilegiado de Docker Desktop, runtimes
de bases de datos ni aprobar extensiones de sistema. Una cuenta estándar hace inservible el equipo
para el perfil de cliente que más nos contrata — desarrolladores y equipos de tecnología.

El riesgo que introduce es real pero acotado: un administrador local puede desinstalar el perfil MDM.
Eso no cambia nada hoy, porque los equipos no están en ADE y ese perfil ya es removible aunque la
cuenta fuera estándar. Ver sección 4.

### 2.2 El cliente puede crear sus propias cuentas

Sin restricción. No hay perfil que limite la creación de cuentas locales.

### 2.3 El cliente usa su propio Apple ID

Puede iniciar sesión con su Apple ID personal y con su cuenta de Apple Developer. No hay Apple ID
corporativo de FLUX ocupando el equipo: Activation Lock está desactivado en los 14 equipos.

Contrapartida operativa, y hay que decírselo al cliente al entregar: si activa Buscar mi Mac con su
Apple ID y devuelve el equipo sin cerrar sesión, el equipo queda con Activation Lock personal y no lo
podemos reasignar. La cláusula correspondiente ya factura el desbloqueo, pero conviene evitar el
problema recordándolo en el acta de entrega.

### 2.4 FLUX conserva una cuenta de administrador propia

Para soporte y recuperación. Se documenta en el acta de entrega, con su usuario visible al cliente.
No se usa para acceder a archivos del cliente.

---

## 3. Qué NO restringe el perfil

Estas son las respuestas oficiales a las preguntas que llegan por escrito. Todas verificadas.

| Pregunta frecuente | Respuesta |
|---|---|
| ¿Gatekeeper limita la instalación al App Store? | No. Se puede instalar cualquier software firmado y notarizado: IntelliJ IDEA, Docker Desktop, Android Studio, PostgreSQL, MySQL, Homebrew, Xcode |
| ¿Se pueden aprobar extensiones de sistema y helpers privilegiados? | Sí. No hay perfil que lo restrinja. El helper de Docker Desktop instala normal |
| ¿Se difiere o se fija una versión máxima de macOS? | No. Sin perfil de Software Update y con el catálogo público de Apple. Se puede actualizar cuando Xcode lo exija |
| ¿Hay restricciones de Full Disk Access o Developer Tools? | No. No hay perfil PPPC |
| ¿Se puede usar la línea de comandos, virtualización, contenedores? | Sí, sin restricción |
| ¿FLUX ve mis archivos o mi pantalla? | No. SimpleMDM reporta inventario de hardware y estado del sistema. `remote_desktop_enabled` está en `false` |

---

## 4. Inscripción: no estamos en Apple Business Manager

Hay que ser claros internamente sobre esto porque cambia lo que podemos prometer.

Los equipos están inscritos por **enrollment manual aprobado por el usuario (UAMDM)**, no por ADE.
No existe token de ABM en la cuenta y ningún equipo figura como asignado a un servidor DEP.

Consecuencias:

- Si el cliente borra el disco y reinstala macOS, la inscripción MDM desaparece y **no vuelve sola**.
  No necesita intervención de FLUX para hacerlo, y tampoco podemos impedirlo.
- El bloqueo y borrado remoto de la cláusula 10.2 de los Términos funciona mientras el equipo siga
  inscrito y con conexión. Un cliente que decide no pagar puede salirse del MDM.
- La garantía real de FLUX ante impago es el pagaré, no la tecnología.

Esto no es una violación del contrato: la cláusula 10.1 está redactada como autorización
("el Usuario autoriza a FLUX a inscribir el equipo en ABM **y/o** en una solución MDM"), no como
promesa de servicio. Pero el FAQ público sí lo afirmaba como hecho consumado y se corrigió el
21-ago-2026.

### Decisión pendiente

Migrar la flota a Apple Business Manager con inscripción ADE cerraría el hueco: la inscripción pasa a
ser no removible y sobrevive al borrado de disco. Tiene tres costos:

1. Requiere que el equipo se compre a un revendedor autorizado Apple que lo cargue a nuestro ABM, o
   registrarlo con Apple Configurator antes de entregarlo. Hoy compramos a CASESWORLD, OHSHOP,
   MERCADO LIBRE y COOLBOX, que no cargan a ABM.
2. Cambia la respuesta a los clientes desarrolladores: con ADE la inscripción deja de ser removible,
   y eso es exactamente lo que este perfil de cliente pregunta antes de firmar.
3. No aplica retroactivamente a los 14 equipos ya en la calle.

No se decide en este documento. Se deja levantado.

---

## 5. FileVault

FileVault está activo en los 14 equipos. La llave de recuperación **no está en custodia de FLUX**:
`filevault_recovery_key` devuelve `null` en todos.

Es decir, hoy la respuesta honesta a "¿FileVault se activa de forma obligatoria con llave de
recuperación institucional en su poder?" es: FileVault sí, llave institucional no. El cliente
controla su propio cifrado.

### Decisión pendiente

Habilitar el escrow de llave de recuperación requiere desplegar un perfil de configuración
(payload FDE Recovery Key Escrow). Sería el primer perfil de la cuenta. A favor: si un cliente
devuelve el equipo cifrado y sin la llave, hoy el disco es irrecuperable y hay que borrarlo por
completo. En contra: hay que declarárselo al cliente, y a un cliente técnico le va a importar.

Si se activa, se declara en el acta de entrega. No se despliega en silencio.

---

## 6. Qué se le responde a un cliente que pregunta

Resumen para el equipo comercial, en el orden en que suelen preguntar:

1. La cuenta es de administrador local, con `sudo`.
2. Puede crear sus cuentas y usar su Apple ID personal y de Apple Developer.
3. No hay restricción de Gatekeeper. Instala lo que necesite.
4. No hay restricción de extensiones de sistema ni de helpers privilegiados.
5. No diferimos ni fijamos versión de macOS. Actualiza cuando quiera.
6. No hay restricciones de Full Disk Access ni de Developer Tools.
7. No estamos en ADE. Puede borrar el disco y reinstalar por su cuenta; la inscripción no vuelve sola.
8. FileVault viene activo. La llave de recuperación la controla él, no nosotros.
9. El número de serie se entrega antes de firmar, para que lo verifique en el portal de cobertura de Apple.
10. El contrato completo y el acuerdo de llenado del pagaré se entregan antes de firmar.
    Ver `docs/legal/pagare-acuerdo-de-llenado.md`.

Si algo de esto cambia, se actualiza este documento **antes** de que cambie la configuración, no después.

---

## 7. Cómo repetir la auditoría

```bash
# Requiere SIMPLEMDM_API_KEY en el entorno.
curl -s -u "$SIMPLEMDM_API_KEY:" \
  "https://a.simplemdm.com/api/v1/custom_configuration_profiles?limit=100"   # debe dar 0
curl -s -u "$SIMPLEMDM_API_KEY:" \
  "https://a.simplemdm.com/api/v1/dep_servers"                              # debe dar []
curl -s -u "$SIMPLEMDM_API_KEY:" \
  "https://a.simplemdm.com/api/v1/devices/<id>"                             # atributos por equipo
```

Los campos que importan por equipo: `dep_enrolled`, `is_user_approved_enrollment`, `filevault_enabled`,
`filevault_recovery_key`, `firmware_password_enabled`, `is_activation_lock_enabled` y el bloque
`os_update`.

En la aplicación, el botón **Sincronizar MDM** del panel de inventario refresca estos datos hacia la
tabla `equipment` (columnas `mdm_*`).
