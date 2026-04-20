# Spec: Email-to-UUID Resolution

Based on the change name, this spec defines a new API endpoint to resolve a user's email address to their unique ID (UUID). The proposal file was not found, so this spec is based on conventions observed in the existing codebase.

## 1. Requirements

The system shall expose a new, authenticated API endpoint: `GET /api/v1/users/by-email/:email`.

### 1.1. Functional Requirements

- **REQ-1.1.1: Endpoint Path**: The endpoint MUST be `GET /api/v1/users/by-email/:email`.
- **REQ-1.1.2: Authentication**: The endpoint MUST be protected and only accessible by authenticated users. Unauthenticated requests MUST result in a `401 Unauthorized` error.
- **REQ-1.1.3: Email Parameter Validation**: The `{email}` URL parameter MUST be validated as a proper email format. Invalid formats MUST result in a `400 Bad Request` error.
- **REQ-1.1.4: User Lookup**: The system MUST look up a user in the database by the provided email address.
- **REQ-1.1.5: Successful Response**: If a user is found, the endpoint MUST respond with `200 OK` and a JSON body containing the user's ID: `{ "id": "<user-uuid>" }`.
- **REQ-1.1.6: Not Found Response**: If no user is found with the given email, the endpoint MUST respond with `404 Not Found`.

### 1.2. Non-Functional Requirements

- **REQ-1.2.1: Security**: The endpoint MUST NOT expose any user information other than the user's ID.

## 2. Scenarios

### 2.1. Scenario: User Found

- **Given** an authenticated user "Alice"
- **When** Alice sends a `GET` request to `/api/v1/users/by-email/bob@example.com`
- **And** a user with the email "bob@example.com" exists with UUID `b0b-b0b-b0b`
- **Then** the server MUST respond with status `200 OK`
- **And** the response body MUST be `{"id": "b0b-b0b-b0b"}`

### 2.2. Scenario: User Not Found

- **Given** an authenticated user "Alice"
- **When** Alice sends a `GET` request to `/api/v1/users/by-email/notfound@example.com`
- **And** no user with that email exists
- **Then** the server MUST respond with status `404 Not Found`.

### 2.3. Scenario: Invalid Email Format

- **Given** an authenticated user "Alice"
- **When** Alice sends a `GET` request to `/api/v1/users/by-email/invalid-email`
- **Then** the server MUST respond with status `400 Bad Request`.

### 2.4. Scenario: Unauthenticated Access

- **Given** an unauthenticated visitor
- **When** they send a `GET` request to `/api/v1/users/by-email/bob@example.com`
- **Then** the server MUST respond with status `401 Unauthorized`.

## 3. Out of Scope

- Returning any user data besides the `id`.
- Searching for users by any other field.
- Creating, updating, or deleting users.
- Endpoint-specific rate limiting (though this may be covered by a global policy or could be added later).
