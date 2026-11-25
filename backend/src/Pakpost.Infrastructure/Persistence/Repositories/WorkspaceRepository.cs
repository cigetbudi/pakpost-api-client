using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;

public sealed class WorkspaceRepository(PakpostDbContext db) : IWorkspaceRepository
{
    public Task<Workspace?> FindAsync(Guid id, CancellationToken ct) =>
        db.Workspaces.FirstOrDefaultAsync(workspace => workspace.Id == id, ct);

    public Task<bool> AnyWorkspaceAsync(CancellationToken ct) => db.Workspaces.AnyAsync(ct);

    public Task<WorkspaceMember?> FindMemberAsync(Guid workspaceId, Guid userId, CancellationToken ct) =>
        db.WorkspaceMembers
            .AsNoTracking()
            .Include(member => member.Roles)
            .FirstOrDefaultAsync(member => member.WorkspaceId == workspaceId && member.UserId == userId, ct);

    public Task<WorkspaceMember?> FindMemberForUpdateAsync(Guid workspaceId, Guid userId, CancellationToken ct) =>
        db.WorkspaceMembers
            .Include(member => member.Roles)
            .FirstOrDefaultAsync(member => member.WorkspaceId == workspaceId && member.UserId == userId, ct);

    public async Task<IReadOnlyList<Workspace>> ListForUserAsync(Guid userId, CancellationToken ct) =>
        await db.Workspaces
            .AsNoTracking()
            .Where(workspace => db.WorkspaceMembers.Any(member =>
                member.WorkspaceId == workspace.Id && member.UserId == userId))
            .OrderBy(workspace => workspace.Name)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<WorkspaceMember>> ListMembersAsync(Guid workspaceId, CancellationToken ct) =>
        await db.WorkspaceMembers
            .AsNoTracking()
            .Include(member => member.Roles)
            .Where(member => member.WorkspaceId == workspaceId)
            .OrderBy(member => member.JoinedAt)
            .ToListAsync(ct);

    public async Task<int> DeleteOwnedAsync(
        Guid workspaceId,
        Guid founderId,
        CancellationToken ct)
    {
        await db.SavedRequests
            .Where(request => db.Collections.Any(collection =>
                collection.Id == request.CollectionId &&
                collection.WorkspaceId == workspaceId))
            .ExecuteDeleteAsync(ct);

        await db.CollectionFolders
            .Where(folder => db.Collections.Any(collection =>
                collection.Id == folder.CollectionId &&
                collection.WorkspaceId == workspaceId))
            .ExecuteDeleteAsync(ct);

        return await db.Workspaces
            .Where(workspace =>
                workspace.Id == workspaceId &&
                workspace.OwnerUserId == founderId)
            .ExecuteDeleteAsync(ct);
    }

    public Task<int> DeleteMemberAsync(Guid workspaceId, Guid userId, CancellationToken ct) =>
        db.WorkspaceMembers.Where(member => member.WorkspaceId == workspaceId && member.UserId == userId)
            .ExecuteDeleteAsync(ct);

    public void Add(Workspace workspace) => db.Workspaces.Add(workspace);

    public void AddMember(WorkspaceMember member) => db.WorkspaceMembers.Add(member);
}
