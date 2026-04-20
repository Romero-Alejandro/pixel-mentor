# Content Control Feature - Frontend UI Specification

## ID: `feature/classroom-content-control-frontend`

## 1. Vision & Scope

Provide UI for teachers to manage groups (cohorts) and gamified learning sequences, and for students to view their accessible content path.

## 2. Key Features

### Teacher Dashboard
- **Group List**: View all groups created by teacher
- **Create Group**: Modal with name + description
- **Manage Group**: Edit name/description, delete group
- **Member Management**: Add/remove students (search by email)
- **Class Assignment**: Assign classes to group with order
- **Reorder Classes**: Drag-and-drop or manual reorder within group

### Student Dashboard
- **My Groups**: View groups student belongs to
- **Learning Path**: View ordered classes within each group
- **Progress Indicators**: Visual progress through sequence

## 3. UI/UX Guidelines

- Use existing Tailwind 4 patterns from project
- Match existing component style (cards, buttons, modals)
- Mobile-first responsive design

## 4. Routes

- `/groups` - Teacher: Group list and management
- `/groups/:groupId` - Teacher: Group details (members, classes)
- `/my-learning` - Student: My learning paths and accessible content

## 5. Acceptance Criteria

1. Teacher can create/edit/delete groups
2. Teacher can add/remove students to groups
3. Teacher can assign classes to groups and reorder them
4. Student can view their groups and ordered classes
5. All pages integrated into router with proper auth guards
6. Basic unit tests for new components