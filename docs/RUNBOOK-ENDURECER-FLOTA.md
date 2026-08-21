# Runbook — endurecer la flota

> Dos trabajos separados que cierran el hueco entre lo que promete la cláusula 10.2 de los Términos
> (bloqueo y borrado remoto) y lo que la flota puede hacer de verdad.
> Estado al 21 de agosto de 2026.

Contexto en `docs/POLITICA-CUENTA-MDM.md`. Resumen del problema: sin ADE y sin depósito de llave, un
cliente que decide no pagar borra el disco, sale del MDM y se queda con la MacBook; y un equipo que
vuelve cifrado sin su llave hay que borrarlo entero.

---

## Trabajo 1 — Depósito de la llave de FileVault

**Estado: hecho, en despliegue.**

### Qué se hizo

Se creó en SimpleMDM el perfil **"FileVault - deposito de llave de recuperacion"** (id 233202,
tipo `file_vault`). Configuración:

| Opción | Valor | Por qué |
|---|---|---|
| Escrow the recovery key | Activado | Es el objetivo: SimpleMDM guarda la llave y podemos abrir el disco |
| Attempt automatic remediation of missing FileVault recovery keys | Activado | Re-empuja el perfil a las Mac que ya están cifradas y no tienen llave guardada. Sin esto, el depósito solo captura llaves nuevas y los 14 equipos actuales quedarían fuera. Requiere macOS 26.0+ |
| Deploy as device profile | Activado | Perfil de equipo, no de usuario |
| Bypasses allowed at login | Do not encrypt at login | No se fuerza el cifrado en el login. Los 14 equipos ya están cifrados y no queremos interrumpir a nadie |
| Allow user to decrypt drive | Desactivado | El usuario no debería poder apagar el cifrado del equipo de la empresa. Es la única restricción del perfil y no afecta nada de desarrollo |
| Show recovery key to user | Desactivado | La llave la custodia FLUX |
| Force FileVault in Setup Assistant | Desactivado | Requiere Automated Enrollment, que no tenemos |
| Scope | macOS únicamente | |

### Ojo con las versiones de macOS

La remediación automática pide macOS 26.0 o superior. Dos equipos de la flota están por debajo y no
van a capturar su llave hasta que actualicen:

- `TKA-MACAIR-M4-001` (FQJ6YYPL2H) — macOS 15.5
- `TKA-MACPRO-M4-002` (DF39KHHQWV) — macOS 15.7.2

Para esos dos, o se actualiza macOS, o se apaga y vuelve a prender FileVault en el equipo.

### Qué ve el usuario

Al llegar el perfil, macOS puede pedirle la contraseña para poder guardar la llave de recuperación.
No es un error y hay que avisarle a quien use el equipo antes de que le aparezca. Los equipos de la
flota hoy los usa el propio equipo de Securex.

### Verificar que funcionó

```bash
curl -s -u "$SIMPLEMDM_API_KEY:" \
  "https://a.simplemdm.com/api/v1/devices/<id>" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['attributes']['filevault_recovery_key'])"
```

Cuando devuelve algo distinto de `null`, ese equipo ya tiene su llave depositada. En la consola se ve
en la ficha del equipo.

### Consecuencia comercial

Cambia la respuesta a la pregunta que hacen los clientes técnicos. Antes: "la llave la controlas tú".
Ahora: "FLUX guarda una copia de la llave de recuperación". Hay que declararlo en el acta de entrega
y está declarado en la descripción del perfil, que el usuario ve en Ajustes del sistema.

`docs/comercial/respuesta-consulta-mdm-desarrollador.md` ya está actualizado con la respuesta nueva.

---

## Trabajo 2 — Apple Business Manager con inscripción ADE

**Estado: no iniciado. No se puede hacer desde acá.**

Abrir la cuenta de ABM requiere identidad de la empresa ante Apple: número D-U-N-S, aceptación de los
términos de Apple por parte de un representante legal, y una verificación telefónica que Apple hace
con la persona designada. Eso lo tiene que hacer Edson, no se puede delegar a una herramienta.

