import {
  PrismaGroupRepository,
  PrismaGroupMemberRepository,
  PrismaGroupClassRepository,
} from '@/features/group/infrastructure/persistence/prisma-group.repository.js';
import { GroupService } from '@/features/group/application/services/group.service.js';
import { ContentAccessService } from '@/features/group/application/services/content-access.service.js';
import {
  PrismaStudentLookupAdapter,
  PrismaClassReferenceAdapter,
} from '@/features/group/infrastructure/persistence/prisma-reference.adapters.js';
import { PrismaGroupAccessAdapter } from '@/features/group/infrastructure/persistence/prisma-group-access.adapter.js';

/**
 * Group feature container (composition of the group bounded context).
 *
 * All application services receive their outbound ports here — the
 * application layer has no prisma dependency.
 */
export interface GroupContainer {
  groupRepository: PrismaGroupRepository;
  groupMemberRepository: PrismaGroupMemberRepository;
  groupClassRepository: PrismaGroupClassRepository;
  groupService: GroupService;
  contentAccessService: ContentAccessService;
}

export function buildGroupContainer(): GroupContainer {
  const groupRepository = new PrismaGroupRepository();
  const groupMemberRepository = new PrismaGroupMemberRepository();
  const groupClassRepository = new PrismaGroupClassRepository();

  const studentLookup = new PrismaStudentLookupAdapter();
  const classReference = new PrismaClassReferenceAdapter();

  return {
    groupRepository,
    groupMemberRepository,
    groupClassRepository,
    groupService: new GroupService(
      groupRepository,
      groupMemberRepository,
      groupClassRepository,
      studentLookup,
      classReference,
    ),
    contentAccessService: new ContentAccessService(new PrismaGroupAccessAdapter()),
  };
}
