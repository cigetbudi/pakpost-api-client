using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface IWorkspaceRepository
{
    Task<Workspace?> FindAsync(Guid id, CancellationToken ct);
    Task<WorkspaceMember?> FindMemberAsync(Guid workspaceId, Guid userId, CancellationToken ct);
    Task<WorkspaceMember?> FindMemberForUpdateAsync(Guid workspaceId, Guid userId, CancellationToken ct);
    Task<bool> AnyWorkspaceAsync(CancellationToken ct);
    Task<IReadOnlyList<Workspace>> ListForUserAsync(Guid userId, CancellationToken ct);
    Task<IReadOnlyList<WorkspaceMember>> ListMembersAsync(Guid workspaceId, CancellationToken ct);
    Task<int> DeleteOwnedAsync(Guid workspaceId, Guid founderId, CancellationToken ct);
    Task<int> DeleteMemberAsync(Guid workspaceId, Guid userId, CancellationToken ct);
    void Add(Workspace workspace);
    void AddMember(WorkspaceMember member);
}
