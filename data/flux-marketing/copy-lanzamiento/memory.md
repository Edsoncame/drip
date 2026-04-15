# Memoria · Copy-Lanzamiento

> Este archivo lo llena el agente con el tiempo. Es su memoria persistente entre sesiones.
> **Formato:** cada sección con entradas fechadas.
> **Regla:** el agente nunca borra entradas — marca "obsoleto" si dejan de aplicar.

---

## 1. Voz FLUX calibrada

<!--
Frases, palabras y giros que ya están aprobados como "voz oficial" de FLUX.
El agente las puede reutilizar sin pedir permiso.
Formato:
  **Frase:** [exacta]
  **Contexto:** [cuándo funciona]
  **Fecha aprobada:** YYYY-MM-DD
-->

*(sin entradas aún)*

---

## 2. Frases aprobadas al primer intento

<!--
Copy que Edson aprobó sin cambios. El agente las estudia para replicar el patrón.
Formato:
  **Pieza:** [tipo — canal]
  **Frase:** [exacta]
  **Brief origen:** [referencia al archivo]
  **Por qué funcionó:** [hipótesis del agente]
  **Fecha:** YYYY-MM-DD
-->

*(sin entradas aún)*

---

## 3. Frases rechazadas o muy editadas

<!--
Copy que Edson cambió mucho. El agente aprende qué evitar.
Formato:
  **Original (agente):** [texto]
  **Final (Edson):** [texto]
  **Qué cambió:** [análisis]
  **Aprendizaje:** [regla nueva]
  **Fecha:** YYYY-MM-DD
-->

*(sin entradas aún)*

---

## 4. Reglas de voz descubiertas

<!--
Patrones que se repiten en las correcciones de Edson. Se vuelven reglas personales del agente.
Formato:
  **Regla:** [afirmación]
  **Evidencia:** [cuántas veces se repitió el patrón]
  **Confianza:** alta / media / baja
  **Fecha descubrimiento:** YYYY-MM-DD
-->

*(sin entradas aún)*

---

## 5. Frases prohibidas específicas (agregadas sobre las de CLAUDE.md)

<!--
CLAUDE.md ya tiene una lista base de frases prohibidas. Esta sección es para las que el agente aprende sobre la marcha.
-->

*(sin entradas aún)*

---

## 6. Tono por audiencia

<!--
El agente ajusta el tono según la audiencia objetivo. Esta sección documenta las calibraciones aprendidas.
Formato:
  **Audiencia:** [quién]
  **Tono recomendado:** [descripción]
  **Palabras preferidas:** [lista]
  **Palabras a evitar:** [lista]
  **CTA preferido:** [verbo + objeto]
-->

*(sin entradas aún)*

---

## 7. Performance por canal

<!--
Cuando Edson publica un copy, si hay datos de performance (open rate, CTR, conversión), se registran acá.
Formato:
  **Pieza:** [nombre]
  **Canal:** [email, meta, google, etc.]
  **Variación publicada:** conservadora / balanceada / osada
  **Resultado:** [métricas]
  **Aprendizaje:** [qué me dice este resultado]
  **Fecha:** YYYY-MM-DD
-->

*(sin entradas aún)*

---

## 8. Historial de piezas entregadas

<!--
Índice cronológico. El contenido vive en output/*.md.
Formato:
  - YYYY-MM-DD — nombre-pieza — canal — estado (draft / aprobada / publicada / archivada)
-->

*(sin entradas aún)*

---

## 9. Métricas mensuales

<!--
Una fila por mes con métricas del agente.
Formato:
  ### YYYY-MM
  - Piezas redactadas: X
  - Aprobadas al primer intento: X (X%)
  - Promedio de iteraciones por pieza: X
  - Variante más elegida: conservadora / balanceada / osada
  - Notas:
-->

*(sin entradas aún)*

---

## 10. Contexto permanente sobre Edson

<!--
Cosas que el agente aprende sobre cómo Edson prefiere trabajar, qué tono le gusta, qué le molesta.
Esto lo ayuda a calibrarse sin preguntarle lo mismo dos veces.
-->

*(sin entradas aún)*

---

## 11. Briefs pendientes de procesar

<!--
Cola visible de briefs que aún no se han convertido en copy. El agente la mantiene al día.
Formato:
  - [archivo] — [estado: leído / en proceso / bloqueado por falta de info]
-->

*(sin entradas aún)*
