# Memoria · programador-fullstack

_(se va llenando con cada task ejecutado)_

## Convenciones aprendidas del proyecto

- Modelo AI: SIEMPRE `claude-sonnet-4-6` (hyphen format, BYOK)
- Runtime en route handlers: siempre `nodejs`, nunca edge
- maxDuration explícito cuando puede exceder 10s
- `requireAdmin()` al inicio de todo `/api/admin/*`
- Query Postgres siempre con `query<T>()` de lib/db.ts
- Commits convencionales con Co-Authored-By

## Cambios críticos históricos

_(se llena cuando toquemos lib/auth, middleware, pagos)_

## Decisiones de arquitectura

_(por qué se eligió X sobre Y)_
