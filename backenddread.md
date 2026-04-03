# QueryMe Backend



---

## Table of Contents

- [Project Setup](#project-setup)
- [Group J — Auth Module](#group-j--auth-module)
- [Group A — Exam Module](#group-a--exam-module)
- [Group D — Sandbox Environment Module](#group-d--sandbox-environment-module)

---

### Environment Variables


```

### Run the server

bash

./mvnw spring-boot:run
```

Server starts on **`http://localhost:8080`**

> On first startup, a default ADMIN account is automatically created using `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
> Change these before deploying to any shared environment.
# Optional — override default admin seeded on startup
ADMIN_EMAIL=admin@gmail.com 

ADMIN_PASSWORD=Admin@1234
---

# Group J — Auth Module


Every HTTP request on the platform passes through the JWT filter maintained by this group.
This section documents how to authenticate and how other groups should handle tokens.

## Database Schema

Roles are **NOT** a separate table. They are stored as a `varchar` column directly
on the `users` table — one table, no join table required.

```sql
CREATE TABLE users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL,   -- 'ADMIN' | 'TEACHER' | 'STUDENT' | 'GUEST'
    created_at    TIMESTAMP    DEFAULT now()
);
```

## Roles Reference

| Role | Description |
|---|---|
| `ADMIN` | Full access — manage users, platform-wide visibility |
| `TEACHER` | Create and manage exams, view all student results |
| `STUDENT` | Participate in assigned exams, view own results |
| `GUEST` | Read-only, limited access |

## Base URL

```
http://localhost:8080/api/auth
http://localhost:8080/api/users
```

## Auth Endpoints (No token required)

### Register a new user

```
POST /api/auth/signup
Content-Type: application/json
```

Request body:

```json
{
  "name": "Alice",
  "email": "alice@gmail.com",
  "password": "Secret@99",
  "role": "STUDENT"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Must not be blank |
| `email` | string | yes | Must be unique |
| `password` | string | yes | Min 6, max 40 characters |
| `role` | string | no | `ADMIN`, `TEACHER`, `STUDENT`, `GUEST` — defaults to `STUDENT` |

**Response `200 OK`:**

```json
{
  "message": "User registered successfully!"
}
```

**Error — email already in use:**

```json
{
  "message": "Error: Email is already in use!"
}
```

**Error — invalid role:**

```json
{
  "message": "Error: Invalid role 'XYZ'. Valid values: ADMIN, TEACHER, STUDENT, GUEST"
}
```

---

### Login

```
POST /api/auth/signin
Content-Type: application/json
```

Request body:

```json
{
  "email": "alice@gmail.com",
  "password": "Secret@99"
}
```

**Response `200 OK`:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "type": "Bearer",
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "alice@gmail.com",
  "roles": ["STUDENT"]
}
```

> Save the `token` value — you must send it in every subsequent request.

---

## User Endpoints (Token required)

Include the token in every request:

```
Authorization: Bearer <your_token_here>
```

---

### Get own profile

```
GET /api/users/me
Authorization: Bearer <token>
```

Available to **any authenticated role**.

**Response `200 OK`:**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "alice@gmail.com",
  "role": "STUDENT",
  "createdAt": "2026-04-02T21:26:38"
}
```

---

### List all users *(ADMIN only)*

```
GET /api/users
Authorization: Bearer <admin_token>
```

**Response `200 OK`:** array of user objects

---

### Filter users by role *(ADMIN or TEACHER)*

```
GET /api/users/role/{role}
Authorization: Bearer <admin_or_teacher_token>
```

Example:

```
GET /api/users/role/STUDENT
```

**Response `200 OK`:** array of users with that role

---

### Get user by ID *(ADMIN only)*

```
GET /api/users/{id}
Authorization: Bearer <admin_token>
```

**Response `200 OK`:** single user object, or `404 Not Found`

---

### Delete user *(ADMIN only)*

```
DELETE /api/users/{id}
Authorization: Bearer <admin_token>
```

**Response `200 OK`:**

```json
"User deleted successfully."
```

---

## Route Security Reference

All routes outside `/api/auth/**` require a valid JWT. Unauthorized requests return `401`.
Requests with a valid JWT but insufficient role return `403`.

| Route pattern | Minimum role |
|---|---|
| `POST /api/auth/**` | Public |
| `GET /api/users/me` | Any authenticated user |
| `GET/DELETE /api/users/**` | `ADMIN` |
| `GET /api/users/role/**` | `ADMIN` or `TEACHER` |
| `/api/exams/**` | `TEACHER` or `ADMIN` |
| `/api/questions/**` | `TEACHER` or `ADMIN` |
| `/api/submissions/**` | `STUDENT`, `TEACHER`, or `ADMIN` |
| `/api/results/**` | `STUDENT`, `TEACHER`, or `ADMIN` |

## How to Integrate (For Other Groups)

### Protect your endpoints with `@PreAuthorize`

```java
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/exams")
public class ExamController {

    // Only teachers and admins can create exams
    @PostMapping
    @PreAuthorize("hasAnyAuthority('TEACHER', 'ADMIN')")
    public ResponseEntity<?> createExam(...) { ... }

    // Students, teachers, and admins can view published exams
    @GetMapping("/published")
    @PreAuthorize("hasAnyAuthority('STUDENT', 'TEACHER', 'ADMIN')")
    public ResponseEntity<?> getPublishedExams() { ... }
}
```

### Get the current user's details inside a service

```java
import com.year2.queryme.security.UserDetailsImpl;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

// Inside any @Service or @RestController method:
Authentication auth = SecurityContextHolder.getContext().getAuthentication();
UserDetailsImpl currentUser = (UserDetailsImpl) auth.getPrincipal();

UUID userId  = currentUser.getId();
String email = currentUser.getEmail();
String role  = currentUser.getAuthorities().iterator().next().getAuthority(); // e.g. "STUDENT"
```

### Quick Postman test flow

1. `POST /api/auth/signup` — create a STUDENT, a TEACHER, and use the default ADMIN
2. `POST /api/auth/signin` — login with each; copy the returned `token`
3. Set **Authorization → Bearer Token** in Postman using the copied token
4. Call protected endpoints and verify the correct `200` / `403` responses per role

---

# Group A — Exam Module

**Base URL:** `http://localhost:8080/api/exams`

All endpoints require a valid JWT token:

```
Authorization: Bearer <token>
```

## Exam Status Lifecycle

```
DRAFT → PUBLISHED → CLOSED
  ↑________↓
 (unpublish)
```

## Endpoints

### Create an exam

```
POST /api/exams
```

**Request body:**

```json
{
  "courseId": "uuid-of-course",
  "title": "Database CAT 1",
  "description": "Optional description",
  "visibilityMode": "IMMEDIATE",
  "timeLimitMins": 60,
  "maxAttempts": 1,
  "seedSql": "CREATE TABLE students (id INT PRIMARY KEY, name VARCHAR(100), grade INT); INSERT INTO students VALUES (1, 'Alice', 85);"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `courseId` | string | yes | UUID from Group F |
| `title` | string | yes | |
| `description` | string | no | |
| `visibilityMode` | string | yes | `IMMEDIATE`, `END_OF_EXAM`, `NEVER` |
| `timeLimitMins` | integer | no | `null` = no time limit |
| `maxAttempts` | integer | no | Defaults to `1` |
| `seedSql` | string | yes | SQL for sandbox seeding — Group D uses this |

**Response `200 OK`:**

```json
{
  "id": "36b28504-1902-4ac4-89a1-1271f0ead90e",
  "courseId": "uuid-of-course",
  "title": "Database CAT 1",
  "description": "Optional description",
  "status": "DRAFT",
  "visibilityMode": "IMMEDIATE",
  "timeLimitMins": 60,
  "maxAttempts": 1,
  "seedSql": "CREATE TABLE...",
  "createdAt": "2026-04-01T11:16:10.448",
  "publishedAt": null
}
```

---

### Get exam by ID

```
GET /api/exams/{examId}
```

**Response `200 OK`:** full exam object

---

### Get exams by course

```
GET /api/exams/course/{courseId}
```

**Response `200 OK`:** array of exam objects for that course

---

### Get all published exams

```
GET /api/exams/published
```

**Response `200 OK`:** array of exams where `status = PUBLISHED`

---

### Update an exam

```
PUT /api/exams/{examId}
```

> Only allowed when `status = DRAFT`

**Request body** (all fields optional):

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "visibilityMode": "END_OF_EXAM",
  "timeLimitMins": 90,
  "maxAttempts": 2,
  "seedSql": "CREATE TABLE..."
}
```

**Response `200 OK`:** updated exam object

**Error if not DRAFT:**

```json
{ "message": "Only DRAFT exams can be edited" }
```

---

### Publish an exam

```
PATCH /api/exams/{examId}/publish
```

Validation before publish:
- Status must be `DRAFT`
- `seedSql` must not be empty
- `visibilityMode` must be set

**Response `200 OK`:**

```json
{
  "status": "PUBLISHED",
  "publishedAt": "2026-04-01T11:20:00.000"
}
```

---

### Unpublish an exam

```
PATCH /api/exams/{examId}/unpublish
```

> Moves `PUBLISHED` back to `DRAFT`

**Response `200 OK`:**

```json
{
  "status": "DRAFT",
  "publishedAt": null
}
```

**Error if not PUBLISHED:**

```json
{ "message": "Only PUBLISHED exams can be unpublished" }
```

---

### Close an exam

```
PATCH /api/exams/{examId}/close
```

> Moves `PUBLISHED` to `CLOSED`. Cannot be reversed.

**Error if not PUBLISHED:**

```json
{ "message": "Only PUBLISHED exams can be closed" }
```

---

### Delete an exam

```
DELETE /api/exams/{examId}
```

> Only `DRAFT` exams can be deleted

**Response `204 No Content`**

**Error if not DRAFT:**

```json
{ "message": "Only DRAFT exams can be deleted" }
```

---

## Visibility Mode Reference

| Value | Meaning |
|---|---|
| `IMMEDIATE` | Student sees results right after submitting |
| `END_OF_EXAM` | Student sees results only after exam is closed |
| `NEVER` | Results never shown to student |

---

## Error Reference

| Status | Meaning |
|---|---|
| `200 OK` | Success |
| `204 No Content` | Delete succeeded |
| `401 Unauthorized` | Missing or invalid JWT token |
| `403 Forbidden` | Valid token but insufficient role |
| `500` | Business rule violation — check `message` field |

---

# Group D — Sandbox Environment Module

**Overview:** This module dynamically provisions and manages isolated PostgreSQL schemas
for individual student exam sessions. Each student gets a private schema seeded with the
exam dataset, so queries cannot affect other students or the application database.

## Architecture

### Security Model

- **Isolation**: Each student gets a unique schema (e.g., `exam_123_student_456`) and a dedicated database user with randomly generated credentials.
- **Blast Radius Containment**: Students are explicitly revoked access to the `public` schema and granted full CRUD permissions only on their assigned schema.
- **Automated Cleanup**: Expired sandboxes are automatically torn down to free up server resources.

### Key Components

| Class | Role |
|---|---|
| `SandboxService` | Primary interface — provision, retrieve connection info, teardown |
| `SandboxRegistry` | JPA entity tracking active sandboxes in the `sandbox_registry` table |
| `SandboxCleanupScheduler` | Runs every 5 minutes to remove expired sandboxes |

## Configuration Requirements

**`application.yml`** — already set:

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: update
```

**Main application class** — add `@EnableScheduling`:

```java
@SpringBootApplication
@EnableScheduling
public class QueryMeBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(QueryMeBackendApplication.class, args);
    }
}
```

**PostgreSQL user** — the `DB_USER` must have `CREATEROLE` privileges:

```sql
ALTER USER your_db_user CREATEROLE;
```

## Integration Guide for Group G (Query Engine)

Autowire `SandboxService` into your service class:

```java
package com.year2.queryme.queryengine;

import com.year2.queryme.sandbox.dto.SandboxConnectionInfo;
import com.year2.queryme.sandbox.service.SandboxService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.UUID;

@Service
public class QueryEngineService {

    @Autowired
    private SandboxService sandboxService;

    public void executeStudentQuery(UUID examId, UUID studentId,
                                    String seedSql, String studentQuery) {
        // 1. Provision sandbox
        String schemaName = sandboxService.provisionSandbox(examId, studentId, seedSql);

        // 2. Get connection details
        SandboxConnectionInfo info = sandboxService.getSandboxConnectionDetails(examId, studentId);
        String dbUsername = info.dbUsername();
        String dbPassword = info.dbPassword();
        String schema     = info.schemaName();

        // 3. Execute student query using the connection details
        // (use JdbcTemplate or a dedicated DataSource pointed at the schema)

        // 4. Teardown after execution
        sandboxService.teardownSandbox(examId, studentId);
    }
}
```

### Method Reference

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `provisionSandbox` | `examId`, `studentId`, `seedSql` | `String` schemaName | Creates schema, user, seeds data |
| `getSandboxConnectionDetails` | `examId`, `studentId` | `SandboxConnectionInfo` | Returns schema + credentials |
| `teardownSandbox` | `examId`, `studentId` | `void` | Drops schema and user permanently |

> Handle exceptions for all three calls — provisioning can fail if the DB user lacks `CREATEROLE`.

---

*For questions about the Auth module contact `groupj.queryme@gmail.com`*
