---
name: Prisma schema location
description: Reference prisma/schema.prisma for database structure
type: reference
---

Database schema is defined in `prisma/schema.prisma`. Check it whenever you need to understand the structure of data stored in the database.

Models: `User` (id, email, password, createdAt, updatedAt) and `Project` (id, name, userId?, messages, data, createdAt, updatedAt). `messages` and `data` are JSON strings.
