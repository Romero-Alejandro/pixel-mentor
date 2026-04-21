// repro.js
// Script to verify the root cause of the 403 Forbidden error on class access.

import pkg from './apps/api/src/database/generated/client/index.js';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

// Mock user and class IDs (replace with actual values from logs)
const userId = 'STUDENT_USER_ID'; // Replace with actual user ID from logs
const classId = '7078a54b-8d8a-4f06-a1cb-df15393e4cbe'; // From the error context

async function verifyClassAccess() {
  try {
    // 1. Check the user's group memberships and their status
    const memberships = await prisma.groupMember.findMany({
      where: {
        studentId: userId,
        status: 'ACTIVE',
      },
      select: { id: true, groupId: true, status: true },
    });

    console.log('User group memberships:', memberships);

    if (memberships.length === 0) {
      console.error('No active group memberships found for user.');
      return;
    }

    // 2. Check if any of these groups have a class assignment for the requested classId
    const groupIds = memberships.map((m) => m.groupId);
    const classAssignments = await prisma.groupClass.findMany({
      where: {
        groupId: { in: groupIds },
        classId: classId,
      },
      select: { id: true, groupId: true, classId: true },
    });

    console.log('Class assignments for groups:', classAssignments);

    if (classAssignments.length === 0) {
      console.error('No class assignments found for the requested class in any of the user\'s groups.');
      return;
    }

    console.log('User has access to the class via group membership and class assignment.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyClassAccess();