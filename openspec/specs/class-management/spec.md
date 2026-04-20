# Class Management Specification

## Purpose

This specification outlines the system's capabilities for managing Groups (cohorts) and Classrooms, and how students are added to groups and classes are sequenced within a group (gamified learning path). It defines how teachers can create and manage their own groups and classrooms, how students are enrolled in groups, and how classrooms are ordered inside a group.

## Requirements

### Requirement: Teacher Group Creation
A user with the role of "TEACHER" MUST be able to create, update, and delete their own Groups.

#### Scenario: Teacher Creates a New Group
- GIVEN a user is authenticated as a "TEACHER"
- WHEN they submit a request to create a new Group with a valid name (e.g., "Cohorte Abril 2026")
- THEN the system MUST create a new `Group` record associated with that teacher's user ID as the owner.
- AND the system MUST return a confirmation of the successful creation.

#### Scenario: Teacher Attempts to Modify Another Teacher's Group
- GIVEN "Teacher A" owns "Group A"
- AND "Teacher B" attempts to update the details of "Group A"
- THEN the system MUST return an HTTP 403 (Forbidden) error.

### Requirement: Teacher Classroom Creation
A user with the role of "TEACHER" MUST be able to create, update, and delete their own Classrooms.

#### Scenario: Teacher Creates a New Classroom
- GIVEN a user is authenticated as a "TEACHER"
- WHEN they submit a request to create a new Classroom with a valid name (e.g., "Lección 1: Variables")
- THEN the system MUST create a new `Classroom` record associated with that teacher's user ID as the owner.
- AND the system MUST return a confirmation of the successful creation.

#### Scenario: Teacher Attempts to Modify Another Teacher's Classroom
- GIVEN "Teacher A" owns "Classroom A"
- AND "Teacher B" attempts to update the details of "Classroom A"
- THEN the system MUST return an HTTP 403 (Forbidden) error.

### Requirement: Student Group Membership Management
A "TEACHER" MUST be able to enroll students in the Groups they own and remove them (bulk operations).

#### Scenario: Teacher Enrolls Students in a Group
- GIVEN "Teacher A" owns "Group A"
- AND "Student Z1" and "Student Z2" are valid users in the system with role "STUDENT"
- AND neither student is currently enrolled in "Group A"
- WHEN "Teacher A" requests to enroll "Student Z1" and "Student Z2" in "Group A"
- THEN the system MUST create `GroupMember` records linking each student to "Group A".
- AND each enrollment record MUST have a unique constraint on the combination of `groupId` and `studentId`.

#### Scenario: Teacher Removes a Student from a Group
- GIVEN "Teacher A" owns "Group A"
- AND "Student Z" is currently enrolled in "Group A"
- WHEN "Teacher A" requests to remove "Student Z" from "Group A"
- THEN the system MUST delete the corresponding `GroupMember` record.

#### Scenario: Student Self-Enrollment (Out of Scope for this version)
- GIVEN a student wishes to join a group
- WHEN they attempt to enroll themselves
- THEN the system SHOULD NOT provide a mechanism for this action. All enrollments are managed by the teacher.

### Requirement: Multi-Group Membership for Students
A user with the role of "STUDENT" MUST be able to be enrolled in multiple Groups simultaneously.

#### Scenario: Student Enrolled in Multiple Groups
- GIVEN "Student Z" is already enrolled in "Group A" (owned by Teacher A)
- WHEN "Teacher B" enrolls "Student Z" into "Group B"
- THEN the system MUST successfully create a new `GroupMember` record for "Student Z" in "Group B".
- AND the existing enrollment in "Group A" MUST remain unaffected.

### Requirement: Ordered Classroom Assignment within a Group (Gamified Path)
A "TEACHER" MUST be able to assign Classrooms to a Group they own, specifying an order that defines the learning sequence.

#### Scenario: Teacher Assigns a Classroom to a Group at a Specific Order
- GIVEN "Teacher A" owns "Group A"
- AND "Teacher A" owns "Classroom A"
- AND "Classroom A" is NOT currently assigned to "Group A"
- WHEN "Teacher A" requests to assign "Classroom A" to "Group A" with order 0
- THEN the system MUST create a `GroupClass` record linking "Group A" and "Classroom A" with `order = 0`.
- AND this assignment record MUST have a unique constraint on the combination of `groupId` and `order` (to avoid duplicate positions) and on `groupId` and `classroomId` (to avoid duplicate classroom in the same group).

#### Scenario: Teacher Attempts to Assign Another Teacher's Classroom to Their Group
- GIVEN "Teacher A" owns "Group A"
- AND "Teacher B" owns "Classroom B"
- WHEN "Teacher A" requests to assign "Classroom B" to "Group A"
- THEN the system MUST return an HTTP 403 (Forbidden) error, because only the owner of a classroom can assign it to their own groups.

#### Scenario: Teacher Updates the Order of a Classroom within a Group
- GIVEN "Teacher A" owns "Group A"
- AND "Classroom A" is currently assigned to "Group A" with order 1
- AND "Classroom B" is currently assigned to "Group A" with order 2
- WHEN "Teacher A" requests to move "Classroom A" to order 2 and "Classroom B" to order 1
- THEN the system MUST update the `order` fields of the two `GroupClass` records accordingly, preserving uniqueness constraints.

### Requirement: Retrieval of Ordered Classrooms for a Group
Any authenticated user (teacher owner or student member) MUST be able to retrieve the list of classrooms assigned to a Group, sorted by order.

#### Scenario: Teacher Retrieves Classrooms of Their Own Group
- GIVEN "Teacher A" owns "Group A"
- AND "Group A" has classrooms assigned with orders 0, 1, 2
- WHEN "Teacher A" requests the list of classrooms for "Group A"
- THEN the system MUST return the classrooms in ascending order of `order`.

#### Scenario: Student Retrieves Classrooms of a Group They Are Enrolled In
- GIVEN "Student Z" is an active member of "Group A"
- AND "Group A" has classrooms assigned with orders 0, 1, 2
- WHEN "Student Z" requests the list of classrooms for "Group A"
- THEN the system MUST return the classrooms in ascending order of `order`.

#### Scenario: Unauthenticated or Non-Member Attempts to Access Group Classrooms
- GIVEN a user is not authenticated OR is authenticated but is NOT a member of "Group A" (either not enrolled or enrolled with status INACTIVE)
- WHEN they request the list of classrooms for "Group A"
- THEN the system MUST return an HTTP 403 (Forbidden) error.