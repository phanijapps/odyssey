# API guide

Routes under this directory are future public compatibility surfaces. Preserve route
paths and response shapes unless a spec explicitly changes them. Every mutation
requires the shared session/origin proof; every read must be learner/role scoped.
Use server services for policy and persistence, and return no answer keys, secrets,
or internal errors before the contract permits them.
