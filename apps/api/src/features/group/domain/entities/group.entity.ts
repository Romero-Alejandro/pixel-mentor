export interface GroupEntity {
  id: string;
  name: string;
  description: string | null;
  teacherId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMemberEntity {
  id: string;
  groupId: string;
  studentId: string;
  joinedAt: Date;
  status: MemberStatus;
}

export interface GroupClassEntity {
  id: string;
  groupId: string;
  classId: string;
  order: number;
  assignedAt: Date;
}

export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'COMPLETED';

export type GroupWithMembers = GroupEntity & {
  members: GroupMemberEntity[];
  memberCount: number;
};

export type GroupWithClasses = GroupEntity & {
  classes: GroupClassEntity[];
};

export type GroupWithMembersAndClasses = GroupEntity & {
  members: GroupMemberEntity[];
  classes: GroupClassEntity[];
  memberCount: number;
};