### Paso 1 — Conseguir el D-U-N-S (si no lo tienen)

Es gratis. Se solicita en <https://developer.apple.com/enroll/duns-lookup/>. Buscar
TIKA SERVICES S.A.C. con el RUC 20605702512. Si aparece, ya lo tienen. Si no, se solicita ahí mismo y
demora entre 5 y 14 días.

### Paso 2 — Crear la cuenta de ABM

En <https://business.apple.com>. Datos que pide: razón social exacta, D-U-N-S, dirección fiscal, y
una persona de contacto para la verificación. Apple llama para confirmar que esa persona trabaja en
la empresa. Suele resolverse en 1 a 5 días hábiles.

Es gratis y no obliga a nada. Conviene tenerla lista aunque no se migre la flota todavía.

### Paso 3 — Conectar ABM con SimpleMDM

En SimpleMDM: `Devices > Enrollments`, se crea una inscripción de tipo Automated Enrollment y se
descarga el token público. Ese token se sube en ABM, en la sección de servidores MDM, y ABM devuelve
un archivo que se carga de vuelta en SimpleMDM. Es un intercambio de dos archivos, no tiene ciencia.

Se verifica con:

```bash
curl -s -u "$SIMPLEMDM_API_KEY:" "https://a.simplemdm.com/api/v1/dep_servers"
# Hoy devuelve {"data":[]}. Con ABM conectado, devuelve el servidor.
```

### Paso 4 — Meter los equipos a ABM

Acá está el trabajo real, y hay dos caminos.

**Camino A, el bueno: comprar a un revendedor autorizado.** Cuando el revendedor está inscrito en el
programa de Apple, carga el equipo a tu ABM por número de serie en el momento de la venta. El equipo
llega ya amarrado. Hoy compran a CASESWORLD, OHSHOP, MERCADO LIBRE y COOLBOX, y ninguno hace esto.
Antes del próximo lote, preguntar a cada proveedor si puede cargar a Apple Business Manager. Es la
pregunta exacta que hay que hacer.

**Camino B, el parche: Apple Configurator.** Se agregan a mano, escaneando cada Mac con la app Apple
Configurator para iPhone durante su configuración inicial. Funciona, pero tiene una trampa que hay
que conocer: los equipos agregados así le dan al usuario **30 días** para soltarse del MDM por su
cuenta. Recién pasados esos 30 días quedan amarrados de verdad.

Los 14 equipos que ya están entregados solo se pueden migrar por el camino B, y hay que recuperarlos
físicamente, borrarlos y reconfigurarlos uno por uno.

### Paso 5 — Configurar la inscripción como obligatoria

En la inscripción de Automated Enrollment de SimpleMDM, marcar el perfil como no removible. Eso es lo
que hace que el cliente no pueda quitar el MDM y que la inscripción vuelva sola después de borrar el
disco. Es el punto de todo el ejercicio.

### Lo que cambia para el cliente

Con ADE la inscripción deja de ser removible. A la pregunta "si borro el disco, ¿puedo reinstalar
macOS por mi cuenta?" la respuesta pasa de "sí, y no vuelve" a "sí, pero el equipo se vuelve a
inscribir solo". Hay que actualizar `docs/POLITICA-CUENTA-MDM.md` y la respuesta comercial el mismo
día en que se active, no después.

### Recomendación de secuencia

No migrar la flota todavía. Hacer los pasos 1 y 2 ahora, que son gratis y demoran días de trámite, y
dejar la cuenta lista. Preguntar a los proveedores por el camino A antes del próximo lote. Migrar por
el camino B solo los equipos que vuelvan por fin de contrato o mantenimiento, que ya están en la mano
y no cuesta logística extra.

Antes de invertir en esto conviene mirar un dato: cuántos clientes han borrado el disco para no pagar.
Si la respuesta es ninguno, el pagaré está alcanzando y ADE resuelve un problema que todavía no
existe.
