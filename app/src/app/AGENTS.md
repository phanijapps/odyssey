# App Router guide

This directory owns pages and same-origin HTTP adapters. Keep route handlers thin:
parse/validate input, derive session identity, call a focused server service, and
return a documented safe projection. Never put persistence or authorization policy
in a client component.
