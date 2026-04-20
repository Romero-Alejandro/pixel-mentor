# Proposal: Email to UUID Resolution

## Intent
Enable teachers to enroll students into groups using their email addresses. Currently, the backend expects a student's UUID for group enrollment, requiring a resolution step from email to UUID before the enrollment mutation can be executed.

## Scope

### In Scope
- Create a backend API endpoint `GET /api/v1/auth/users/resolve?email={email}` to look up a user by email and return their UUID and role.
- Ensure the endpoint restricts access to users with the TEACHER role.
- Update the frontend group management UI to resolve the entered email to a UUID before dispatching the "add student to group" mutation.
- Handle cases where the email is not found or the user is not a student (show appropriate error messages in the UI).

### Out of Scope
- Creating new user accounts if the email is not found.
- Modifying the existing group enrollment endpoint to accept emails directly (we keep it UUID-based).
- Bulk email resolution (only single email at a time for now).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `class-management`: The frontend flow for adding a student changes to include an email resolution step, and error handling for non-existent users is added.

## Approach
1. **Backend**: Add a new use case `resolve-user-by-email.use-case.ts` in the `auth` feature. It will use `user.repository.ts` to find the user by email. Add the route in `auth.routes.ts`.
2. **Frontend**: In the `group` feature, add a new API call to the resolution endpoint. Update the "add student" modal/form component to first call this endpoint. If successful, verify the role is STUDENT, and pass the returned UUID to the existing enrollment mutation. If not found, display an error ("Student not found with this email").

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/features/auth/` | Modified | Add new route, controller, and use-case for email resolution. |
| `apps/web/src/features/group/` | Modified | Update the student addition flow to resolve email before enrolling. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Information Disclosure (enumerating emails) | Medium | Restrict endpoint to authenticated users with the TEACHER role only. |
| User is not a STUDENT | Low | The endpoint should return the user's role, and the frontend should validate it before enrolling. |

## Rollback Plan
- Backend: Remove the newly added endpoint and use case.
- Frontend: Revert the UI changes in the group management component to its previous state using git checkout.

## Dependencies
- None

## Success Criteria
- [ ] A teacher can successfully add an existing student to a group by typing their email.
- [ ] If a teacher enters an email that does not exist, they see a clear error message.
- [ ] The resolution endpoint is inaccessible to users without the TEACHER role.