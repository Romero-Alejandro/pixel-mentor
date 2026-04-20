import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGroupsStore } from './group.store';

vi.mock('../services/group.api', () => ({
  groupApi: {
    getGroups: vi.fn(),
    getGroup: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    getMembers: vi.fn(),
    addMembers: vi.fn(),
    removeMember: vi.fn(),
    getGroupClasses: vi.fn(),
    assignClass: vi.fn(),
    unassignClass: vi.fn(),
    reorderClasses: vi.fn(),
  },
}));

import { groupApi } from '../services/group.api';

const mockGroupApi = groupApi as ReturnType<typeof vi.mockObject<typeof groupApi>>;

describe('useGroupsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch groups successfully', async () => {
    const mockGroups = [
      {
        id: '1',
        name: 'Group 1',
        description: 'Test group',
        teacherId: 'teacher-1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ];
    mockGroupApi.getGroups.mockResolvedValue({ groups: mockGroups, total: 1, page: 1, limit: 20 });

    const { result } = renderHook(() => useGroupsStore());

    await act(async () => {
      await result.current.fetchGroups();
    });

    await waitFor(() => {
      expect(result.current.groups).toEqual(mockGroups);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should create a group', async () => {
    const newGroup = {
      id: '2',
      name: 'New Group',
      description: 'New description',
      teacherId: 'teacher-1',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    mockGroupApi.createGroup.mockResolvedValue(newGroup);

    const { result } = renderHook(() => useGroupsStore());

    await act(async () => {
      await result.current.createGroup({ name: 'New Group', description: 'New description' });
    });

    await waitFor(() => {
      expect(result.current.groups).toContainEqual(newGroup);
    });
  });

  it('should delete a group', async () => {
    const groupToDelete = {
      id: '1',
      name: 'Group to Delete',
      description: null,
      teacherId: 'teacher-1',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const { result } = renderHook(() => useGroupsStore());

    await act(async () => {
      result.current.groups = [groupToDelete];
    });

    mockGroupApi.deleteGroup.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.deleteGroup('1');
    });

    await waitFor(() => {
      expect(result.current.groups).toHaveLength(0);
    });
  });

  it('should handle errors gracefully', async () => {
    mockGroupApi.getGroups.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useGroupsStore());

    await act(async () => {
      await result.current.fetchGroups();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
      expect(result.current.loading).toBe(false);
    });
  });
});
